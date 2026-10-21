// Vercel Edge Function: reads public SEC EDGAR data and returns it in the shape the app uses.
// GET /api/sec?type=tickers           → every US-listed company with a ticker and its exchange
// GET /api/sec?type=company&cik=320193 → profile, recent filings and quarterly financials
// GET /api/sec?type=exhibits&cik=320193&acc=0000320193-26-000010 → documents attached to one filing
// GET /sec-archive/<cik>/<acc>/<file> (rewritten to type=file) → a filing document served from our domain, so it can be shown in the app
// SEC asks automated clients to identify themselves and stay under 10 requests a second; responses are cached at the edge.
export const config = { runtime: 'edge' }

// SEC requires a contact address in the User-Agent; set SEC_CONTACT_EMAIL in Vercel to your own.
const UA = `SBW Research ${(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SEC_CONTACT_EMAIL ?? 'research@sbw-invest.com'}`
const DAY = 86400

export default async function handler(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams
  try {
    if (q.get('type') === 'tickers') return json(await tickers(), DAY)
    if (q.get('type') === 'company') {
      const cik = Number(q.get('cik'))
      if (!Number.isInteger(cik) || cik <= 0) return json({ error: 'Missing or invalid cik' }, 0, 400)
      return json(await company(cik), 3600)
    }
    if (q.get('type') === 'exhibits') {
      const cik = Number(q.get('cik')), acc = q.get('acc') ?? ''
      if (!Number.isInteger(cik) || cik <= 0 || !/^\d{10}-\d{2}-\d{6}$/.test(acc)) return json({ error: 'Missing or invalid cik/acc' }, 0, 400)
      return json(await exhibits(cik, acc), 30 * DAY)
    }
    if (q.get('type') === 'file') return file(q.get('path') ?? '')
    return json({ error: 'Unknown type' }, 0, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'SEC request failed' }, 0, 502)
  }
}

function json(body: unknown, maxAge: number, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': maxAge ? `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` : 'no-store' },
  })
}

async function sec<T>(url: string): Promise<T | null> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`SEC returned ${r.status}`)
  return r.json() as Promise<T>
}

/* ---------- tickers ---------- */

async function tickers() {
  // This list also names each company's exchange, which the earnings call source needs.
  const raw = await sec<{ data: [number, string, string, string | null][] }>('https://www.sec.gov/files/company_tickers_exchange.json')
  return (raw?.data ?? []).map(([cik, name, ticker, exchange]) => [cik, ticker, name, exchange ?? ''] as const)
}

/* ---------- company ---------- */

interface Submissions {
  cik: string; name: string; tickers: string[]; exchanges: string[]; sicDescription: string; fiscalYearEnd: string
  category: string; stateOfIncorporation: string; website?: string; investorWebsite?: string
  addresses?: { business?: { city?: string; stateOrCountry?: string } }
  filings: { recent: Record<'accessionNumber' | 'filingDate' | 'reportDate' | 'form' | 'primaryDocument' | 'primaryDocDescription' | 'items', string[]> }
}
interface Fact { start?: string; end: string; val: number; form: string; fy: number; fp: string; filed: string; frame?: string }
interface Facts { facts?: Record<string, Record<string, { units: Record<string, Fact[]> }>> }

const pad = (cik: number) => String(cik).padStart(10, '0')

