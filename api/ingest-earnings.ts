// Secure Vercel Edge endpoint for scheduled earnings calendar ingestion.
export const config = { runtime: 'edge' }
type Earning = { symbol: string; date: string; hour?: string; year: number; quarter: number; epsActual?: number | null; epsEstimate?: number | null; revenueActual?: number | null; revenueEstimate?: number | null }
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return reply(405, { error: 'Method not allowed' })
  if (!env.CRON_SECRET || req.headers.get('authorization') !== 'Bearer ' + env.CRON_SECRET) return reply(401, { error: 'Unauthorized' })
  const base = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY, token = env.FINNHUB_API_KEY
  if (!base || !key || !token) return reply(503, { error: 'Server configuration incomplete' })
  async function write(table: string, data: unknown, conflict?: string): Promise<any[]> {
    const suffix = conflict ? '?on_conflict=' + conflict : ''
    const r = await fetch(base!.replace(/\/$/, '') + '/rest/v1/' + table + suffix, {
      method: 'POST',
      headers: { apikey: key!, authorization: 'Bearer ' + key!, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(data)
    })
    if (!r.ok) throw new Error(table + ' write failed (' + r.status + '): ' + (await r.text()).slice(0, 200))
    return r.json()
  }
  async function finish(id: string, status: string, count: number, error?: string) {
    await fetch(base!.replace(/\/$/, '') + '/rest/v1/ingestion_runs?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { apikey: key!, authorization: 'Bearer ' + key!, 'content-type': 'application/json' },
      body: JSON.stringify({ status, records_processed: count, finished_at: new Date().toISOString(), error_message: error || null })
    })
  }
  let runId = ''
  try {
    runId = (await write('ingestion_runs', { source: 'finnhub', status: 'started' }))[0].id
    const from = new Date(), to = new Date(from.getTime() + 30 * 86400000)
    const url = new URL('https://finnhub.io/api/v1/calendar/earnings')
    url.searchParams.set('from', from.toISOString().slice(0, 10))
    url.searchParams.set('to', to.toISOString().slice(0, 10))
    url.searchParams.set('token', token)
    const api = await fetch(url)
    if (!api.ok) throw new Error('Finnhub request failed (' + api.status + ')')
    const feed = await api.json() as { earningsCalendar?: Earning[] }
    const rows = (feed.earningsCalendar || []).filter(e =>
      /^[A-Z0-9.-]{1,20}$/.test(e.symbol) && /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
      Number.isInteger(e.year) && Number.isInteger(e.quarter) && e.quarter >= 1 && e.quarter <= 4)
    const tickers = Array.from(new Set(rows.map(e => e.symbol)))
    const companyIds = new Map<string, string>()
    for (let i = 0; i < tickers.length; i += 100) {
      const companies = await write('companies', tickers.slice(i, i + 100).map(ticker => ({ ticker })), 'ticker') as { id: string; ticker: string }[]
      companies.forEach(c => companyIds.set(c.ticker, c.id))
    }
    const byQuarter = new Map<string, Earning>()
    rows.forEach(e => byQuarter.set(e.symbol + ':' + e.year + ':' + e.quarter, e))
    const events = Array.from(byQuarter.values()).map(e => ({
      company_id: companyIds.get(e.symbol), source: 'finnhub', fiscal_year: e.year, fiscal_quarter: e.quarter,
      event_date: e.date, event_hour: e.hour || null, eps_actual: e.epsActual ?? null,
      eps_estimate: e.epsEstimate ?? null, revenue_actual: e.revenueActual ?? null,
      revenue_estimate: e.revenueEstimate ?? null, updated_at: new Date().toISOString()
    })).filter(e => e.company_id)
    for (let i = 0; i < events.length; i += 100)
      await write('earnings_events', events.slice(i, i + 100), 'company_id,source,fiscal_year,fiscal_quarter')
    await finish(runId, 'success', events.length)
    return reply(200, { ok: true, companies: companyIds.size, events: events.length })
  } catch (e) {
    if (runId) await finish(runId, 'error', 0, String(e).slice(0, 500)).catch(() => {})
    return reply(502, { error: 'Calendar ingestion failed; check server logs.' })
  }
}
