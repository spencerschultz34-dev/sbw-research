// Client for the /api/sec function, which serves public SEC EDGAR data on the hosted app.
import { useEffect, useState } from 'react'

export type SecTicker = readonly [cik: number, ticker: string, name: string]
export interface SecPoint { end: string; label: string; value: number; derived?: boolean }
export interface SecFiling { form: string; filed: string; period: string | null; title: string; items: string; url: string; index: string; acc: string }
export interface SecDoc { seq: string; description: string; name: string; type: string; size: string; path: string }
export interface SecCompany {
  cik: number; name: string; tickers: string[]; exchanges: string[]; industry: string; fiscalYearEnd: string
  category: string; state: string; city: string | null; website: string | null
  filings: SecFiling[]
  financials: Record<'revenue' | 'operatingIncome' | 'netIncome' | 'eps', SecPoint[]> | null
}

declare const __ARTIFACT__: boolean
/** The SEC function exists only on the deployed site (Vercel), not in the claude.ai preview or plain `npm run dev`. */
export const secAvailable = !__ARTIFACT__

let tickerCache: Promise<SecTicker[]> | null = null
export function loadTickers(): Promise<SecTicker[]> {
  if (!secAvailable) return Promise.resolve([])
  tickerCache ??= fetch('/api/sec?type=tickers')
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : []))
    .catch(() => [])
  return tickerCache
}

export function useTickers() {
  const [list, setList] = useState<SecTicker[]>([])
  useEffect(() => { let on = true; loadTickers().then((l) => on && setList(l)); return () => { on = false } }, [])
  return list
}

export function matchTickers(list: SecTicker[], q: string, n = 6) {
  const t = q.trim().toLowerCase()
  if (!t) return []
  const exact = list.filter((x) => x[1].toLowerCase() === t)
  const starts = list.filter((x) => x[1].toLowerCase() !== t && (x[1].toLowerCase().startsWith(t) || x[2].toLowerCase().startsWith(t)))
  const contains = t.length > 2 ? list.filter((x) => !x[1].toLowerCase().startsWith(t) && !x[2].toLowerCase().startsWith(t) && x[2].toLowerCase().includes(t)) : []
  return [...exact, ...starts, ...contains].slice(0, n)
}

export async function loadCompany(cik: number): Promise<SecCompany> {
  const r = await fetch(`/api/sec?type=company&cik=${cik}`)
  const body = r.headers.get('content-type')?.includes('json') ? await r.json() : null
  if (!r.ok || !body) throw new Error(body?.error ?? 'SEC data is only available on the hosted site.')
  return body as SecCompany
}

/** SEC stores many names in capitals ("MICROSOFT CORP"); show them in title case. */
export const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()) : s)

const docCache = new Map<string, Promise<SecDoc[]>>()
export function loadExhibits(cik: number, acc: string): Promise<SecDoc[]> {
  const k = `${cik}/${acc}`
  if (!docCache.has(k)) {
    docCache.set(k, fetch(`/api/sec?type=exhibits&cik=${cik}&acc=${acc}`).then(async (r) => {
      if (!r.ok) throw new Error('Could not load this filing from the SEC.')
      return r.json()
    }))
    docCache.get(k)!.catch(() => docCache.delete(k))
  }
  return docCache.get(k)!
}
/** Address of a filing document served from our own domain (see vercel.json). */
export const archiveUrl = (path: string) => `/sec-archive/${path}`
/** 8-K filings under Item 2.02 ("Results of Operations") are earnings announcements. */
export const isEarnings = (f: SecFiling) => /^8-K/.test(f.form) && f.items.split(',').includes('2.02')

/* ---------- earnings calls (EarningsCall via /api/calls) ---------- */

export interface CallEvent { year: number; quarter: number; date: string | null; published: boolean; eps?: { actual: number | null; estimate: number | null } | null }
export interface CallTranscript {
  company: string; year: number; quarter: number; date: string | null; timed: boolean; qnaStart: string | null; audio: boolean; source: string
  speakers: Record<string, { name: string; title: string }>
  paragraphs: { id: string; speaker: string; start: number | null; sentences: { t: number | null; text: string }[] }[]
}

/** EarningsCall names exchanges in capitals; SEC uses "Nasdaq", "NYSE" and so on. */
export const callExchange = (secExchange: string | undefined) => (secExchange ? secExchange.toUpperCase().replace(/\s+/g, '') : '')
const callQs = (symbol: string, exchange: string, extra = '') => `symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}${extra}`

export async function loadCallEvents(symbol: string, exchange: string, fye = '1231'): Promise<CallEvent[]> {
  const r = await fetch(`/api/calls?type=events&${callQs(symbol, exchange, `&fye=${fye}`)}`)
  if (!r.ok) return []
  return ((await r.json()) as { events: CallEvent[] }).events
}

export async function loadTranscript(symbol: string, exchange: string, year: number, quarter: number): Promise<CallTranscript> {
  const r = await fetch(`/api/calls?type=transcript&${callQs(symbol, exchange, `&year=${year}&quarter=${quarter}`)}`)
  const body = await r.json().catch(() => null)
  if (!r.ok || !body) throw new Error(body?.error ?? 'Could not load the transcript.')
  return body as CallTranscript
}

export const audioUrl = (symbol: string, exchange: string, year: number, quarter: number) => `/api/calls?type=audio&${callQs(symbol, exchange, `&year=${year}&quarter=${quarter}`)}`
