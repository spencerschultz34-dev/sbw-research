import { COMPANIES, companyById, hasCompany, idFor, setUnknownCompanyHandler, upsertCompany } from './companies'
import type { ActivityItem, CompanyEvent, Metric, Mention, PressRelease, ReportDoc, Transcript } from './types'
import {
  archiveUrl, callExchange, isEarnings, loadCallList, loadCompany, loadExhibits, loadTickers, loadTranscript, secAvailable, titleCase,
  type CallEvent, type SecDoc, type SecFiling,
} from '../sec'

export { COMPANIES, companyById }

// Real data, loaded on demand from the app's server functions:
//   /api/sec     SEC EDGAR: company profile, filings, 8-K earnings releases and slides
//   /api/calls   EarningsCall (audio + timed transcripts), Alpha Vantage fallback (transcripts)
//   /api/market  Finnhub: earnings calendar with estimates, logos and market cap
// Screens read the arrays below synchronously and re-render when `subscribe` fires.

export const TODAY = new Date()

export const EVENTS: CompanyEvent[] = []
export const eventById = (id: string) => {
  const e = EVENTS.find((x) => x.id === id)
  if (!e && id.includes('~')) void ensureCompany(id.split('~')[0])
  return e
}
export const eventsForCompany = (cid: string) => EVENTS.filter((e) => e.companyId === cid)

// No live calls without a live source (Quartr); kept so the player and panels keep one shape.
export const LIVE_OFFSET_SEC = 0

// Press releases come from the SEC 8-K on each event; mentions need stored transcripts (not built yet).
export const PRESS_RELEASES: PressRelease[] = []
export const MENTIONS: Mention[] = []

/* ---------- change notifications ---------- */

const listeners = new Set<() => void>()
let version = 0
let queued = false
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const getVersion = () => version
function changed() {
  if (queued) return
  queued = true
  setTimeout(() => { queued = false; version++; listeners.forEach((f) => f()) }, 30)
}

/* ---------- loading state ---------- */

const status = new Map<string, 'loading' | 'done' | 'error'>()
export const companyStatus = (id: string) => status.get(id)
const inflight = new Map<string, Promise<void>>()
const filingsFor = new Map<string, SecFiling[]>()

/** Loads a company's profile and events once; later calls return the same promise. */
export function ensureCompany(id: string): Promise<void> {
  if (!id || !secAvailable) return Promise.resolve()
  let p = inflight.get(id)
  if (!p) {
    status.set(id, 'loading')
    p = limit(() => hydrate(id)).then(() => { status.set(id, 'done') }, () => { status.set(id, 'error') }).finally(changed)
    inflight.set(id, p)
  }
  return p
}
export const ensureCompanies = (ids: string[]) => Promise.all(ids.map(ensureCompany))
setUnknownCompanyHandler((id) => { void ensureCompany(id); changed() })

// A few companies at a time keeps the SEC (10 requests a second) and the free keys happy.
let running = 0
const waiting: (() => void)[] = []
async function limit<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 3) await new Promise<void>((r) => waiting.push(r))
  running++
  try { return await fn() } finally { running--; waiting.shift()?.() }
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url)
    if (!r.ok || !r.headers.get('content-type')?.includes('json')) return null
    return (await r.json()) as T
  } catch { return null }
}

interface Profile { name: string | null; marketCap: number | null; logo: string | null; industry: string | null; country: string | null; currency: string | null }
interface CalRow { symbol: string; date: string; hour: string | null; year: number; quarter: number; eps: { actual: number | null; estimate: number | null }; revenue: { actual: number | null; estimate: number | null } }

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5)
/** Date-only values become a time on that day in US hours, so they don't shift a day when shown in Chicago time. */
const at = (date: string, hour?: string | null) => (date.length > 10 ? new Date(date).toISOString() : `${date}T${hour === 'amc' ? '21:05' : '12:00'}:00.000Z`)
const near = (a: string, b: string, days: number) => Math.abs(Date.parse(a) - Date.parse(b)) <= days * 864e5

