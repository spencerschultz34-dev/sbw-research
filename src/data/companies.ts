import type { Company } from './types'

// Real, listed companies. The registry starts with the default watchlist below and grows as people follow,
// search or open companies; details (CIK, exchange, logo, market cap, events) are filled in from the live sources.
export const COMPANIES: Company[] = []
const byId = new Map<string, Company>()

const PALETTE = ['#1F6FB2', '#D23B3B', '#B8892B', '#C2561D', '#6A4BC4', '#1C9B8E', '#2E7D4F', '#8A3FA0', '#0F766E', '#B4442E', '#3B5BA9', '#7A6A2E']
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

/** Company ids are lower-case tickers, so links and saved items stay readable. */
export const idFor = (ticker: string) => ticker.toLowerCase()

function blank(id: string, name?: string): Company {
  const ticker = id.toUpperCase()
  const n = name ?? ticker
  return {
    id, name: n, ticker, country: 'US', industry: '', marketCap: '', color: PALETTE[hash(id) % PALETTE.length],
    monogram: n.replace(/^the\s+/i, '')[0]?.toUpperCase() ?? ticker[0], hasEstimates: false, segments: [],
  }
}

/** Adds a company or fills in fields on one we already have. `track` puts it in the lists people pick from. */
export function upsertCompany(id: string, patch: Partial<Company> = {}, track = true) {
  let c = byId.get(id)
  if (!c) { c = blank(id, patch.name); byId.set(id, c) }
  Object.assign(c, patch)
  if (patch.name) c.monogram = patch.name.replace(/^the\s+/i, '')[0]?.toUpperCase() ?? c.monogram
  if (track && !COMPANIES.includes(c)) COMPANIES.push(c)
  return c
}

export const hasCompany = (id: string) => byId.has(id)

let onUnknown: ((id: string) => void) | null = null
/** The live loader registers here to fetch details for companies it hasn't seen yet. */
export function setUnknownCompanyHandler(fn: (id: string) => void) { onUnknown = fn }

export const companyById = (id: string): Company => {
  const c = byId.get(id)
  if (c) return c
  const made = upsertCompany(id, {}, false)
  if (onUnknown) setTimeout(() => onUnknown?.(id), 0)
  return made
}

// The default watchlist: large US companies across sectors. Names here only avoid a flash of bare tickers.
export const DEFAULT_TICKERS: [string, string][] = [
  ['AAPL', 'Apple Inc.'], ['MSFT', 'Microsoft Corp'], ['NVDA', 'NVIDIA Corp'], ['AMZN', 'Amazon.com, Inc.'], ['GOOGL', 'Alphabet Inc.'],
  ['META', 'Meta Platforms, Inc.'], ['JPM', 'JPMorgan Chase & Co.'], ['KO', 'The Coca-Cola Company'], ['PEP', 'PepsiCo, Inc.'],
  ['COST', 'Costco Wholesale Corp'], ['XOM', 'Exxon Mobil Corp'], ['UNP', 'Union Pacific Corp'],
]
for (const [t, name] of DEFAULT_TICKERS) upsertCompany(idFor(t), { name })

export const FLAGS: Record<string, string> = {
  US: '🇺🇸', CA: '🇨🇦', GB: '🇬🇧', SE: '🇸🇪', DE: '🇩🇪',
}
