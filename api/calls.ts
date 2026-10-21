// Vercel Edge Function: earnings call transcripts and audio.
// Sources, in order: our own recordings (worker/ records webcasts and transcribes them into Supabase + R2),
// then EarningsCall (earningscall.biz), then Alpha Vantage.
// GET /api/calls?type=events&symbol=AAPL&exchange=NASDAQ
// GET /api/calls?type=transcript&symbol=AAPL&exchange=NASDAQ&year=2026&quarter=4
// GET /api/calls?type=audio&symbol=AAPL&exchange=NASDAQ&year=2026&quarter=4   (MP3, supports Range for seeking)
// Set EARNINGSCALL_API_KEY in Vercel. Without it the free "demo" key is used, which only covers AAPL and MSFT.
// When EarningsCall can't serve a company, ALPHAVANTAGE_API_KEY (free, 25 requests a day) supplies the list of calls and
// speaker-labelled transcripts without audio or timestamps.
import { presignGet, s3FromEnv } from '../lib/s3'
export const config = { runtime: 'edge' }

const BASE = 'https://api.earningscall.dev'
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const KEY = env.EARNINGSCALL_API_KEY || 'demo'
const AV_KEY = env.ALPHAVANTAGE_API_KEY || ''
// Our own call store: SUPABASE_URL (or the app's VITE_SUPABASE_URL) and the server-only SUPABASE_SERVICE_ROLE_KEY,
// plus the S3_* storage settings for the audio (see lib/s3.ts).
const SB_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''
const S3 = s3FromEnv(env)

export default async function handler(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams
  const symbol = (q.get('symbol') ?? '').toUpperCase()
  const exchange = (q.get('exchange') ?? '').toUpperCase()
  if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol) || !/^[A-Z]{2,10}$/.test(exchange)) return json({ error: 'Missing or invalid symbol/exchange' }, 0, 400)
  const year = Number(q.get('year')), quarter = Number(q.get('quarter'))
  const period = Number.isInteger(year) && year > 1990 && [1, 2, 3, 4].includes(quarter)
  try {
    switch (q.get('type')) {
      case 'events': {
        const fye = q.get('fye') ?? '1231'
        const mine = await ownEvents(symbol).catch(() => [])
        const r = await otherEvents(symbol, exchange, fye).catch((e) => { if (!mine.length) throw e; return null })
        // Our recordings win for the quarters they cover; the provider fills in the rest.
        const rest = (r?.events ?? []).filter((e) => !mine.some((m) => m.year === e.year && m.quarter === e.quarter))
        return json({ company: r?.company ?? symbol, source: mine.length ? 'SBW' : r?.source, events: [...mine, ...rest].sort((a, b) => b.year - a.year || b.quarter - a.quarter) }, mine.length ? 600 : 3600)
      }
      case 'transcript': {
        if (!period) return json({ error: 'Missing year/quarter' }, 0, 400)
        const mine = await ownCall(symbol, year, quarter).catch(() => null)
        if (mine?.transcript) return json({ ...mine.transcript, audio: !!(mine.audio_key && S3) }, 3600)
        try {
          return json(await transcript(symbol, exchange, year, quarter), 7 * 86400)
        } catch (e) {
          const status = (e as { status?: number }).status
          if (!AV_KEY || (status !== 403 && status !== 404)) throw e
          return json(await avTranscript(symbol, year, quarter), 7 * 86400)
        }
      }
      case 'audio': {
        if (!period) return json({ error: 'Missing year/quarter' }, 0, 400)
        const mine = await ownCall(symbol, year, quarter).catch(() => null)
        // A short-lived link straight to storage, which handles seeking (Range) itself.
        if (mine?.audio_key && S3) return new Response(null, { status: 302, headers: { location: await presignGet(S3, mine.audio_key, 6 * 3600), 'cache-control': 'private, max-age=3600' } })
        return audio(symbol, exchange, year, quarter, req.headers.get('range'))
      }
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

async function call<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const u = new URL(BASE + path)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v))
  u.searchParams.set('apikey', KEY)
  const r = await fetch(u)
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { error?: string; message?: string } | null
    const msg = r.status === 403 && KEY === 'demo' ? 'Transcripts for this company need an EarningsCall plan (the demo covers Apple and Microsoft only).'
      : r.status === 403 ? 'Your EarningsCall plan does not include this.'
      : r.status === 404 ? 'No transcript for this call yet.'
      : body?.message ?? body?.error ?? `EarningsCall returned ${r.status}`
    throw Object.assign(new Error(msg), { status: r.status === 404 ? 404 : r.status === 403 ? 403 : 502 })
  }
  return r.json() as Promise<T>
}

/* ---------- our own recordings (Supabase) ---------- */

interface OwnRow { year: number; quarter: number; event_date: string | null; audio_key: string | null; transcript: Record<string, unknown> | null }