async function hydrate(id: string) {
  const ticker = id.toUpperCase()
  const list = await loadTickers()
  const row = list.find((t) => t[1] === ticker)
  if (!row) return // not listed with the SEC
  const [cik, , name, exchange] = row
  upsertCompany(id, { name: titleCase(name), cik, exchange: exchange || undefined })

  const [sec, profile] = await Promise.all([
    loadCompany(cik).catch(() => null),
    getJson<Profile>(`/api/market?type=profile&symbol=${encodeURIComponent(ticker)}`),
  ])
  if (sec) {
    filingsFor.set(id, sec.filings)
    upsertCompany(id, { name: titleCase(sec.name), industry: sec.industry, fye: sec.fiscalYearEnd || '1231', exchange: sec.exchanges[0] ?? exchange ?? undefined })
  }
  if (profile) {
    upsertCompany(id, {
      logo: profile.logo ?? undefined,
      industry: profile.industry ?? companyById(id).industry,
      marketCap: profile.marketCap ? `${fmtCap(profile.marketCap)} ${profile.currency ?? 'USD'}` : '',
      country: profile.country ?? 'US',
    })
  }
  changed()

  const c = companyById(id)
  const exch = callExchange(c.exchange)
  const [calls, cal] = await Promise.all([
    exch ? loadCallList(ticker, exch, c.fye).catch(() => ({ source: '', events: [] as CallEvent[] })) : Promise.resolve({ source: '', events: [] as CallEvent[] }),
    getJson<{ events: CalRow[] }>(`/api/market?type=calendar&symbol=${encodeURIComponent(ticker)}&from=${ymd(addDays(TODAY, -730))}&to=${ymd(addDays(TODAY, 180))}`),
  ])
  for (const e of calls.events) addCall(id, ticker, exch, calls.source, e)
  for (const r of cal?.events ?? []) addCalendarRow(id, r)
  // Earnings releases filed with the SEC (8-K Item 2.02) that no call or calendar row covers yet.
  const earningsFilings = (sec?.filings ?? []).filter(isEarnings)
  for (const f of earningsFilings.slice(0, 12)) attachFiling(id, cik, f)
  // First-party recordings can lack an event date. Match them to a specific
  // reported fiscal quarter and actual SEC earnings filing, rather than dropping them.
  for (const call of calls.events.filter(x => x.published && !x.date)) {
    const end = fiscalQuarterEnd(call.year, call.quarter, c.fye || '1231')
    const matches = earningsFilings.filter(f => {
      const days = (Date.parse(f.filed) - end.getTime()) / 864e5
      return days >= -2 && days <= 75
    }).sort((a, b) => Math.abs(Date.parse(a.filed) - end.getTime() - 28 * 864e5) - Math.abs(Date.parse(b.filed) - end.getTime() - 28 * 864e5))
    const filing = matches[0]
    if (!filing) continue
    const event = eventNear(id, at(filing.filed), `Q${call.quarter} ${call.year}`)
    event.title = `Q${call.quarter} ${call.year}`
    event.call = { symbol: ticker, exchange: exch, year: call.year, quarter: call.quarter }
    event.hasAudio = calls.source === 'SBW' || calls.source === 'EarningsCall'
  }
  c.hasEstimates = eventsForCompany(id).some((e) => e.metrics?.length)
  sortEvents()
}

