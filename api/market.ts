// Vercel Edge Function: earnings calendar and company profiles from Finnhub (finnhub.io, free key).
// GET /api/market?type=calendar&from=2026-10-01&to=2026-10-31[&symbol=AAPL] → earnings dates, timing, EPS and revenue estimates and actuals
// GET /api/market?type=profile&symbol=AAPL → logo, market cap, industry, country, website
// Set FINNHUB_API_KEY in Vercel. The free plan allows 60 requests a minute; responses are cached at the edge.
export const config = { runtime: 'edge' }

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const KEY = env.FINNHUB_API_KEY || ''

export default async function handler(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams
  if (!KEY) return json({ error: 'Finnhub is not set up (FINNHUB_API_KEY).' }, 0, 404)
  const symbol = (q.get('symbol') ?? '').toUpperCase()
  if (symbol && !/^[A-Z0-9.\-]{1,10}$/.test(symbol)) return json({ error: 'Invalid symbol' }, 0, 400)
  try {
    switch (q.get('type')) {
      case 'calendar': {
        const from = q.get('from') ?? '', to = q.get('to') ?? ''
        if (!/^\d{4}-\d\d-\d\d$/.test(from) || !/^\d{4}-\d\d-\d\d$/.test(to)) return json({ error: 'Missing from/to (YYYY-MM-DD)' }, 0, 400)
        return json(await calendar(from, to, symbol), 3600)
      }
      case 'profile':
        if (!symbol) return json({ error: 'Missing symbol' }, 0, 400)
        return json(await profile(symbol), 86400)
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

async function fh<T>(path: string, params: Record<string, string>): Promise<T> {
  const u = new URL(`https://finnhub.io/api/v1${path}`)
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
  u.searchParams.set('token', KEY)
  const r = await fetch(u)
  if (r.status === 429) throw Object.assign(new Error('Finnhub rate limit reached, try again in a minute.'), { status: 429 })
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Your Finnhub plan does not include this.'), { status: 403 })
  if (!r.ok) throw new Error(`Finnhub returned ${r.status}`)
  return r.json() as Promise<T>
}

interface FhEarning {
  symbol: string; date: string; hour: string; year: number; quarter: number
  epsActual: number | null; epsEstimate: number | null; revenueActual: number | null; revenueEstimate: number | null
}

async function calendar(from: string, to: string, symbol: string) {
  const r = await fh<{ earningsCalendar?: FhEarning[] }>('/calendar/earnings', { from, to, symbol })
  return {
    events: (r.earningsCalendar ?? []).map((e) => ({
      symbol: e.symbol, date: e.date, hour: e.hour || null, year: e.year, quarter: e.quarter,
      eps: { actual: e.epsActual ?? null, estimate: e.epsEstimate ?? null },
      revenue: { actual: e.revenueActual ?? null, estimate: e.revenueEstimate ?? null },
    })),
  }
}

async function profile(symbol: string) {
  const p = await fh<{ name?: string; ticker?: string; exchange?: string; country?: string; currency?: string; marketCapitalization?: number; logo?: string; weburl?: string; finnhubIndustry?: string }>('/stock/profile2', { symbol })
  if (!p.ticker) throw Object.assign(new Error('Finnhub has no profile for this company.'), { status: 404 })
  return {
    name: p.name ?? null, exchange: p.exchange ?? null, country: p.country ?? null, currency: p.currency ?? null,
    marketCap: p.marketCapitalization ? p.marketCapitalization * 1e6 : null, // Finnhub reports millions
    logo: p.logo || null, website: p.weburl || null, industry: p.finnhubIndustry || null,
  }
}