async function sb<T>(query: string): Promise<T> {
  if (!SB_URL || !SB_KEY) throw new Error('Call store not configured')
  const r = await fetch(`${SB_URL}/rest/v1/${query}`, { headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` } })
  if (!r.ok) throw new Error(`Supabase returned ${r.status}`)
  return r.json() as Promise<T>
}

async function ownEvents(symbol: string) {
  if (!SB_URL || !SB_KEY) return []
  const rows = await sb<OwnRow[]>(`calls?symbol=eq.${encodeURIComponent(symbol)}&status=eq.done&select=year,quarter,event_date&order=year.desc,quarter.desc`)
  return rows.map((r) => ({ year: r.year, quarter: r.quarter, date: r.event_date, published: true, eps: null as null | { actual: number | null; estimate: number | null } }))
}

async function ownCall(symbol: string, year: number, quarter: number) {
  if (!SB_URL || !SB_KEY) return null
  const rows = await sb<OwnRow[]>(`calls?symbol=eq.${encodeURIComponent(symbol)}&year=eq.${year}&quarter=eq.${quarter}&status=eq.done&select=year,quarter,event_date,audio_key,transcript`)
  return rows[0] ?? null
}

/* ---------- events ---------- */

async function otherEvents(symbol: string, exchange: string, fye: string) {
  try {
    const r = await events(symbol, exchange)
    if (r.events.length || !AV_KEY) return r
  } catch (e) { if (!AV_KEY) throw e }
  return avEvents(symbol, /^\d{4}$/.test(fye) ? fye : '1231')
}

interface EcEvent { year: number; quarter: number; conference_date: string | null; is_published?: boolean }

async function events(symbol: string, exchange: string) {
  const r = await call<{ company_name: string; events: EcEvent[] }>('/events', { symbol, exchange })
  return { company: r.company_name, source: 'EarningsCall', events: r.events.map((e) => ({ year: e.year, quarter: e.quarter, date: e.conference_date, published: e.is_published !== false, eps: null as null | { actual: number | null; estimate: number | null } })) }
}

/* ---------- transcript ---------- */

interface Speaker { id: string; name?: string; title?: string }
interface Base { company_name: string; event?: { year: number; quarter: number; conference_date: string } }

/**
 * Combines three EarningsCall views of one call: speaker turns with names (level 2), word start times (level 3)
 * and the prepared remarks / Q&A split (level 4). Each turn is cut into sentences that carry their start time,
 * so the app can follow along with the audio and seek by clicking a sentence.
 */
async function transcript(symbol: string, exchange: string, year: number, quarter: number) {
  const p = { symbol, exchange, year, quarter }
  const [l2, l3, l4] = await Promise.all([
    call<Base & { speakers: { speaker: Speaker; text: string }[] }>('/transcript', { ...p, level: 2 }),
    call<Base & { speakers: { speaker: Speaker | string; words: string[]; start_times: number[] }[] }>('/transcript', { ...p, level: 3 }).catch(() => null),
    call<Base & { prepared_remarks: string; questions_and_answers: string }>('/transcript', { ...p, level: 4 }).catch(() => null),
  ])

  const speakers: Record<string, { name: string; title: string }> = {}
  const turns = l2.speakers.map((t, i) => {
    const id = t.speaker.id ?? `s${i}`
    speakers[id] ??= { name: t.speaker.name || 'Speaker', title: t.speaker.title || '' }
    const timed = l3?.speakers[i]
    const sentences = timed && timed.words.length ? sentencesFromWords(timed.words, timed.start_times) : [{ t: null as number | null, text: t.text }]
    return { id: `p${i + 1}`, speaker: id, start: sentences[0]?.t ?? null, sentences }
  })

  // Q&A starts at the turn whose text opens the questions-and-answers section.
  let qnaStart: string | null = null
  const qa = l4?.questions_and_answers?.trim()
  if (qa) {
    const head = norm(qa).slice(0, 60)
    const hit = turns.find((t) => norm(t.sentences.map((s) => s.text).join(' ')).startsWith(head.slice(0, 40)))
    qnaStart = hit?.id ?? null
  }
  return { company: l2.company_name, year, quarter, date: l2.event?.conference_date ?? null, speakers, paragraphs: turns, qnaStart, timed: !!l3, audio: true, source: 'EarningsCall' }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

function sentencesFromWords(words: string[], starts: number[]) {
  const out: { t: number; text: string }[] = []
  let buf: string[] = [], t0 = starts[0] ?? 0
  words.forEach((w, i) => {
    if (!buf.length) t0 = starts[i] ?? t0
    buf.push(w)
    if (/[.!?]["')\]]?$/.test(w) && !/^(Mr|Mrs|Ms|Dr|Inc|Co|Corp|vs|St|U\.S)\.$/i.test(w)) { out.push({ t: Math.round(t0 * 10) / 10, text: buf.join(' ') }); buf = [] }
  })
  if (buf.length) out.push({ t: Math.round(t0 * 10) / 10, text: buf.join(' ') })
  return out
}

/* ---------- audio ---------- */

async function audio(symbol: string, exchange: string, year: number, quarter: number, range: string | null) {
  const u = new URL(BASE + '/audio')
  Object.entries({ symbol, exchange, year, quarter, apikey: KEY }).forEach(([k, v]) => u.searchParams.set(k, String(v)))
  const r = await fetch(u, { headers: range ? { Range: range } : {} })
  if (!r.ok && r.status !== 206) {
    return json({ error: r.status === 403 ? 'Audio needs the EarningsCall Ultimate plan.' : r.status === 404 ? 'No audio for this call.' : `EarningsCall returned ${r.status}` }, 0, r.status === 403 || r.status === 404 ? r.status : 502)
  }
  const headers: Record<string, string> = { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', 'cache-control': 'public, s-maxage=604800' }
  for (const h of ['content-length', 'content-range']) { const v = r.headers.get(h); if (v) headers[h] = v }
  return new Response(r.body, { status: r.status, headers })
}

/* ---------- Alpha Vantage fallback (free key: 25 requests a day) ---------- */

async function av<T>(params: Record<string, string>): Promise<T> {
  const u = new URL('https://www.alphavantage.co/query')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  u.searchParams.set('apikey', AV_KEY)
  const r = await fetch(u)
  if (!r.ok) throw Object.assign(new Error(`Alpha Vantage returned ${r.status}`), { status: 502 })
  const body = (await r.json()) as T & { Information?: string; Note?: string; 'Error Message'?: string }
  const notice = body.Information ?? body.Note ?? body['Error Message']
  if (notice) throw Object.assign(new Error(/limit|rate|premium/i.test(notice) ? 'The free Alpha Vantage limit for today is used up. Try again tomorrow.' : notice), { status: 429 })
  return body
}

/** Fiscal year and quarter of a period, given the company's fiscal year end as MMDD (from the SEC). */
function fiscal(periodEnd: string, fye: string) {
  const d = new Date(Date.parse(periodEnd + 'T00:00:00Z') - 15 * 864e5) // 52/53-week years end in the first days of a month
  const m = d.getUTCMonth() + 1, y = d.getUTCFullYear()
  const endMonth = new Date(Date.UTC(2001, Number(fye.slice(0, 2)) - 1, Number(fye.slice(2)) - 15)).getUTCMonth() + 1
  return { year: m <= endMonth ? y : y + 1, quarter: Math.floor(((m - endMonth - 1 + 12) % 12) / 3) + 1 }
}

async function avEvents(symbol: string, fye: string) {
  const r = await av<{ quarterlyEarnings?: { fiscalDateEnding: string; reportedDate: string; reportedEPS: string; estimatedEPS: string }[] }>({ function: 'EARNINGS', symbol })
  const num = (v: string) => (v && v !== 'None' ? Number(v) : null)
  return {
    company: symbol, source: 'Alpha Vantage',
    events: (r.quarterlyEarnings ?? []).slice(0, 12).map((e) => ({ ...fiscal(e.fiscalDateEnding, fye), date: e.reportedDate, published: true, eps: { actual: num(e.reportedEPS), estimate: num(e.estimatedEPS) } })),
  }
}

async function avTranscript(symbol: string, year: number, quarter: number) {
  const r = await av<{ transcript?: { speaker: string; title?: string; content: string }[] }>({ function: 'EARNINGS_CALL_TRANSCRIPT', symbol, quarter: `${year}Q${quarter}` })
  const items = r.transcript ?? []
  if (!items.length) throw Object.assign(new Error('No transcript for this call yet.'), { status: 404 })
  const speakers: Record<string, { name: string; title: string }> = {}
  const id = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  let qnaStart: string | null = null
  const paragraphs = items.map((t, i) => {
    speakers[id(t.speaker)] ??= { name: t.speaker, title: t.title ?? '' }
    // Q&A begins with the first analyst who speaks.
    if (!qnaStart && i > 1 && /analyst/i.test(t.title ?? '')) qnaStart = `p${i + 1}`
    const sentences = (t.content.match(/[^.!?]+[.!?]+["')\]]?\s*|[^.!?]+$/g) ?? [t.content]).map((x) => ({ t: null as number | null, text: x.trim() })).filter((x) => x.text)
    return { id: `p${i + 1}`, speaker: id(t.speaker), start: null as number | null, sentences }
  })
  return { company: symbol, year, quarter, date: null, speakers, paragraphs, qnaStart, timed: false, audio: false, source: 'Alpha Vantage' }
}