const fmtCap = (v: number) => (v >= 1e12 ? `${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `${(v / 1e9).toFixed(0)}B` : `${(v / 1e6).toFixed(0)}M`)

function blankEvent(cid: string, date: string, title: string): CompanyEvent {
  const status = Date.parse(date) > TODAY.getTime() ? 'upcoming' : 'past'
  return { id: `${cid}~${date.slice(0, 10)}`, companyId: cid, title, type: 'Earnings', date, status, durationSec: 3600, reports: [], hasAudio: false }
}

/** The event for this company within a few days of `date`, or a new one. Calls, calendar rows and filings meet here. */
function eventNear(cid: string, date: string, title: string) {
  const hit = EVENTS.find((e) => e.companyId === cid && e.type === 'Earnings' && near(e.date, date, 4))
  if (hit) return hit
  const e = blankEvent(cid, date, title)
  EVENTS.push(e)
  return e
}

/** Quarter end derived from the issuer's fiscal-year end; used only to pair
 * undated stored recordings with the actual filed earnings announcement. */
function fiscalQuarterEnd(year: number, quarter: number, fye: string): Date {
  const mm = Number(fye.slice(0, 2)) || 12
  const dd = Number(fye.slice(2)) || 31
  const end = new Date(Date.UTC(year, mm - 1, dd, 12))
  end.setUTCMonth(end.getUTCMonth() - 3 * (4 - quarter))
  return end
}

function addCall(cid: string, symbol: string, exchange: string, source: string, c: CallEvent) {
  if (!c.date) return
  const date = at(c.date)
  const e = eventNear(cid, date, `Q${c.quarter} ${c.year}`)
  e.title = `Q${c.quarter} ${c.year}`
  if (c.date.length > 10) e.date = date // EarningsCall has the actual call time
  e.status = Date.parse(e.date) > TODAY.getTime() ? 'upcoming' : 'past'
  if (c.published) {
    e.call = { symbol, exchange, year: c.year, quarter: c.quarter }
    e.hasAudio = source === 'EarningsCall' || source === 'SBW'
  }
  if (c.eps?.estimate != null) setMetric(e, { label: 'EPS', estimate: c.eps.estimate, actual: c.eps.actual ?? undefined, unit: '' })
}

function addCalendarRow(cid: string, r: CalRow) {
  const e = eventNear(cid, at(r.date, r.hour), `Q${r.quarter} ${r.year}`)
  if (!e.call) e.title = `Q${r.quarter} ${r.year}`
  if (e.status === 'upcoming') {
    e.date = at(r.date, r.hour)
    e.reportTiming = r.hour === 'bmo' ? 'Premarket' : r.hour === 'amc' ? 'Aftermarket' : undefined
    e.estimated = !r.hour
  }
  if (r.revenue.estimate != null) setMetric(e, { label: 'Revenue', estimate: r.revenue.estimate / 1e9, actual: r.revenue.actual != null ? r.revenue.actual / 1e9 : undefined, unit: 'B' })
  if (r.eps.estimate != null) setMetric(e, { label: 'EPS', estimate: r.eps.estimate, actual: r.eps.actual ?? undefined, unit: '' })
}

function setMetric(e: CompanyEvent, m: Metric) {
  const list = e.metrics ?? []
  const i = list.findIndex((x) => x.label === m.label)
  if (i >= 0) list[i] = { ...list[i], ...m, actual: m.actual ?? list[i].actual }
  else list.push(m)
  e.metrics = list.sort((a, b) => (a.label === 'Revenue' ? -1 : b.label === 'Revenue' ? 1 : 0))
}

function attachFiling(cid: string, cik: number, f: SecFiling) {
  const e = eventNear(cid, at(f.filed), `Results ${f.filed.slice(0, 7)}`)
  e.filing ??= { cik, acc: f.acc, url: f.url }
}

/** Upcoming events need last year's figure for the "change" column; past ones show beat/miss. */
function sortEvents() {
  EVENTS.sort((a, b) => b.date.localeCompare(a.date))
  for (const e of EVENTS) {
    if (e.status !== 'upcoming' || !e.metrics) continue
    const yearAgo = EVENTS.find((x) => x.companyId === e.companyId && x.status === 'past' && near(x.date, addDays(new Date(e.date), -365).toISOString(), 30))
    e.metrics = e.metrics.map((m) => ({ ...m, prior: yearAgo?.metrics?.find((x) => x.label === m.label)?.actual ?? m.prior }))
  }
}

/* ---------- market-wide calendar (Finnhub) ---------- */

const calRanges = new Set<string>()
/** Adds every US company's earnings dates between two days. Companies only join the pick lists once followed. */
export async function loadCalendar(from: Date, to: Date) {
  const k = `${ymd(from)}_${ymd(to)}`
  if (calRanges.has(k) || !secAvailable) return
  calRanges.add(k)
  const [cal, list] = await Promise.all([
    getJson<{ events: CalRow[] }>(`/api/market?type=calendar&from=${ymd(from)}&to=${ymd(to)}`),
    loadTickers(),
  ])
  if (!cal) return
  const names = new Map(list.map((t) => [t[1], t[2]]))
  for (const r of cal.events) {
    const name = names.get(r.symbol)
    if (!name) continue // only companies listed with the SEC
    const id = idFor(r.symbol)
    if (!hasCompany(id)) upsertCompany(id, { name: titleCase(name) }, false)
    addCalendarRow(id, r)
  }
  sortEvents()
  changed()
}

/* ---------- transcripts and documents, loaded when opened ---------- */

const transcriptLoads = new Map<string, Promise<void>>()
export function ensureTranscript(eventId: string): Promise<void> {
  const e = EVENTS.find((x) => x.id === eventId)
  if (!e?.call || e.transcript) return Promise.resolve()
  let p = transcriptLoads.get(eventId)
  if (!p) {
    const { symbol, exchange, year, quarter } = e.call
    p = loadTranscript(symbol, exchange, year, quarter)
      .then((t) => {
        const speakerKeys = Object.keys(t.speakers)
        const speakers = speakerKeys.map((k) => {
          const s = t.speakers[k]
          return { name: s.name, role: s.title, isOperator: /operator/i.test(s.name), isAnalyst: /analyst/i.test(s.title) }
        })
        let chapter = 0
        const paragraphs = t.paragraphs.map((p, i) => {
          if (p.id === t.qnaStart) chapter = 1
          return { id: p.id, speaker: Math.max(0, speakerKeys.indexOf(p.speaker)), start: p.start ?? i, text: p.sentences.map((s) => s.text).join(' '), chapter, sents: p.sentences }
        })
        const qna = paragraphs.find((p) => p.id === t.qnaStart)
        const tr: Transcript = {
          speakers, paragraphs, qnaStart: qna?.start ?? 0, timed: t.timed, source: t.source,
          chapters: [{ title: 'Prepared remarks', start: 0 }, ...(qna ? [{ title: 'Q&A', start: qna.start }] : [])],
        }
        e.transcript = tr
        e.hasAudio = t.audio && t.timed
        if (t.timed) {
          const last = t.paragraphs.at(-1)?.sentences.at(-1)?.t
          if (last) e.durationSec = Math.ceil(last + 30)
        }
        e.transcriptError = undefined
      })
      .catch((err: Error) => { e.transcriptError = err.message; transcriptLoads.delete(eventId) })
      .finally(changed)
    transcriptLoads.set(eventId, p)
  }
  return p
}

function docKind(d: SecDoc): ReportDoc['kind'] {
  const t = `${d.type} ${d.description}`.toLowerCase()
  if (/presentation|slides|supplement|investor/.test(t) || (d.type === 'EX-99.2' && /\.pdf$/i.test(d.name))) return 'Slides'
  if (/press release|earnings release|news release|results/.test(t) || d.type === 'EX-99.1') return 'Earnings release'
  return 'Report'
}

const reportLoads = new Map<string, Promise<void>>()
export function ensureReports(eventId: string): Promise<void> {
  const e = EVENTS.find((x) => x.id === eventId)
  if (!e?.filing || e.reports.length) return Promise.resolve()
  let p = reportLoads.get(eventId)
  if (!p) {
    const { cik, acc, url } = e.filing
    p = loadExhibits(cik, acc)
      .then((docs) => {
        const useful = docs.filter((d) => /^EX-99/.test(d.type) || /\.pdf$/i.test(d.name))
        e.reports = useful.map((d, i) => {
          const kind = docKind(d)
          return { id: `${acc}-${i}`, kind, form: d.type.replace('EX-', 'Ex '), title: kind === 'Report' ? d.description || d.name : kind === 'Slides' ? 'Presentation' : 'Press release', pages: [{ blocks: [] }], url: archiveUrl(d.path) }
        })
        if (!e.reports.length) e.reports = [{ id: `${acc}-8k`, kind: 'Report', form: '8-K', title: 'Current report', pages: [{ blocks: [] }], url }]
      })
      .catch(() => { reportLoads.delete(eventId) })
      .finally(changed)
    reportLoads.set(eventId, p)
  }
  return p
}

/* ---------- home feed ---------- */

export function activityFeed(): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const e of EVENTS) {
    if (e.status === 'upcoming') continue
    const age = (TODAY.getTime() - new Date(e.date).getTime()) / 864e5
    if (age > 30) continue
    const base = { companyId: e.companyId, eventId: e.id }
    if (e.filing) items.push({ ...base, id: `${e.id}-rel`, label: `Earnings release - ${e.title}`, docType: 'report', date: e.date, openTab: 'report' })
    if (e.call) items.push({ ...base, id: `${e.id}-call`, label: `${e.hasAudio ? 'Audio & transcript' : 'Transcript'} - ${e.title}`, docType: e.hasAudio ? 'audio' : 'transcript', date: new Date(Date.parse(e.date) + 3600e3).toISOString(), openTab: 'transcript' })
  }
  return items.sort((a, b) => b.date.localeCompare(a.date))
}

export const RELEASE_NOTES = [
  { date: '21 Oct 2026', title: 'Real companies only', body: 'The sample companies are gone. Every company, event, transcript and filing now comes from the SEC, EarningsCall and Finnhub.' },
]
