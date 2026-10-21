// Vercel Edge Function: reads a company's investor relations (IR) website and returns its events, press releases and
// the documents attached to each event (press release, slides, transcript, webcast, financial statements).
// GET /api/ir?type=site&url=<IR page>   → { platform, events, releases, notes }
// GET /api/ir?type=doc&url=<page>       → a press release or transcript web page as clean, readable HTML
// GET /api/ir?type=file&url=<pdf>       → a PDF served from our domain, so it can be shown inside the app
//
// Three readers, tried in order:
//   1. Q4 Inc. sites (Apple and thousands of others): their public JSON feeds under /feed/*.svc
//   2. Microsoft: the events list the investor pages embed as JSON
//   3. Anything else: the links on the IR page and its events/news pages, grouped by quarter
// Every request identifies itself and checks the site's robots.txt first; pages robots.txt disallows are skipped.
export const config = { runtime: 'edge' }

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const BOT = 'SBWResearchBot'
const UA = `Mozilla/5.0 (compatible; ${BOT}/1.0; +mailto:${env.SEC_CONTACT_EMAIL ?? 'research@sbw-invest.com'})`
const HOUR = 3600

export type DocKind = 'press-release' | 'slides' | 'transcript' | 'webcast' | 'financials' | 'filing' | 'event-page' | 'other'
export type DocFormat = 'html' | 'pdf' | 'pptx' | 'docx' | 'xlsx' | 'video' | 'other'
export interface IrDoc { kind: DocKind; title: string; url: string; format: DocFormat }
export interface IrEvent { id: string; title: string; date: string | null; type: 'earnings' | 'conference' | 'meeting' | 'other'; page: string | null; summary: string | null; documents: IrDoc[] }
export interface IrRelease { id: string; title: string; date: string | null; url: string; summary: string | null }
export interface IrSite { url: string; host: string; platform: 'q4' | 'microsoft' | 'generic'; events: IrEvent[]; releases: IrRelease[]; notes: string[]; fetchedAt: string }

export default async function handler(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams
  const target = safeUrl(q.get('url'))
  if (!target) return json({ error: 'Pass a full https:// address in url.' }, 0, 400)
  try {
    switch (q.get('type')) {
      case 'discover': return json(await discover(target), 24 * HOUR)
      case 'site': return json(await site(target), 6 * HOUR)
      case 'doc': return json(await doc(target), 24 * HOUR)
      case 'file': return file(target)
      default: return json({ error: 'Unknown type' }, 0, 400)
    }
  } catch (e) {
    const err = e as Error & { status?: number }
    return json({ error: err.message }, 0, err.status ?? 502)
  }
}

function json(body: unknown, maxAge: number, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': maxAge ? `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` : 'no-store' },
  })
}

const fail = (message: string, status = 502) => Object.assign(new Error(message), { status })

/** Public https addresses only: no credentials, ports, IP literals or local names. */
function safeUrl(raw: string | null): URL | null {
  if (!raw) return null
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null
    const h = u.hostname
    if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal)$/i.test(h)) return null
    return u
  } catch { return null }
}

/* ---------- polite fetching: robots.txt, identification, timeouts ---------- */

interface Rule { allow: boolean; re: RegExp; len: number }
const robotsCache = new Map<string, Promise<Rule[]>>()