async function company(cik: number) {
  const [sub, facts] = await Promise.all([
    sec<Submissions>(`https://data.sec.gov/submissions/CIK${pad(cik)}.json`),
    sec<Facts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(cik)}.json`),
  ])
  if (!sub) throw new Error('Company not found at SEC')
  const r = sub.filings.recent
  const filings = r.accessionNumber.slice(0, 200).map((acc, i) => ({
    form: r.form[i],
    filed: r.filingDate[i],
    period: r.reportDate[i] || null,
    title: r.primaryDocDescription[i] || r.form[i],
    items: r.items[i] || '',
    acc,
    url: `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}/${r.primaryDocument[i]}`,
    index: `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}/`,
  }))
  return {
    cik,
    name: sub.name,
    tickers: sub.tickers,
    exchanges: sub.exchanges,
    industry: sub.sicDescription,
    fiscalYearEnd: sub.fiscalYearEnd,
    category: sub.category,
    state: sub.stateOfIncorporation,
    city: sub.addresses?.business ? [sub.addresses.business.city, sub.addresses.business.stateOrCountry].filter(Boolean).join(', ') : null,
    website: sub.website || sub.investorWebsite || null,
    filings,
    financials: facts ? financials(facts) : null,
  }
}

const REVENUE = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'TotalRevenuesAndOtherIncome']
const METRICS: { key: string; tags: string[]; unit: string }[] = [
  { key: 'revenue', tags: REVENUE, unit: 'USD' },
  { key: 'operatingIncome', tags: ['OperatingIncomeLoss'], unit: 'USD' },
  { key: 'netIncome', tags: ['NetIncomeLoss', 'ProfitLoss'], unit: 'USD' },
  { key: 'eps', tags: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'], unit: 'USD/shares' },
]

/** Last 8 fiscal quarters per metric. Fourth quarters are rarely filed on their own, so they are derived as full year minus Q1–Q3. */
function financials(f: Facts) {
  const gaap = f.facts?.['us-gaap'] ?? {}
  const out: Record<string, { end: string; label: string; value: number; derived?: boolean }[]> = {}
  for (const m of METRICS) {
    // Use the first tag that has recent quarterly data; companies switch tags over time.
    let best: { end: string; label: string; value: number; derived?: boolean }[] = []
    for (const tag of m.tags) {
      const series = quarterly(gaap[tag]?.units[m.unit] ?? [], m.key === 'eps')
      if (series.length && (!best.length || series[series.length - 1].end > best[best.length - 1].end)) best = series
    }
    out[m.key] = best.slice(-8)
  }
  return out
}

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5

function quarterly(facts: Fact[], perShare: boolean) {
  const q = new Map<string, Fact>()
  const y = new Map<string, Fact>()
  const labelFrom = new Map<string, Fact>()
  for (const x of facts) {
    if (!x.start || !/^10-[QK]/.test(x.form)) continue
    const d = days(x.start, x.end)
    const bucket = d > 80 && d < 100 ? q : d > 350 && d < 380 ? y : null
    if (!bucket) continue
    const prev = bucket.get(x.end)
    if (!prev || x.filed > prev.filed) bucket.set(x.end, x) // latest filing wins (restatements)
    // The filing that first reported a period names its fiscal quarter; later filings repeat it as a comparative.
    const lp = labelFrom.get(x.end)
    if (!lp || x.filed < lp.filed) labelFrom.set(x.end, x)
  }
  const fiscal = (end: string, fallbackQ: string) => {
    const x = labelFrom.get(end)
    const fp = x && /^Q[1-3]$/.test(x.fp) ? x.fp : x?.fp === 'FY' ? 'Q4' : fallbackQ
    return x ? `${fp} FY${x.fy}` : quarterLabel(end)
  }
  const rows = [...q.values()].map((x) => ({ end: x.end, start: x.start!, value: x.val, derived: false }))
  if (!perShare) {
    for (const a of y.values()) {
      if (q.has(a.end)) continue
      const inside = rows.filter((r) => r.start >= a.start! && r.end < a.end)
      if (inside.length === 3) rows.push({ end: a.end, start: inside.sort((m, n) => n.end.localeCompare(m.end))[0].end, value: a.val - inside.reduce((s, r) => s + r.value, 0), derived: true })
    }
  }
  return rows
    .sort((a, b) => a.end.localeCompare(b.end))
    .map((r) => ({ end: r.end, label: fiscal(r.end, 'Q4'), value: r.value, ...(r.derived ? { derived: true } : {}) }))
}

function quarterLabel(end: string) {
  const d = new Date(end + 'T00:00:00Z')
  const shifted = new Date(d.getTime() - 15 * 864e5) // periods ending in the first days of a month belong to the prior month
  return `Q${Math.floor(shifted.getUTCMonth() / 3) + 1} ${shifted.getUTCFullYear()}`
}

/* ---------- one filing's documents ---------- */

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/** Reads the filing index page and lists each attached document (EX-99.1 is usually the press release, EX-99.2 often the slides). */
async function exhibits(cik: number, acc: string) {
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}/`
  const r = await fetch(`${base}${acc}-index.htm`, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`SEC returned ${r.status}`)
  const html = await r.text()
  const table = html.match(/<table[^>]*summary="Document Format Files"[^>]*>([\s\S]*?)<\/table>/i)?.[1]
    ?? html.match(/<table[^>]*class="tableFile"[^>]*>([\s\S]*?)<\/table>/i)?.[1] ?? ''
  const docs: { seq: string; description: string; name: string; type: string; size: string; path: string }[] = []
  for (const row of table.split(/<tr[^>]*>/i).slice(1)) {
    const cells = row.split(/<td[^>]*>/i).slice(1).map((c) => c.split(/<\/td>/i)[0])
    const href = row.match(/href="([^"]+)"/i)?.[1]
    if (cells.length < 4 || !href) continue
    const name = href.split('/').pop()!.replace(/^ix\?doc=.*\//, '')
    docs.push({ seq: text(cells[0]), description: text(cells[1]), name, type: text(cells[3]), size: text(cells[4] ?? ''), path: `${cik}/${acc.replace(/-/g, '')}/${name}` })
  }
  return docs.filter((d) => d.name && !/\.(txt|xsd|xml)$/i.test(d.name))
}

/** Serves an archived SEC document from our own domain. Scripts are blocked; filings never need them. */
async function file(path: string) {
  if (!/^\d{1,10}\/\d{18}\/[\w.\-]+$/.test(path)) return json({ error: 'Invalid path' }, 0, 400)
  const r = await fetch(`https://www.sec.gov/Archives/edgar/data/${path}`, { headers: { 'User-Agent': UA } })
  if (!r.ok) return json({ error: `SEC returned ${r.status}` }, 0, r.status === 404 ? 404 : 502)
  const type = r.headers.get('content-type') ?? 'application/octet-stream'
  const headers: Record<string, string> = {
    'content-type': type,
    'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable', // filed documents never change
    'x-content-type-options': 'nosniff',
  }
  // HTML filings get scripts blocked; PDFs are left alone because browsers won't display PDFs in a sandbox.
  if (/html/i.test(type)) headers['content-security-policy'] = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src data:"
  return new Response(r.body, { headers })
}
