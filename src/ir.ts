// Client for the /api/ir function, which reads companies' investor relations websites on the hosted app.
import type { DocFormat, DocKind, IrDoc, IrEvent, IrRelease, IrSite } from '../api/ir'
import { useStore, type IrSource } from './store'

export type { DocFormat, DocKind, IrDoc, IrEvent, IrRelease, IrSite }
export interface IrArticle { title: string; url: string; date: string | null; html: string; words: number }

const q = (type: string, url: string) => `/api/ir?type=${type}&url=${encodeURIComponent(url)}`

async function getJson<T>(path: string, fallback: string): Promise<T> {
  const r = await fetch(path)
  const body = r.headers.get('content-type')?.includes('json') ? await r.json() : null
  if (!r.ok || !body) throw Object.assign(new Error(body?.error ?? fallback), { status: r.status })
  return body as T
}

export interface DiscoveredIr { url: string | null; discoveredFrom: string; confidence: 'high' | 'low'; note?: string }
const discoveryCache = new Map<string, Promise<DiscoveredIr>>()
export function discoverIrUrl(companyWebsite: string): Promise<DiscoveredIr> {
  const u = new URL(companyWebsite)
  if(!['https:','http:'].includes(u.protocol)) return Promise.reject(new Error('Unsupported company URL'))
  const path = q('discover',u.href.replace(/^http:/,'https:'))
  if(!discoveryCache.has(path)) {
    discoveryCache.set(path,getJson<DiscoveredIr>(path,'Could not discover investor relations source.'))
    discoveryCache.get(path)!.catch(()=>discoveryCache.delete(path))
  }
  return discoveryCache.get(path)!
}

const siteCache = new Map<string, Promise<IrSite>>()
export function loadIrSite(url: string, fresh = false): Promise<IrSite> {
  if (fresh || !siteCache.has(url)) {
    siteCache.set(url, getJson<IrSite>(q('site', url), 'Investor relations pages can only be read on the hosted site.'))
    siteCache.get(url)!.catch(() => siteCache.delete(url))
  }
  return siteCache.get(url)!
}

const docCache = new Map<string, Promise<IrArticle>>()
export function loadIrArticle(url: string): Promise<IrArticle> {
  if (!docCache.has(url)) {
    docCache.set(url, getJson<IrArticle>(q('doc', url), 'Could not read this page.'))
    docCache.get(url)!.catch(() => docCache.delete(url))
  }
  return docCache.get(url)!
}

/** A PDF served through our own domain so it opens inside the app. */
export const irPdfUrl = (url: string) => q('file', url)
/** PowerPoint, Word and Excel files open in Microsoft's free online viewer. */
export const officeViewer = (url: string) => `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`

/** The IR site saved for a company, matched on SEC CIK first and ticker second. */
export function useIrSource(cik: number, tickers: string[]): IrSource | undefined {
  const { irSources } = useStore()
  return irSources.find((s) => s.cik === cik) ?? irSources.find((s) => tickers.includes(s.ticker))
}

export const KIND_LABEL: Record<DocKind, string> = {
  'press-release': 'Press release', slides: 'Slides', transcript: 'Transcript', webcast: 'Webcast',
  financials: 'Financials', filing: 'Filing', 'event-page': 'Event page', other: 'Document',
}