function robots(origin: string): Promise<Rule[]> {
  if (!robotsCache.has(origin)) {
    robotsCache.set(origin, fetch(`${origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.text() : ''))
      .then(parseRobots)
      .catch(() => []))
  }
  return robotsCache.get(origin)!
}

/** Rules from the group for our bot if there is one, otherwise the `*` group. */
export function parseRobots(txt: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = []
  let cur: { agents: string[]; rules: Rule[] } | null = null
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i)
    if (!m) continue
    const key = m[1].toLowerCase(), val = m[2].trim()
    if (key === 'user-agent') {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur) }
      cur.agents.push(val.toLowerCase())
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      if (!val) continue // "Disallow:" with nothing means allow everything
      const re = new RegExp('^' + val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))
      cur.rules.push({ allow: key === 'allow', re, len: val.length })
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== '*' && BOT.toLowerCase().includes(a)))
  return (mine ?? groups.find((g) => g.agents.includes('*')))?.rules ?? []
}

/** Longest matching rule wins; allow wins a tie. */
export function allowedBy(rules: Rule[], pathAndQuery: string) {
  let best: Rule | null = null
  for (const r of rules) if (r.re.test(pathAndQuery) && (!best || r.len > best.len || (r.len === best.len && r.allow))) best = r
  return !best || best.allow
}

async function polite(u: URL, accept = 'text/html,application/json;q=0.9,*/*;q=0.5'): Promise<Response> {
  if (!allowedBy(await robots(u.origin), u.pathname + u.search)) throw fail(`${u.hostname} asks automated tools not to read ${u.pathname} (robots.txt).`, 403)
  const r = await fetch(u, { headers: { 'user-agent': UA, accept }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw fail(r.status === 403 || r.status === 401 ? `${u.hostname} blocked the request (${r.status}). The site may only allow browsers.` : `${u.hostname} returned ${r.status}.`, r.status === 404 ? 404 : 502)
  return r
}

const getText = async (u: URL) => (await polite(u)).text()
async function getJson<T>(u: URL): Promise<T | null> {
  try {
    const r = await polite(u, 'application/json')
    if (!r.headers.get('content-type')?.includes('json')) return null
    return (await r.json()) as T
  } catch { return null }
}

/** Short links (aka.ms, bit.ly, …) hide the real file; follow redirects to learn where it lives and what it is. */
async function resolve(raw: string): Promise<{ url: string; type: string }> {
  let u = raw
  for (let i = 0; i < 6; i++) {
    const r = await fetch(u, { method: 'HEAD', redirect: 'manual', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) }).catch(() => null)
    if (!r) break
    const loc = r.headers.get('location')
    r.body?.cancel().catch(() => {})
    if (r.status >= 300 && r.status < 400 && loc) { u = new URL(loc, u).href; continue }
    return { url: u, type: r.headers.get('content-type') ?? '' }
  }
  return { url: u, type: '' }
}

/* ---------- classifying links ---------- */

export function formatOf(url: string, contentType = ''): DocFormat {
  const p = url.toLowerCase().split(/[?#]/)[0]
  const ct = contentType.toLowerCase()
  if (/\.pdf$/.test(p) || ct.includes('pdf')) return 'pdf'
  if (/\.pptx?$/.test(p) || ct.includes('presentation')) return 'pptx'
  if (/\.docx?$/.test(p) || ct.includes('wordprocessing') || ct.includes('msword')) return 'docx'
  if (/\.xlsx?$/.test(p) || ct.includes('spreadsheet') || ct.includes('excel')) return 'xlsx'
  if (/\.(mp3|mp4|m3u8|m4a)$/.test(p) || /^(audio|video)\//.test(ct)) return 'video'
  if (/\.(html?|aspx?)$/.test(p) || ct.includes('html') || !/\.[a-z0-9]{2,5}$/.test(p)) return 'html'
  return 'other'
}

/** What a link is, judged by its text first and its address only when the text says nothing. */
export function kindOf(title: string, url: string): DocKind {
  const byTitle = classify(title.toLowerCase())
  return byTitle !== 'other' ? byTitle : classify(url.toLowerCase())
}

function classify(t: string): DocKind {
  if (/transcript/.test(t)) return 'transcript'
  if (/webcast|listen|replay|earnings-call|conference call|audio|video|medius|q4inc\.com\/events|events\.q4inc|notified\.com|on24|zoom\.us|vimeo|youtube/.test(t)) return 'webcast'
  if (/slide|presentation|deck|powerpoint|\.pptx?\b/.test(t)) return 'slides'
  if (/press release|news release|earnings release|newsroom|reports? .*results|announces .*results|press-release/.test(t)) return 'press-release'
  if (/10-?q|10-?k|20-?f|6-?k|8-?k|annual report|proxy/.test(t)) return 'filing'
  if (/financial|statement|supplement|fact ?sheet|metrics|data ?book|guidance|outlook/.test(t)) return 'financials'
  return 'other'
}

const ORDER: DocKind[] = ['press-release', 'slides', 'transcript', 'webcast', 'financials', 'filing', 'event-page', 'other']
function tidyDocs(docs: IrDoc[]) {
  const seen = new Set<string>()
  return docs.filter((d) => d.url && !seen.has(d.url) && seen.add(d.url)).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}

const QWORD: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 }
/** "FY 26 Third Quarter Results", "Q3 2026", "FY-2026-Q4", "third quarter fiscal 2026" → { q: 3, y: 2026 }. */
export function periodOf(s: string): { q: number; y: number } | null {
  const t = s.toLowerCase().replace(/[_-]+/g, ' ')
  const compact = t.match(/\b([1-4])q\s?'?(20\d\d|\d\d)\b/) // 4Q25, 3Q 2026
  if (compact) return { q: Number(compact[1]), y: compact[2].length === 2 ? 2000 + Number(compact[2]) : Number(compact[2]) }
  const q = t.match(/\bq([1-4])\b/)?.[1] ?? t.match(/\b([1-4])q\b/)?.[1] ?? String(QWORD[t.match(/\b(first|second|third|fourth)\s+(fiscal\s+)?quarter/)?.[1] ?? ''] ?? '')
  const y = t.match(/\b(?:fy\s?)?(20\d\d)\b/)?.[1] ?? t.match(/\bfy\s?(\d\d)\b/)?.[1] ?? t.match(/\bq[1-4]\s?'?(\d\d)\b/)?.[1]
  if (!q || !y) return null
  return { q: Number(q), y: y.length === 2 ? 2000 + Number(y) : Number(y) }
}

const eventType = (title: string): IrEvent['type'] =>
  /earnings|results|quarter|q[1-4]\b/i.test(title) ? 'earnings' : /conference|summit|forum|fireside/i.test(title) ? 'conference' : /shareholder|annual meeting|investor day|capital markets/i.test(title) ? 'meeting' : 'other'

/* ---------- reader 1: Q4 Inc. feeds ---------- */

interface Q4Doc { DocumentPath?: string; DocumentTitle?: string; Title?: string; DocumentFileType?: string | null; Url?: string; Extension?: string | null; Headline?: string; LinkToDetailPage?: string; PressReleaseDate?: string }
interface Q4Report { ReportTitle: string; ReportSubType?: string; ReportYear?: number; ReportDate?: string; Documents: Q4Doc[] }
interface Q4Event {
  EventId: number; Title: string; StartDate: string; Body?: string; LinkToDetailPage?: string; LinkToUrl?: string; WebCastLink?: string
  Attachments?: Q4Doc[]; EventPresentation?: Q4Doc[]; EventPressRelease?: Q4Doc[]; EventFinancialReport?: Q4Report[]
}
interface Q4Release { PressReleaseId?: number; Headline: string; PressReleaseDate: string; LinkToDetailPage?: string; LinkToUrl?: string; ShortBody?: string; ShortDescription?: string; DocumentPath?: string }

/** Q4 dates look like "07/30/2026 14:00:00". */
const q4Date = (s?: string) => { const m = s?.match(/^(\d\d)\/(\d\d)\/(\d{4})(?: (\d\d:\d\d:\d\d))?/); return m ? `${m[3]}-${m[1]}-${m[2]}T${m[4] ?? '00:00:00'}` : null }

async function q4(origin: string): Promise<Omit<IrSite, 'url' | 'host' | 'fetchedAt'> | null> {
  const feed = (path: string, params: Record<string, string>) => {
    const u = new URL(`${origin}/feed/${path}`)
    for (const [k, v] of Object.entries({ LanguageId: '1', pageNumber: '0', tagList: '', includeTags: 'true', year: '-1', excludeSelection: '1', ...params })) u.searchParams.set(k, v)
    return u
  }
  const ev = await getJson<{ GetEventListResult: Q4Event[] }>(feed('Event.svc/GetEventList', { eventSelection: '3', eventDateFilter: '3', includeFinancialReports: 'true', includePresentations: 'true', includePressReleases: 'true', sortOperator: '1', pageSize: '16' }))
  if (!ev?.GetEventListResult) return null
  const [fr, pr] = await Promise.all([
    getJson<{ GetFinancialReportListResult: Q4Report[] }>(feed('FinancialReport.svc/GetFinancialReportList', { pageSize: '12' })),
    getJson<{ GetPressReleaseListResult: Q4Release[] }>(feed('PressRelease.svc/GetPressReleaseList', { bodyType: '0', pressReleaseDateFilter: '3', pageSize: '30' })),
  ])
  const abs = (p?: string) => (p ? new URL(p, origin + '/').href : '')
  const toDoc = (d: Q4Doc, fallback: string): IrDoc | null => {
    const url = abs(d.DocumentPath || d.Url || d.LinkToDetailPage)
    const title = (d.DocumentTitle || d.Title || d.Headline || fallback).trim().replace(/^(view|read|download|access)( the)? (\w)/i, (_m, _a, _b, c: string) => c.toUpperCase())
    return url ? { kind: kindOf(title, url), title, url, format: formatOf(url, d.DocumentFileType || d.Extension || '') } : null
  }
  const reports = fr?.GetFinancialReportListResult ?? []
  const used = new Set<Q4Report>()

  const events: IrEvent[] = ev.GetEventListResult.map((e) => {
    const docs: (IrDoc | null)[] = [
      ...(e.EventPressRelease ?? []).map((d) => { const x = toDoc(d, 'Press release'); return x && { ...x, kind: 'press-release' as const } }),
      ...(e.EventPresentation ?? []).map((d) => { const x = toDoc(d, 'Presentation'); return x && { ...x, kind: x.kind === 'other' ? 'slides' as const : x.kind } }),
      ...(e.Attachments ?? []).map((d) => toDoc(d, 'Attachment')),
      ...(e.EventFinancialReport ?? []).flatMap((r) => r.Documents.map((d) => toDoc(d, r.ReportTitle))),
      ...linksIn(e.Body ?? '', origin).map((l) => ({ kind: kindOf(l.text, l.url), title: l.text || 'Link', url: l.url, format: formatOf(l.url) })),
    ]
    if (e.WebCastLink) docs.push({ kind: 'webcast', title: 'Webcast', url: abs(e.WebCastLink), format: 'video' })
    // Quarterly results often live in the "financial reports" module rather than on the event itself.
    const p = periodOf(e.Title)
    const rep = p && reports.find((r) => !used.has(r) && samePeriod(periodOf(`${r.ReportTitle} ${r.ReportSubType ?? ''} ${r.ReportYear ?? ''}`), p))
    if (rep) { used.add(rep); rep.Documents.forEach((d) => docs.push(toDoc(d, rep.ReportTitle))) }
    const page = abs(e.LinkToUrl || e.LinkToDetailPage) || null
    return {
      id: `q4-${e.EventId}`, title: e.Title.trim(), date: q4Date(e.StartDate), type: eventType(e.Title), page,
      summary: textOf(e.Body ?? '').slice(0, 400) || null,
      documents: tidyDocs(docs.filter((d): d is IrDoc => !!d && (d.kind !== 'other' || d.format !== 'html'))),
    }
  })
  // Reports with no matching event (some companies only post documents) become events of their own.
  for (const r of reports) {
    if (used.has(r) || !periodOf(`${r.ReportTitle} ${r.ReportSubType ?? ''} ${r.ReportYear ?? ''}`)) continue
    events.push({ id: `q4r-${r.ReportTitle}`, title: r.ReportTitle, date: q4Date(r.ReportDate), type: 'earnings', page: null, summary: null, documents: tidyDocs(r.Documents.map((d) => toDoc(d, r.ReportTitle)).filter((d): d is IrDoc => !!d)) })
  }
  const releases: IrRelease[] = (pr?.GetPressReleaseListResult ?? []).map((r, i) => ({
    id: `q4pr-${r.PressReleaseId ?? i}`, title: r.Headline.trim(), date: q4Date(r.PressReleaseDate),
    url: abs(r.LinkToUrl || r.LinkToDetailPage || r.DocumentPath), summary: textOf(r.ShortBody || r.ShortDescription || '').slice(0, 300) || null,
  })).filter((r) => r.url)
  // Earnings releases published elsewhere (Apple posts them in its newsroom) still belong in the list.
  for (const e of events) for (const d of e.documents) {
    if (d.kind === 'press-release' && d.format === 'html' && !releases.some((r) => r.url === d.url)) releases.push({ id: `ev-${d.url}`, title: /^press release$/i.test(d.title) ? `${e.title}: press release` : d.title, date: e.date, url: d.url, summary: null })
  }
  const notes = ['Read through the site\'s Q4 Inc. data feeds.']
  if (!releases.length) notes.push('The site lists no press releases of its own.')
  return { platform: 'q4', events: sortEvents(events), releases: sortByDate(releases), notes }
}

const samePeriod = (a: { q: number; y: number } | null, b: { q: number; y: number }) => !!a && a.q === b.q && a.y === b.y

/* ---------- reader 2: Microsoft ---------- */

interface MsLink { Text: string; Url: string }
interface MsEvent { EventID: string; EventType: string; EventName: string; DateTime?: { UTC?: string }; Webcast?: string; RecentLinks?: { Link?: MsLink[] }; UpcomingLinks?: { Link?: MsLink[] }; Speaker?: { Name?: string } }

async function microsoft(u: URL): Promise<Omit<IrSite, 'url' | 'host' | 'fetchedAt'> | null> {
  const locale = u.pathname.match(/^\/([a-z]{2}-[a-z]{2})\//i)?.[1] ?? 'en-us'
  const html = await getText(new URL(`https://www.microsoft.com/${locale}/investor/events/default`))
  const raw = html.match(/eventsData="([^"]+)"/)?.[1]
  if (!raw) return null
  const data = JSON.parse(decodeEntities(raw)) as { Events: MsEvent[] }
  const abs = (p: string) => new URL(p, 'https://www.microsoft.com/').href
  const events: IrEvent[] = await Promise.all(data.Events.slice(0, 24).map(async (e) => {
    const links = [...(e.RecentLinks?.Link ?? []), ...(e.UpcomingLinks?.Link ?? [])]
    const docs = await Promise.all(links.map(async (l): Promise<IrDoc> => {
      let url = abs(l.Url)
      // Office's online viewer wraps the real file: unwrap it so the app can pick the right viewer.
      const wrapped = url.match(/officeapps\.live\.com\/op\/(?:view|embed)\.aspx\?src=(.+)$/)?.[1]
      if (wrapped) url = decodeURIComponent(wrapped)
      let type = ''
      if (/^https:\/\/(aka\.ms|go\.microsoft\.com)\//.test(url)) ({ url, type } = await resolve(url))
      const text = l.Text.trim()
      const kind: DocKind = /event website/i.test(text) ? 'press-release' : /powerpoint|slides/i.test(text) ? 'slides' : kindOf(text, url)
      const format = formatOf(url, type)
      // Microsoft serves Office files without an extension; the link text says what they are.
      return { kind, title: kind === 'press-release' ? 'Press release' : text, url, format: format === 'html' && kind === 'slides' ? 'pptx' : format === 'html' && kind === 'transcript' && /cdn-dynmedia/.test(url) ? 'docx' : format }
    }))
    if (e.Webcast && !docs.some((d) => d.kind === 'webcast')) docs.push({ kind: 'webcast', title: 'Webcast', url: abs(e.Webcast), format: 'video' })
    return {
      id: `ms-${e.EventID}`, title: e.EventName, date: e.DateTime?.UTC ? `${e.DateTime.UTC}Z` : null,
      type: e.EventType === 'Earnings' ? 'earnings' : e.EventType === 'Conferences' ? 'conference' : e.EventType === 'ShareholderMeeting' ? 'meeting' : 'other',
      page: e.Webcast ? abs(e.Webcast) : null, summary: e.Speaker?.Name ? `Speakers: ${e.Speaker.Name}` : null, documents: tidyDocs(docs),
    }
  }))
  const releases: IrRelease[] = events.filter((e) => e.type === 'earnings').flatMap((e) => e.documents.filter((d) => d.kind === 'press-release').map((d) => ({
    id: `ms-pr-${e.id}`, title: e.title.replace(/ Conference Call$/, '') + ' Release', date: e.date, url: d.url, summary: null,
  })))
  return { platform: 'microsoft', events: sortEvents(events), releases, notes: ['Read from the events list on Microsoft\'s investor pages.', 'Microsoft posts other press releases on news.microsoft.com, which this does not read yet.'] }
}

/* ---------- generic investor-relations source discovery ---------- */

/** Discover an IR entry point from a verified corporate homepage. The aggregator
 * does this once per issuer and the edge caches it; the shell stays generic. */
async function discover(home: URL): Promise<{url:string|null;discoveredFrom:string;confidence:'high'|'low';note?:string}> {
  const origin = home.origin
  // Prefer the actual company's home page; avoid fabricated ticker-specific paths.
  const html = await getText(home)
  const links = linksIn(html, home.href)
  const ranked = links.map(link => {
    let host = ''
    try { host = new URL(link.url).hostname } catch { return {...link,score:-999} }
    const text = `${link.text} ${link.url}`.toLowerCase()
    let score = 0
    if(/investor[s]? relations|investors|shareholder[s]?|investor center|investor information/.test(text))score+=12
    if(/quarterly results|financial results|earnings|financial reporting/.test(text))score+=5
    if(/investor|ir\.|investors\.|shareholder|financial-information/.test(host))score+=5
    if(/\/investor|\/shareholder|\/financials/.test(link.url.toLowerCase()))score+=3
    if(/linkedin|facebook|privacy|career|contact|support|login|product|service|investor faq/.test(text))score-=12
    if(host === home.hostname || host.endsWith('.'+home.hostname.replace(/^www\./,'')))score+=2
    return {...link,score}
  }).filter(x=>x.score>=8).sort((a,b)=>b.score-a.score)
  // Check the likely top candidates only; never crawl an entire company website.
  for(const candidate of ranked.slice(0,3)){
    const url=safeUrl(candidate.url)
    if(!url)continue
    try {
      const response=await polite(url)
      if(response.ok && (response.headers.get('content-type')||'').includes('html')) {
        response.body?.cancel().catch(()=>{})
        return {url:response.url||url.href,discoveredFrom:origin,confidence:'high'}
      }
      response.body?.cancel().catch(()=>{})
    }catch{/* try another IR candidate */}
  }
  return {url:null,discoveredFrom:origin,confidence:'low',note:'No verified investor relations entry point was found on the company website.'}
}

/* ---------- reader 3: any IR page ---------- */

async function generic(u: URL): Promise<Omit<IrSite, 'url' | 'host' | 'fetchedAt'>> {
  const notes: string[] = []
  const first = await getText(u)
  const pages = [{ url: u.href, html: first }]
  // Follow up to three same-site sections that usually hold results and news.
  const sections = linksIn(first, u.href).filter((l) => new URL(l.url).hostname === u.hostname && /events?|presentations?|news|press|results|quarterly|financial-information|earnings/i.test(`${l.text} ${l.url}`) && formatOf(l.url) === 'html')
  const seen = new Set([u.href])
  for (const s of sections) {
    if (pages.length >= 4) break
    if (seen.has(s.url)) continue
    seen.add(s.url)
    try { pages.push({ url: s.url, html: await getText(new URL(s.url)) }) } catch { /* skip pages we can't read */ }
  }
  const all = pages.flatMap((p) => linksIn(p.html, p.url))
  if (all.length < 15) notes.push('The page has very few links. It may build its content with JavaScript, which this reader does not run.')
  if (/q4cdn\.com|Powered[^<]{0,20}Q4/i.test(first)) notes.push('This looks like a Q4 Inc. site, but its data feeds did not answer.')
  if (/gcs-web\.com|notified|globenewswire/i.test(first)) notes.push('This site is hosted by Notified (GlobeNewswire); documents usually sit on their servers.')

  // Group document links by the quarter named in their text, address or nearby wording.
  const byPeriod = new Map<string, IrEvent>()
  const releases: IrRelease[] = []
  for (const l of all) {
    const kind = kindOf(l.text, l.url), format = formatOf(l.url)
    const p = periodOf(`${l.text} ${l.context} ${decodeURIComponent(l.url)}`)
    if (kind === 'other' || !p) {
      if (/news|press/i.test(l.url) && l.text.length > 30 && format === 'html' && !releases.some((r) => r.url === l.url)) releases.push({ id: `g-${releases.length}`, title: l.text, date: dateIn(l.context), url: l.url, summary: null })
      continue
    }
    const key = `${p.y}-Q${p.q}`
    const ev = byPeriod.get(key) ?? { id: `g-${key}`, title: `Q${p.q} ${p.y} results`, date: null, type: 'earnings' as const, page: null, summary: null, documents: [] }
    ev.documents.push({ kind, title: l.text || kind, url: l.url, format })
    ev.date ??= dateIn(l.context)
    byPeriod.set(key, ev)
    if (kind === 'press-release' && format === 'html' && !releases.some((r) => r.url === l.url)) releases.push({ id: `g-${releases.length}`, title: l.text, date: ev.date, url: l.url, summary: null })
  }
  const events = [...byPeriod.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, e]) => ({ ...e, documents: tidyDocs(e.documents) }))
  notes.unshift(`Read ${pages.length} page${pages.length > 1 ? 's' : ''} from the site and grouped their documents by quarter.`)
  return { platform: 'generic', events: events.slice(0, 16), releases: sortByDate(releases).slice(0, 40), notes }
}

/* ---------- site ---------- */

async function site(u: URL): Promise<IrSite> {
  const base = { url: u.href, host: u.hostname, fetchedAt: new Date().toISOString() }
  if (u.hostname === 'www.microsoft.com' && /\/investor/i.test(u.pathname)) {
    const ms = await microsoft(u).catch(() => null)
    if (ms) return { ...base, ...ms }
  }
  const viaQ4 = await q4(u.origin)
  if (viaQ4) return { ...base, ...viaQ4 }
  return { ...base, ...(await generic(u)) }
}

const sortEvents = (e: IrEvent[]) => e.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
const sortByDate = <T extends { date: string | null }>(x: T[]) => x.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

/* ---------- reading one press release or transcript page ---------- */

async function doc(u: URL) {
  const r = await polite(u)
  const ct = r.headers.get('content-type') ?? ''
  if (!ct.includes('html')) { r.body?.cancel().catch(() => {}); throw fail('This document is not a web page; open it as a file instead.', 415) }
  const html = await r.text()
  const body = mainContent(html)
  // A headline inside the article beats the page title, which on IR sites is often generic or stale.
  const lead = (re: RegExp) => { const t = textOf(body.match(re)?.[1] ?? ''); return t.length > 8 && t.length < 200 ? t : '' }
  const title = lead(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || lead(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i) || lead(/<(?:b|strong)\b[^>]*>([\s\S]*?)<\/(?:b|strong)>/i)
    || textOf(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').split(/ [-|–] /)[0]
  const clean = dropLeadingTitle(listify(sanitize(body, r.url || u.href)), title)
  const words = textOf(clean).split(/\s+/).length
  return { title, url: r.url || u.href, date: dateIn(textOf(body).slice(0, 600)), html: clean, words }
}

/** Paragraphs that start with a bullet character ("· Revenue was…") become a real list. */
export const listify = (html: string) => html
  .replace(/<p>\s*(?:[·•▪◦‧∙]|&#183;|&bull;)(?:\s|&nbsp;)*([\s\S]*?)<\/p>/gi, '<li>$1</li>')
  .replace(/(?:<li>[\s\S]*?<\/li>\s*)+/g, (run) => (/^<li>/.test(run) ? `<ul>${run}</ul>` : run))

/** The reader shows the headline above the text, so drop it when the article repeats it as its first line. */
function dropLeadingTitle(html: string, title: string) {
  const m = html.match(/^\s*(?:<p>\s*)*<(p|h1|h2|h3|b|strong)>([\s\S]*?)<\/\1>/)
  return m && textOf(m[2]).toLowerCase() === title.toLowerCase() ? html.slice(m.index! + m[0].length) : html
}

/** The element most likely to hold the article: known IR content containers, then <article>, then <main>. */
export function mainContent(html: string): string {
  const s = html.replace(/<!--[\s\S]*?-->/g, '')
  const markers = [
    /<(\w+)\b[^>]*\bid="pressreleasecontent"[^>]*>/i,
    /<(\w+)\b[^>]*\bclass="[^"]*\b(?:module_body|module-body|q4default|news-body|press-release-body|pagebody|article-body|xn-content|bw-release-story|release-body)\b[^"]*"[^>]*>/i,
    /<(article)\b[^>]*>/i,
    /<(main)\b[^>]*>/i,
    /<(body)\b[^>]*>/i,
  ]
  // Take the first (most specific) container with real text in it; otherwise whichever held the most.
  let best = '', bestLen = 0
  for (const re of markers) {
    const m = re.exec(s)
    if (!m) continue
    const inner = elementAt(s, m.index, m[1].toLowerCase())
    const len = textOf(inner).length
    if (len > 400) return inner
    if (len > bestLen) { best = inner; bestLen = len }
  }
  return best || s
}

/** Inner HTML of the element whose opening tag starts at `start`, matching nested tags of the same name. */
function elementAt(s: string, start: number, tag: string) {
  const open = s.indexOf('>', start) + 1
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  re.lastIndex = open
  let depth = 1, m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    depth += m[1] ? -1 : 1
    if (depth === 0) return s.slice(open, m.index)
  }
  return s.slice(open)
}

const KEEP = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'strong', 'b', 'em', 'i', 'u', 'sup', 'sub', 'br', 'hr', 'a', 'img', 'blockquote', 'figure', 'figcaption', 'caption'])
const DROP = /<(script|style|noscript|iframe|svg|form|button|nav|header|footer|aside|template|select|object|video|audio)\b[\s\S]*?<\/\1>/gi
const BLOCKISH = new Set(['div', 'section', 'center', 'dl', 'dd', 'dt', 'pre'])

/** Keeps the text structure of a page (paragraphs, headings, lists, tables, links, images) and drops everything else. */
export function sanitize(html: string, base: string): string {
  const s = html.replace(/<!--[\s\S]*?-->/g, '').replace(DROP, '')
  return s.replace(/<(\/?)([a-zA-Z][\w-]*)\b([^>]*)>/g, (_m, close: string, name: string, attrs: string) => {
    const tag = name.toLowerCase()
    if (BLOCKISH.has(tag)) return close ? '</p>' : '<p>'
    if (!KEEP.has(tag)) return ''
    if (close) return `</${tag}>`
    const attr = (k: string) => attrs.match(new RegExp(`\\b${k}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
    const v = (k: string) => { const m = attr(k); return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : '' }
    if (tag === 'a') {
      const href = v('href')
      try { const h = new URL(href, base); if (h.protocol === 'https:' || h.protocol === 'http:' || h.protocol === 'mailto:') return `<a href="${esc(h.href)}" target="_blank" rel="noopener noreferrer">` } catch { /* fall through */ }
      return '<a>'
    }
    if (tag === 'img') {
      try { const src = new URL(v('src') || v('data-src'), base); if (src.protocol !== 'https:') return ''; return `<img src="${esc(src.href)}" alt="${esc(v('alt'))}" loading="lazy">` } catch { return '' }
    }
    if (tag === 'td' || tag === 'th') { const cs = v('colspan'), rs = v('rowspan'); return `<${tag}${/^\d+$/.test(cs) ? ` colspan="${cs}"` : ''}${/^\d+$/.test(rs) ? ` rowspan="${rs}"` : ''}>` }
    return `<${tag}>`
  }).replace(/\s+/g, ' ').replace(/<p>(\s|&nbsp;|<br>)*<\/p>/gi, '').replace(/(<\/?p>\s*){3,}/gi, '<p>').trim()
}

/* ---------- small HTML helpers (Edge Functions have no DOM) ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', reg: '®', trade: '™', copy: '©' }
export const decodeEntities = (s: string) => s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m)
export const textOf = (html: string) => decodeEntities(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/** Every link on a page with its text and ~150 characters of wording around it (dates and quarters often sit there). */
export function linksIn(html: string, base: string) {
  const s = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
  const out: { url: string; text: string; context: string }[] = []
  for (const m of s.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].match(/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i)
    if (!href) continue
    let url: URL
    try { url = new URL(decodeEntities(href[2] ?? href[3] ?? ''), base) } catch { continue }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
    url.hash = ''
    const text = textOf(m[2]) || textOf(m[1].match(/\b(?:title|aria-label)\s*=\s*"([^"]*)"/i)?.[1] ?? '')
    const i = m.index ?? 0
    out.push({ url: url.href, text, context: textOf(s.slice(Math.max(0, i - 300), i + m[0].length + 200)).slice(0, 300) })
  }
  return out
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
/** First date written as "July 30, 2026", "30 Jul 2026", "2026-07-30" or "07/30/2026". */
export function dateIn(s: string): string | null {
  const pad = (n: number) => String(n).padStart(2, '0')
  let m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d\d)\b/i)
  if (m) return `${m[3]}-${pad(MONTHS.indexOf(m[1].toLowerCase()) + 1)}-${pad(Number(m[2]))}`
  m = s.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d\d)\b/i)
  if (m) return `${m[3]}-${pad(MONTHS.indexOf(m[2].toLowerCase()) + 1)}-${pad(Number(m[1]))}`
  m = s.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/)
  if (m) return `${m[3]}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`
  return null
}

/* ---------- PDFs from our own domain ---------- */

async function file(u: URL): Promise<Response> {
  const r = await polite(u, 'application/pdf,*/*;q=0.5')
  const ct = r.headers.get('content-type') ?? ''
  const size = Number(r.headers.get('content-length') ?? 0)
  if (!(ct.includes('pdf') || (/\.pdf$/i.test(u.pathname) && ct.includes('octet-stream')))) { r.body?.cancel().catch(() => {}); throw fail('Only PDF files can be shown here.', 415) }
  if (size > 40e6) { r.body?.cancel().catch(() => {}); throw fail('This file is too large to show here.', 413) }
  return new Response(r.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'inline',
      'cache-control': 'public, s-maxage=604800, stale-while-revalidate=604800',
      'x-content-type-options': 'nosniff',
      ...(size ? { 'content-length': String(size) } : {}),
    },
  })
}
