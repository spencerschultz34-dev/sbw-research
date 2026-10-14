// Vercel Edge Function: earnings call transcripts and audio from EarningsCall (earningscall.biz).
// GET /api/calls?type=events&symbol=AAPL&exchange=NASDAQ
// GET /api/calls?type=transcript&symbol=AAPL&exchange=NASDAQ&year=2026&quarter=4
// GET /api/calls?type=audio&symbol=AAPL&exchange=NASDAQ&year=2026&quarter=4   (MP3, supports Range for seeking)
// Set EARNINGSCALL_API_KEY in Vercel. Without it the free "demo" key is used, which only covers AAPL and MSFT.
export const config = { runtime: 'edge' }

const BASE = 'https://api.earningscall.dev'
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const KEY = env.EARNINGSCALL_API_KEY || 'demo'

export default async function handler(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams
  const symbol = (q.get('symbol') ?? '').toUpperCase()
  const exchange = (q.get('exchange') ?? '').toUpperCase()
  if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol) || !/^[A-Z]{2,10}$/.test(exchange)) return json({ error: 'Missing or invalid symbol/exchange' }, 0, 400)
  const year = Number(q.get('year')), quarter = Number(q.get('quarter'))
  const period = Number.isInteger(year) && year > 1990 && [1, 2, 3, 4].includes(quarter)
  try {
    switch (q.get('type')) {
      case 'events': return json(await events(symbol, exchange), 3600)
      case 'transcript':
        if (!period) return json({ error: 'Missing year/quarter' }, 0, 400)
        return json(await transcript(symbol, exchange, year, quarter), 7 * 86400)
      case 'audio':
        if (!period) return json({ error: 'Missing year/quarter' }, 0, 400)
        return audio(symbol, exchange, year, quarter, req.headers.get('range'))
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

/* ---------- events ---------- */

interface EcEvent { year: number; quarter: number; conference_date: string | null; is_published?: boolean }

async function events(symbol: string, exchange: string) {
  const r = await call<{ company_name: string; events: EcEvent[] }>('/events', { symbol, exchange })
  return { company: r.company_name, events: r.events.map((e) => ({ year: e.year, quarter: e.quarter, date: e.conference_date, published: e.is_published !== false })) }
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
  return { company: l2.company_name, year, quarter, date: l2.event?.conference_date ?? null, speakers, paragraphs: turns, qnaStart, timed: !!l3 }
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
