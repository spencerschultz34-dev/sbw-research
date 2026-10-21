export type CompanyId = string
export type EventId = string

export interface Segment {
  title: string
  subtitle: string
  items: { name: string; pct: number }[]
}

export interface Company {
  id: CompanyId
  name: string
  ticker: string
  country: string
  industry: string
  marketCap: string
  color: string
  monogram: string
  hasEstimates: boolean
  segments: Segment[]
  cik?: number
  exchange?: string
  fye?: string // fiscal year end as MMDD, from the SEC
  logo?: string
  website?: string // verified company website provided by market profile, used for generic IR source discovery
}

export type EventType =
  | 'Earnings'
  | 'Conference'
  | 'AGM'
  | 'Update / briefing'
  | 'Monthly sales update'
  | 'Capital markets day'

export type DocKind =
  | 'Earnings release'
  | 'Quarterly report'
  | 'Annual report'
  | 'Prepared remarks'
  | 'Interim report'
  | 'Proxy statement'
  | 'Slides'
  | 'Report'

export interface ReportDoc {
  id: string
  kind: DocKind
  form?: string
  title: string
  pages: ReportPage[]
  oneLiner?: string
  url?: string // a real filing document, shown as is instead of pages
}

export interface ReportPage {
  heading?: string
  blocks: ({ t: 'h'; text: string } | { t: 'p'; text: string } | { t: 'ul'; items: string[] } | { t: 'table'; rows: string[][] })[]
}

export interface Slide {
  key: string
  title: string
  category: string
  kind: 'cover' | 'bars' | 'kpis' | 'text' | 'donut'
  subtitle?: string
  bars?: { label: string; value: number }[]
  kpis?: { label: string; value: string; delta?: string }[]
  bullets?: string[]
}

export interface Speaker {
  name: string
  role: string
  isOperator?: boolean
  isAnalyst?: boolean
}

export interface Paragraph {
  id: string
  speaker: number
  start: number
  text: string
  chapter: number
  sents?: { t: number | null; text: string }[] // real transcripts: each sentence with its start time
}

export interface Chapter {
  title: string
  start: number
}

export interface Transcript {
  speakers: Speaker[]
  paragraphs: Paragraph[]
  chapters: Chapter[]
  qnaStart: number
  timed?: boolean // false when the source has no timestamps (no audio follow-along)
  source?: string
}

export interface Metric {
  label: 'Revenue' | 'EBITDA' | 'EBIT' | 'EPS'
  actual?: number
  estimate: number
  prior?: number
  unit: 'B' | ''
}

export interface SummarySection {
  heading: string
  bullets: { text: string; cites: Citation[] }[]
}

export interface Citation {
  n: number
  tab: 'transcript' | 'report' | 'slides'
  ref: string
}

export interface CompanyEvent {
  id: EventId
  companyId: CompanyId
  title: string
  type: EventType
  date: string // ISO
  liveTime?: string // "07:30"
  reportTiming?: string // "Premarket" | "Aftermarket" | "05:45"
  estimated?: boolean
  status: 'upcoming' | 'live' | 'past'
  durationSec: number
  headline?: string
  metrics?: Metric[]
  summary?: SummarySection[]
  transcript?: Transcript
  slides?: Slide[]
  reports: ReportDoc[]
  hasAudio: boolean
  call?: { symbol: string; exchange: string; year: number; quarter: number } // earnings call to load the transcript and audio from
  filing?: { cik: number; acc: string; url: string } // SEC 8-K with the earnings release and slides
  transcriptError?: string
}

export interface PressRelease {
  id: string
  companyId: CompanyId
  title: string
  excerpt: string
  date: string
  language: string
}

export interface Mention {
  id: string
  fromCompanyId: CompanyId
  toCompanyId: CompanyId
  count: number
  source: string
  date: string
  text: string
  docType: 'Report' | 'Slides' | 'Transcript'
}

export interface ActivityItem {
  id: string
  companyId: CompanyId
  eventId: EventId
  label: string
  docType: 'report' | 'audio' | 'transcript' | 'slides'
  date: string
  oneLiner?: string
  openTab: 'overview' | 'transcript' | 'slides' | 'report'
}
