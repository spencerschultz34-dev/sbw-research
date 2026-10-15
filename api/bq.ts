// Vercel Edge Function: consensus estimates and revenue by segment from Business Quant (businessquant.com).
// GET /api/bq?type=estimates&ticker=AAPL → quarterly and annual revenue and EPS: consensus, high, low, reported
// GET /api/bq?type=segments&ticker=AAPL  → latest fiscal year's revenue by segment, product and geography
// Set BUSINESSQUANT_API_KEY in Vercel. The free preview covers AAPL only; other tickers need a paid plan.
export const config = { runtime: 'edge' }

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const KEY = env.BUSINESSQUANT_API_KEY || ''

export default async function handler(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams
  const ticker = (q.get('ticker') ?? '').toUpperCase()
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) return json({ error: 'Missing or invalid ticker' }, 0, 400)
  if (!KEY) return json({ error: 'Business Quant is not set up (BUSINESSQUANT_API_KEY).' }, 0, 404)
  try {
    if (q.get('type') === 'estimates') return json(await estimates(ticker), 6 * 3600)
    if (q.get('type') === 'segments') return json(await segments(ticker), 24 * 3600)
    return json({ error: 'Unknown type' }, 0, 400)
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

interface Meta { ticker?: string; message?: string; notes?: string; note?: string }

async function bq<T extends { metadata?: Meta }>(path: string, params: Record<string, string>, ticker: string): Promise<T> {
  const u = new URL(`https://data.businessquant.com${path}`)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  u.searchParams.set('ticker', ticker)
  u.searchParams.set('api_key', KEY)
  const r = await fetch(u)
  if (r.status === 404) throw Object.assign(new Error('Business Quant has no data for this company.'), { status: 404 })
  if (!r.ok) throw Object.assign(new Error(`Business Quant returned ${r.status}`), { status: 502 })
  const body = (await r.json()) as T
  // The free preview answers every ticker with Apple's data, so check we got the company we asked for.
  if (body.metadata?.ticker && body.metadata.ticker.toUpperCase() !== ticker) {
    throw Object.assign(new Error('This company needs a paid Business Quant plan (the free preview covers Apple only).'), { status: 403 })
  }
  return body
}

/* ---------- estimates ---------- */

interface Est { period: string; period_end_date: string; data_type: 'reported' | 'estimate'; value_estimate: number | null; value_reported: number | null; high_estimate: number | null; low_estimate: number | null }
interface EstBody { metadata?: Meta; data?: { dimension: string; estimates: Est[] }[]; quarter_estimates?: Est[]; annual_estimates?: Est[] }

const pick = (b: EstBody, dim: 'quarter' | 'annual') => b.data?.find((d) => d.dimension.toLowerCase() === dim)?.estimates ?? (dim === 'quarter' ? b.quarter_estimates : b.annual_estimates) ?? []

async function estimates(ticker: string) {
  const [rev, eps] = await Promise.all([bq<EstBody>('/estimates', { mode: 'revenue' }, ticker), bq<EstBody>('/estimates', { mode: 'eps' }, ticker)])
  const merge = (dim: 'quarter' | 'annual') => {
    const e = new Map(pick(eps, dim).map((x) => [x.period_end_date, x]))
    return pick(rev, dim).map((r) => {
      const p = e.get(r.period_end_date)
      const row = (x?: Est) => (x ? { estimate: x.value_estimate, reported: x.value_reported, high: x.high_estimate, low: x.low_estimate } : null)
      return { period: r.period.replace(/^Q(\d) (\d\d)$/, 'Q$1 FY$2'), end: r.period_end_date, reported: r.data_type === 'reported', revenue: row(r), eps: row(p) }
    })
  }
  return { ticker, quarters: merge('quarter'), years: merge('annual') }
}

/* ---------- segments ---------- */

interface SegBody { metadata?: Meta; data?: { category: string; data: { period: string; subcategory: string; value: number }[] }[] }

async function segments(ticker: string) {
  const b = await bq<SegBody>('/segments', { series: 'Revenue', mode: 'latest' }, ticker)
  const groups = (b.data ?? [])
    .filter((g) => !/consolidation/i.test(g.category) && g.data.length > 1)
    .map((g) => ({ name: g.category, period: g.data[0]?.period ?? null, items: g.data.filter((x) => x.value > 0).map((x) => ({ name: x.subcategory, value: x.value })).sort((x, y) => y.value - x.value) }))
  return { ticker, groups }
}
