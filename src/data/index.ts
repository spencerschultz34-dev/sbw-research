import { COMPANIES, companyById } from './companies'
import type {
  ActivityItem, Company, CompanyEvent, EventType, Metric, Mention, PressRelease, ReportDoc, Slide, SummarySection, Transcript,
} from './types'
import { NWB_Q3_REPORTS, NWB_Q3_SUMMARY, NWB_Q3_TRANSCRIPT, nwbSlides } from './showcase'

export { COMPANIES, companyById }

// The sample world is anchored to this date so every screen is coherent.
export const TODAY = new Date('2026-10-13T12:00:00')

function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const iso = (y: number, m: number, d: number, hh = 8, mm = 0) =>
  new Date(Date.UTC(y, m - 1, d, hh + 5, mm)).toISOString() // stored as US Central (UTC-5) wall time

interface Profile {
  base: number // quarterly revenue, billions
  themes: string[]
  ceo: string
  cfo: string
  ir: string
  q3: { m: number; d: number; live?: string; timing?: string; est?: boolean } // Q3 2026 earnings date
}

const PROFILES: Record<string, Profile> = {
  nwb: { base: 24.5, themes: ['pack architecture', 'affordability', 'zero-sugar'], ceo: 'Marcus Oyelaran', cfo: 'Priya Castellanos', ir: 'Dana Whitfield', q3: { m: 10, d: 8, live: '07:15', timing: '06:00' } },
  hbw: { base: 67, themes: ['comparable sales', 'membership fees', 'e-commerce'], ceo: 'Ruth Abernathy', cfo: 'Gary Millan', ir: 'Josh Delacroix', q3: { m: 9, d: 24, live: '16:00', timing: 'Aftermarket' } },
  mrdb: { base: 20.4, themes: ['net interest income', 'credit card', 'deposit costs'], ceo: 'Elena Varga', cfo: 'Samuel Okafor', ir: 'Lena Fischer', q3: { m: 10, d: 13, live: '09:00', timing: '06:00' } },
  clde: { base: 48, themes: ['refining margins', 'Permian', 'buybacks'], ceo: 'Wade Thornton', cfo: 'Kiran Bhatt', ir: 'Alicia Moreno', q3: { m: 10, d: 30, live: '10:00', timing: 'Premarket', est: true } },
  hlxt: { base: 3.6, themes: ['Phase 3', 'FDA approval', 'antibody'], ceo: 'Dr. Naomi Sterling', cfo: 'Pavel Novak', ir: 'Ben Achterberg', q3: { m: 11, d: 3, live: '07:30', timing: 'Premarket', est: true } },
  strc: { base: 10.2, themes: ['AI agents', 'remaining performance obligations', 'cyber security'], ceo: 'Jordan Pike', cfo: 'Mei Tanaka', ir: 'Chris Albright', q3: { m: 10, d: 21, live: '16:00', timing: 'Aftermarket' } },
  aurs: { base: 17.8, themes: ['custom accelerators', 'AI networking', 'VMware-style software'], ceo: 'Victor Han', cfo: 'Laura Benning', ir: 'Omar Siddiqui', q3: { m: 10, d: 29, live: '16:30', timing: 'Aftermarket' } },
  pncr: { base: 3.9, themes: ['truck-to-rail conversion', 'intermodal', 'operating ratio'], ceo: 'Claire Dubois', cfo: 'Hamish Grant', ir: 'Nadia Rahman', q3: { m: 10, d: 15, live: '07:30', timing: 'Premarket' } },
  tslp: { base: 2.6, themes: ['cross-border volume', 'stablecoin', 'take rate'], ceo: 'Andre Kowalski', cfo: 'Sofia Lindqvist', ir: 'Peter Chu', q3: { m: 10, d: 15, live: '08:00', timing: 'Premarket' } },
  virc: { base: 21.7, themes: ['tariffs', 'pricing', 'productivity'], ceo: 'Helen Marsh', cfo: 'David Ito', ir: 'Rebecca Stone', q3: { m: 10, d: 13, live: '08:30', timing: '06:55' } },
  solf: { base: 17.1, themes: ['price matching', 'loyalty', 'online grocery'], ceo: 'Oliver Pennington', cfo: 'Imogen Hale', ir: 'Rory Doyle', q3: { m: 10, d: 9, live: '08:00', timing: '07:00' } },
  kstl: { base: 11.3, themes: ['aftermarket', 'supply chain', 'LEAP-class engines'], ceo: 'Frank Delgado', cfo: 'Anita Rao', ir: 'Sean Whitaker', q3: { m: 10, d: 20, live: '06:30', timing: 'Premarket' } },
  ardi: { base: 4.4, themes: ['Japan', 'yen', 'cancer insurance'], ceo: 'Robert Kim', cfo: 'Grace Holloway', ir: 'Tariq Aziz', q3: { m: 10, d: 28, live: '07:00', timing: 'Aftermarket' } },
  brwu: { base: 10.9, themes: ['data center demand', 'rate cases', 'pipeline expansion'], ceo: 'Margaret Ellison', cfo: 'Raj Patel', ir: 'Jonas Becker', q3: { m: 11, d: 6, live: '08:00', timing: 'Premarket', est: true } },
  qnt: { base: 2.1, themes: ['private credit', 'net flows', 'ETF'], ceo: 'Harold Quill', cfo: 'Dina Notch', ir: 'Evan Price', q3: { m: 10, d: 27, live: '10:00', timing: 'Premarket' } },
  orbt: { base: 4.8, themes: ['orbital compute', 'launch cadence', 'cost curve'], ceo: 'Celeste Ward', cfo: 'Bret Johnsen', ir: 'Kai Mendez', q3: { m: 11, d: 5, live: '16:30', timing: 'Aftermarket', est: true } },
}

const ANALYSTS = [
  ['Tom Harrigan', 'Lexington Partners'], ['Ingrid Solberg', 'Fairmount Securities'], ['Raymond Cho', 'Bayline Capital Markets'],
  ['Erin Gallagher', 'Westbury & Co.'], ['Felix Ortmann', 'Nordhaven Research'], ['Simone Adeyemi', 'Calloway Brothers'],
]

const fmtB = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(v >= 10 ? 1 : 2))

function genMetrics(c: Company, p: Profile, r: () => number, withActual: boolean): Metric[] {
  const rev = p.base * (0.95 + r() * 0.12)
  const ebitda = rev * (0.16 + r() * 0.14)
  const ebit = ebitda * (0.72 + r() * 0.12)
  const eps = 0.8 + r() * 3.5
  const m = (label: Metric['label'], est: number, unit: 'B' | ''): Metric => {
    const actual = withActual ? est * (1 + (r() - 0.42) * 0.06) : undefined
    const prior = est * (1 - (r() - 0.35) * 0.08)
    return { label, estimate: round(est), actual: actual ? round(actual) : undefined, prior: round(prior), unit }
  }
  return [m('Revenue', rev, 'B'), m('EBITDA', ebitda, 'B'), m('EBIT', ebit, 'B'), m('EPS', eps, '')]
}
const round = (v: number) => Math.round(v * 100) / 100

function genTranscript(c: Company, p: Profile, label: string, r: () => number, ev: string): Transcript {
  const a1 = ANALYSTS[Math.floor(r() * ANALYSTS.length)]
  const a2 = ANALYSTS[(ANALYSTS.indexOf(a1) + 2) % ANALYSTS.length]
  const growth = (r() * 9 - 1.5).toFixed(1)
  const margin = (12 + r() * 20).toFixed(1)
  const [t1, t2, t3] = p.themes
  const speakers = [
    { name: 'Operator', role: '', isOperator: true },
    { name: p.ir, role: `Head of Investor Relations, ${c.name}` },
    { name: p.ceo, role: `Chief Executive Officer, ${c.name}` },
    { name: p.cfo, role: `Chief Financial Officer, ${c.name}` },
    { name: a1[0], role: `Analyst, ${a1[1]}`, isAnalyst: true },
    { name: a2[0], role: `Analyst, ${a2[1]}`, isAnalyst: true },
  ]
  const seg = c.segments[0].items.map((s) => s.name)
  const P = (id: number, speaker: number, start: number, chapter: number, text: string) => ({ id: `${ev}-p${id}`, speaker, start, chapter, text })
  return {
    speakers,
    chapters: [
      { title: 'Intro and disclaimers', start: 0 }, { title: 'Business update', start: 70 },
      { title: 'Financial results', start: 520 }, { title: 'Outlook', start: 900 }, { title: 'Q&A', start: 1180 },
    ],
    qnaStart: 1180,
    paragraphs: [
      P(1, 0, 0, 0, `Good day, and welcome to the ${c.name} ${label} conference call. All participants are in a listen-only mode. After the speakers' remarks, there will be a question-and-answer session. I would now like to hand the call over to ${p.ir}. Please go ahead.`),
      P(2, 1, 18, 0, `Thank you, and good morning. With me today are ${p.ceo}, our CEO, and ${p.cfo}, our CFO. Today's remarks include forward-looking statements, and actual results may differ materially. Reconciliations of non-GAAP measures are available in our earnings materials on our investor relations website.`),
      P(3, 2, 70, 1, `Thanks, and good morning, everyone. This was a quarter of disciplined execution. Revenue grew ${growth}% year over year, led by ${seg[0]}, and we continued to make progress on ${t1}. Customers are responding well to the investments we made over the last twelve months.`),
      P(4, 2, 260, 1, `I want to spend a minute on ${t2}. It is becoming a larger part of our story, and we now expect it to contribute meaningfully over the next two years. We are also watching ${t3} closely, and we have the balance sheet to stay flexible.`),
      P(5, 3, 520, 2, `Thank you. Total revenue for the quarter was up ${growth}%, and operating margin was ${margin}%. ${seg[1] ? `${seg[1]} was a highlight, ` : ''}while cost discipline helped offset inflation. Free cash flow was strong, and we returned capital through dividends and buybacks.`),
      P(6, 3, 900, 3, `Looking ahead, we are reaffirming our full-year outlook. We continue to expect margin expansion, supported by productivity and mix. Our guidance assumes no material change in the macroeconomic environment.`),
      P(7, 0, 1180, 4, `We will now begin the question-and-answer session. The first question comes from ${a1[0]} with ${a1[1]}.`),
      P(8, 4, 1190, 4, `Thanks for taking the question. Could you unpack the trajectory of ${t1}? How much of the improvement is structural versus timing?`),
      P(9, 2, 1215, 4, `Sure. We think most of it is structural. The actions on ${t1} are now embedded in how we operate, and we see a long runway. There is some timing benefit this quarter, but it's a small part of the total.`),
      P(10, 0, 1330, 4, `Our next question comes from ${a2[0]} with ${a2[1]}.`),
      P(11, 5, 1338, 4, `Hi, thanks. On ${t2}, what are you assuming in the guide, and what would make you more constructive heading into next year?`),
      P(12, 3, 1360, 4, `We are being prudent. The guide assumes a gradual ramp in ${t2}. If adoption continues at the current pace, that would be upside to our plan. We'll update you as we get more visibility.`),
    ],
  }
}

function genSummary(c: Company, p: Profile, t: Transcript, metrics: Metric[] | undefined, headline: string): SummarySection[] {
  const ps = t.paragraphs
  const at = (i: number) => ps[Math.min(i, ps.length - 1)].id
  const rev = metrics?.find((m) => m.label === 'Revenue')
  return [
    { heading: 'Executive summary', bullets: [
      { text: headline, cites: [{ n: 1, tab: 'transcript', ref: at(2) }] },
      { text: `Management highlighted progress on ${p.themes[0]} and growing importance of ${p.themes[1]}.`, cites: [{ n: 2, tab: 'transcript', ref: at(3) }] },
    ] },
    { heading: 'Financial highlights', bullets: [
      { text: rev?.actual ? `Revenue of ${fmtB(rev.actual)}B vs. consensus ${fmtB(rev.estimate)}B; operating margin and free cash flow were strong.` : 'Operating margin and free cash flow were strong.', cites: [{ n: 3, tab: 'transcript', ref: at(4) }, { n: 4, tab: 'report', ref: `${at(0).split('-p')[0]}-er:0` }] },
    ] },
    { heading: 'Management commentary', bullets: [
      { text: `Most of the ${p.themes[0]} improvement is described as structural, with a small timing benefit this quarter.`, cites: [{ n: 5, tab: 'transcript', ref: at(8) }] },
      { text: `Guidance assumes a gradual ramp in ${p.themes[1]}; faster adoption would be upside.`, cites: [{ n: 6, tab: 'transcript', ref: at(11) }] },
    ] },
    { heading: 'Capital allocation and strategy', bullets: [
      { text: 'Full-year outlook reaffirmed; capital returned through dividends and buybacks.', cites: [{ n: 7, tab: 'transcript', ref: at(5) }] },
    ] },
  ]
}

function genReports(c: Company, ev: string, label: string, headline: string, quarter: number, annual: boolean): ReportDoc[] {
  const docs: ReportDoc[] = [
    { id: `${ev}-er`, kind: 'Earnings release', form: c.country === 'US' ? '8-K' : undefined, title: 'Earnings release', pages: [
      { blocks: [{ t: 'h', text: `${c.name} Reports ${label} Results` }, { t: 'p', text: headline }, { t: 'ul', items: ['Revenue and margins ahead of plan', 'Full-year outlook reaffirmed', 'Capital returned to shareholders'] }] },
      { blocks: [{ t: 'h', text: 'Outlook' }, { t: 'p', text: `${c.name} reaffirms its outlook for the full year and will discuss results on its conference call today.` }] },
    ] },
  ]
  if (c.country === 'US') docs.push({ id: `${ev}-10q`, kind: annual ? 'Annual report' : 'Quarterly report', form: annual ? '10-K' : '10-Q', title: annual ? 'Annual report' : 'Quarterly report', pages: [
    { blocks: [{ t: 'h', text: annual ? 'FORM 10-K' : 'FORM 10-Q' }, { t: 'p', text: `Report for the period ended ${label}. Management's discussion and analysis of financial condition and results of operations.` }] },
    { blocks: [{ t: 'h', text: 'Risk factors' }, { t: 'p', text: 'Changes in macroeconomic conditions, tariffs, interest rates and competitive dynamics could adversely affect our results.' }] },
  ] })
  else docs.push({ id: `${ev}-ir`, kind: 'Interim report', title: 'Interim report', pages: [{ blocks: [{ t: 'h', text: `Interim report ${label}` }, { t: 'p', text: headline }] }] })
  return docs
}

function genSlides(c: Company, p: Profile, label: string, r: () => number): Slide[] {
  return [
    { key: 'cover', title: `${label} Results`, category: 'Cover', kind: 'cover', subtitle: c.name },
    { key: 'kpis', title: 'Quarter at a glance', category: 'Financial results', kind: 'kpis', kpis: [
      { label: 'Revenue growth', value: `${(r() * 9).toFixed(1)}%` }, { label: 'Operating margin', value: `${(12 + r() * 20).toFixed(1)}%` },
      { label: 'Free cash flow', value: `$${(p.base * 0.18).toFixed(1)}B` }, { label: 'Capital returned', value: `$${(p.base * 0.12).toFixed(1)}B` }] },
    { key: 'trend', title: `${cap(p.themes[0])} momentum`, category: 'Market overview', kind: 'bars', bars: ['Q3 25', 'Q4 25', 'Q1 26', 'Q2 26'].map((l, i) => ({ label: l, value: Math.round((10 + i * 3 + r() * 6) * 10) / 10 })) },
    { key: 'strategy', title: 'Strategic priorities', category: 'Strategy', kind: 'text', bullets: p.themes.map(cap).concat(['Disciplined capital allocation']) },
  ]
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

const QUARTERS: { label: string; y: number; m: number; d: number }[] = [
  { label: 'Q3 2025', y: 2025, m: 10, d: 0 },
  { label: 'Q4 2025', y: 2026, m: 2, d: 0 },
  { label: 'Q1 2026', y: 2026, m: 4, d: 0 },
  { label: 'Q2 2026', y: 2026, m: 7, d: 0 },
]

function buildEvents(): CompanyEvent[] {
  const out: CompanyEvent[] = []
  for (const c of COMPANIES) {
    const p = PROFILES[c.id]
    const r = rng(c.id)
    // Historical quarters
    QUARTERS.forEach((q, qi) => {
      const ev = `${c.id}-${q.label.replace(' ', '').toLowerCase()}`
      const day = Math.min(28, p.q3.d + Math.floor(r() * 4) - 2)
      const date = iso(q.y, q.m, Math.max(1, day), Number(p.q3.live?.slice(0, 2) ?? 8), Number(p.q3.live?.slice(3) ?? 0))
      const metrics = c.hasEstimates ? genMetrics(c, p, r, true) : undefined
      const growth = (r() * 8 - 1).toFixed(1)
      const headline = `${q.label.split(' ')[0]} revenue rose ${growth}% as ${p.themes[0]} offset softer trends elsewhere.`
      const t = genTranscript(c, p, `${q.label} earnings`, r, ev)
      let slides: Slide[] | undefined = r() > 0.35 ? genSlides(c, p, q.label, r) : undefined
      if (c.id === 'nwb' && qi >= 2) slides = nwbSlides((qi - 2) as 0 | 1)
      out.push({
        id: ev, companyId: c.id, title: q.label, type: 'Earnings', date, status: 'past', durationSec: 1500 + Math.floor(r() * 2400),
        liveTime: p.q3.live, reportTiming: p.q3.timing, headline, metrics, transcript: t, summary: genSummary(c, p, t, metrics, headline),
        slides, reports: genReports(c, ev, q.label, headline, qi, q.label.startsWith('Q4')), hasAudio: true,
      })
    })
    // Q3 2026
    const q3date = iso(2026, p.q3.m, p.q3.d, Number(p.q3.live!.slice(0, 2)), Number(p.q3.live!.slice(3)))
    const ev = `${c.id}-q32026`
    const isPast = new Date(q3date) < TODAY && !(p.q3.m === 10 && p.q3.d === 13)
    const isToday = p.q3.m === 10 && p.q3.d === 13
    if (c.id === 'nwb') {
      out.push({
        id: ev, companyId: c.id, title: 'Q3 2026', type: 'Earnings', date: q3date, status: 'past', durationSec: 2506,
        liveTime: p.q3.live, reportTiming: p.q3.timing,
        headline: 'Q3 organic growth reached 3.1%, as international strength offset North American margin pressure.',
        metrics: [
          { label: 'Revenue', actual: 25.27, estimate: 24.95, prior: 23.93, unit: 'B' },
          { label: 'EBITDA', actual: 5.17, estimate: 5.13, prior: 5.02, unit: 'B' },
          { label: 'EBIT', actual: 4.28, estimate: 4.28, prior: 4.11, unit: 'B' },
          { label: 'EPS', actual: 2.34, estimate: 2.30, prior: 2.29, unit: '' },
        ],
        summary: NWB_Q3_SUMMARY, transcript: NWB_Q3_TRANSCRIPT, slides: nwbSlides(2), reports: NWB_Q3_REPORTS, hasAudio: true,
      })
    } else if (c.id === 'hbw') {
      // handled below with monthly updates
    } else {
      const metrics = c.hasEstimates ? genMetrics(c, p, r, isPast || isToday) : undefined
      const growth = (r() * 8).toFixed(1)
      const headline = c.id === 'mrdb' ? 'EPS rose 13% as revenue grew across all four segments and returns strengthened.'
        : c.id === 'virc' ? 'Sales rose 5.9%; stronger operating momentum lifted FY2026 guidance despite special charges.'
        : c.id === 'solf' ? 'H1 sales grew 4.2% as loyalty-driven volumes offset price investment.'
        : `Q3 revenue rose ${growth}% with continued progress on ${p.themes[0]}.`
      const t = isPast || isToday ? genTranscript(c, p, 'Q3 2026 earnings', r, ev) : undefined
      out.push({
        id: ev, companyId: c.id, title: c.id === 'solf' ? 'H1 26/27' : 'Q3 2026', type: 'Earnings', date: q3date,
        status: isToday && c.id === 'mrdb' ? 'live' : isPast || isToday ? 'past' : 'upcoming',
        estimated: p.q3.est, durationSec: 2700 + Math.floor(r() * 1800), liveTime: p.q3.live, reportTiming: p.q3.timing,
        headline: isPast || isToday ? headline : undefined, metrics,
        transcript: t, summary: t ? genSummary(c, p, t, metrics, headline) : undefined,
        slides: isPast || isToday ? genSlides(c, p, 'Q3 2026', r) : undefined,
        reports: isPast || isToday ? genReports(c, ev, 'Q3 2026', headline, 3, false) : [], hasAudio: isPast || isToday,
      })
    }
    // Next quarter (upcoming)
    out.push({
      id: `${c.id}-q42026`, companyId: c.id, title: c.id === 'hbw' ? 'Q1 FY2027' : 'Q4 2026', type: 'Earnings',
      date: iso(2027, 2, Math.min(27, p.q3.d), 8), status: 'upcoming', estimated: true, durationSec: 3600,
      reportTiming: p.q3.timing, metrics: c.hasEstimates ? genMetrics(c, p, r, false) : undefined, reports: [], hasAudio: false,
    })
  }

  // Harbor Wholesale monthly sales updates and Q4 FY2026
  const hbwP = PROFILES.hbw
  const r = rng('hbw-monthly')
  const months: [string, number, number, number, string][] = [
    ['May 2026', 6, 3, 15, 'May net sales rose 8.1%, with comparable sales up 6.4% excluding gas and FX.'],
    ['June 2026', 7, 8, 15, 'June net sales rose 9.0%; e-commerce comparable sales grew 14%.'],
    ['July 2026', 8, 5, 15, 'July net sales rose 8.6%, with traffic up 5% worldwide.'],
    ['August 2026', 9, 2, 15, 'August net sales rose 9.4% on strong membership renewal trends.'],
    ['September 2026', 10, 6, 15, 'September net sales rose 13%, with comps up 7.6% excluding gas and FX.'],
  ]
  for (const [mon, m, d, h, headline] of months) {
    const ev = `hbw-msu-${mon.split(' ')[0].toLowerCase()}`
    const t = genTranscript(companyById('hbw'), hbwP, `Monthly Sales Update ${mon}`, r, ev)
    t.chapters = t.chapters.slice(0, 3)
    t.paragraphs = t.paragraphs.slice(0, 6)
    t.paragraphs[2].text = `Thanks. ${headline} Comparable sales by region were positive in the U.S., Canada and other international markets, and digitally-enabled comparable sales continued to outpace the business.`
    out.push({
      id: ev, companyId: 'hbw', title: `Monthly Sales Update ${mon}`, type: 'Monthly sales update', date: iso(2026, m, d, h), status: 'past',
      durationSec: 600 + Math.floor(r() * 300), liveTime: '15:15', reportTiming: 'Aftermarket', headline,
      transcript: t, summary: genSummary(companyById('hbw'), hbwP, t, undefined, headline),
      reports: [{ id: `${ev}-er`, kind: 'Report', title: `Monthly sales results, ${mon}`, pages: [{ blocks: [{ t: 'h', text: `Harbor Wholesale Reports ${mon} Sales Results` }, { t: 'p', text: headline }, { t: 'table', rows: [['', 'Comparable sales', 'Excl. gas & FX'], ['U.S.', '6.1%', '7.0%'], ['Canada', '8.4%', '9.2%'], ['Other international', '7.9%', '8.8%'], ['Total company', '6.6%', '7.6%'], ['Digitally-enabled', '13.5%', '13.8%']] }] }] }],
      hasAudio: true,
    })
  }
  const q4 = genTranscript(companyById('hbw'), hbwP, 'Q4 FY2026 earnings', r, 'hbw-q4fy26')
  out.push({
    id: 'hbw-q4fy26', companyId: 'hbw', title: 'Q4 FY2026', type: 'Earnings', date: iso(2026, 9, 24, 16), status: 'past', durationSec: 3715,
    liveTime: '16:00', reportTiming: 'Aftermarket', headline: 'Q4 net sales rose 8.2% and membership fee income grew 14% after the fee increase.',
    transcript: q4, summary: genSummary(companyById('hbw'), hbwP, q4, undefined, 'Q4 net sales rose 8.2% and membership fee income grew 14% after the fee increase.'),
    slides: [
      { key: 'cover', title: 'Supplemental Information', category: 'Cover', kind: 'cover', subtitle: 'Fourth Quarter FY 2026' },
      { key: 'kpis', title: 'Fourth quarter highlights', category: 'Financial results', kind: 'kpis', kpis: [{ label: 'Net sales', value: '$84.4B', delta: '+8.2%' }, { label: 'Membership fees', value: '$1.72B', delta: '+14%' }, { label: 'Renewal rate (US & CA)', value: '92.3%' }, { label: 'Warehouses', value: '914' }] },
      { key: 'trend', title: 'Comparable sales trend', category: 'Market overview', kind: 'bars', bars: [{ label: 'Q1', value: 6.1 }, { label: 'Q2', value: 6.9 }, { label: 'Q3', value: 7.4 }, { label: 'Q4', value: 7.9 }] },
      { key: 'strategy', title: 'Priorities for FY2027', category: 'Strategy', kind: 'text', bullets: ['New warehouse openings: 28–30', 'E-commerce and retail media', 'Membership growth and renewal'] },
    ],
    reports: [
      { id: 'hbw-q4fy26-er', kind: 'Earnings release', form: '8-K', title: 'Earnings release', pages: [{ blocks: [{ t: 'h', text: 'Harbor Wholesale Reports Fourth Quarter and Fiscal Year 2026 Results' }, { t: 'p', text: 'Net sales for the quarter increased 8.2% to $84.4 billion. Membership fee income rose 14%.' }] }] },
      { id: 'hbw-q4fy26-10k', kind: 'Annual report', form: '10-K', title: 'Annual report', pages: [{ blocks: [{ t: 'h', text: 'FORM 10-K' }, { t: 'p', text: 'Annual report for the fiscal year ended August 30, 2026.' }] }] },
    ],
    hasAudio: true,
  })
  out.push({ id: 'hbw-msu-october', companyId: 'hbw', title: 'Monthly Sales Update October 2026', type: 'Monthly sales update', date: iso(2026, 11, 4, 15, 15), status: 'upcoming', durationSec: 600, liveTime: '15:15', reportTiming: 'Aftermarket', reports: [], hasAudio: false })

  // Other event types
  const extra = (e: Partial<CompanyEvent> & Pick<CompanyEvent, 'id' | 'companyId' | 'title' | 'type' | 'date'>): CompanyEvent => ({
    status: 'past', durationSec: 2400, reports: [], hasAudio: true, ...e,
  })
  const conf = (cid: string, id: string, title: string, d: string) => {
    const c = companyById(cid)
    const t = genTranscript(c, PROFILES[cid], title, rng(id), id)
    t.chapters = [{ title: 'Fireside chat', start: 0 }, { title: 'Audience Q&A', start: 1180 }]
    t.paragraphs = t.paragraphs.slice(2, 6).concat(t.paragraphs.slice(7, 9)).map((p, i) => ({ ...p, chapter: i < 4 ? 0 : 1 }))
    t.qnaStart = 1180
    return extra({ id, companyId: cid, title, type: 'Conference', date: d, transcript: t, headline: `${c.name} discussed ${PROFILES[cid].themes[0]} and ${PROFILES[cid].themes[1]} at ${title}.`, slides: genSlides(c, PROFILES[cid], title, rng(id + 's')) })
  }
  out.push(
    conf('orbt', 'orbt-gscc', 'Goldfield Sachs Communications Conference 2026', iso(2026, 9, 10, 11)),
    conf('nwb', 'nwb-cagny', 'Consumer Analyst Group Conference 2026', iso(2026, 2, 18, 9)),
    conf('aurs', 'aurs-tech', 'Barrow 24th Annual Global Technology Conference', iso(2026, 9, 14, 13)),
    conf('pncr', 'pncr-rail', 'Northbridge Industrials Conference 2026', iso(2026, 9, 29, 10)),
    extra({ id: 'nwb-agm', companyId: 'nwb', title: 'AGM 2026', type: 'AGM', date: iso(2026, 5, 6, 9), headline: 'All management proposals passed; shareholder proposals failed.', reports: [] }),
    extra({ id: 'virc-agm', companyId: 'virc', title: 'AGM 2026', type: 'AGM', date: iso(2026, 10, 13, 8), headline: 'FY2026 growth and cash returns continued; all three shareholder proposals failed.', reports: [{ id: 'virc-agm-proxy', kind: 'Proxy statement', form: 'DEF 14A', title: 'Proxy statement', oneLiner: 'The Board recommends FOR all company proposals and AGAINST all shareholder proposals.', pages: [{ blocks: [{ t: 'h', text: 'Notice of 2026 Annual Meeting' }, { t: 'p', text: 'The Board recommends a vote FOR each director nominee and AGAINST each shareholder proposal.' }] }] }] }),
    extra({ id: 'hlxt-collab', companyId: 'hlxt', title: 'Collaboration', type: 'Update / briefing', date: iso(2026, 10, 1, 7), headline: 'Four long-acting antibodies expand the 50:50 Type 2 alliance, with up to $8B in milestones.', reports: [{ id: 'hlxt-collab-pr', kind: 'Report', title: 'Collaboration announcement', pages: [{ blocks: [{ t: 'h', text: 'Helix Therapeutics expands Type 2 inflammation alliance' }, { t: 'p', text: 'Four long-acting antibodies added under a 50:50 cost and profit share; up to $8 billion in development and commercial milestones.' }] }] }], hasAudio: true, transcript: undefined }),
    extra({ id: 'nwb-update', companyId: 'nwb', title: 'Status Update', type: 'Update / briefing', date: iso(2025, 12, 9, 8), headline: 'Portfolio review completed; productivity program expanded.' }),
    extra({ id: 'nwb-cmd', companyId: 'nwb', title: 'Capital Markets Day 2025', type: 'Capital markets day', date: iso(2025, 11, 12, 9), headline: 'New long-term algorithm targets 4–6% organic growth and high-single-digit EPS growth.' }),
    extra({ id: 'virc-proxy', companyId: 'virc', title: 'Proxy statement (additional)', type: 'Update / briefing', date: iso(2026, 10, 12, 16), hasAudio: false, headline: 'The 2026 plan seeks 12.1 million additional shares; the Board maintains its FOR recommendation.', reports: [{ id: 'virc-proxy-add', kind: 'Proxy statement', form: 'DEFA14A', title: 'Proxy statement (additional)', oneLiner: 'The 2026 plan seeks 12.1 million additional shares; the Board maintains its FOR recommendation.', pages: [{ blocks: [{ t: 'h', text: 'Additional proxy soliciting materials' }, { t: 'p', text: 'The 2026 Stock Incentive Plan seeks approval of 12.1 million additional shares.' }] }] }] }),
  )
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export const EVENTS: CompanyEvent[] = buildEvents()
export const eventById = (id: string) => EVENTS.find((e) => e.id === id)
export const eventsForCompany = (cid: string) => EVENTS.filter((e) => e.companyId === cid)

// Live event: Meridian Bancorp Q3 2026 started at 09:00 today; treat "now" in the sample world as 09:21.
export const LIVE_OFFSET_SEC = 21 * 60

export const PRESS_RELEASES: PressRelease[] = (() => {
  const list: PressRelease[] = []
  const add = (companyId: string, title: string, excerpt: string, date: string, language = 'English') =>
    list.push({ id: `pr-${list.length}`, companyId, title, excerpt, date, language })
  add('nwb', 'Northwind Beverages Becomes Official Hydration Partner of the Coastal Marathon Series', 'As official hydration partner, Northwind\'s Clearwave brand will supply finish-line refreshment at nine marathons across North America in 2027, bringing its zero-sugar electrolyte lineup to more than 300,000 runners. The partnership includes community running programs in each host city.', iso(2026, 9, 28, 19, 47))
  add('nwb', 'Northwind Beverages Elects Joaquin Delarosa to Board of Directors', 'Northwind Beverages today announced its Board of Directors has elected Joaquin Delarosa as an independent member. "We look forward to working with Joaquin on the Board," said Chairman and CEO Marcus Oyelaran. "During his more than three decades in consumer goods, he has led some of the industry\'s most successful transformations."', iso(2026, 9, 17, 15, 30))
  add('nwb', 'Three Ways Businesses Can Support Local Food Security', 'Strong communities aren\'t built overnight. Through partnerships that expand access to food and safe water, help prepare future leaders and support workforce development, Northwind\'s approach is focused on lasting impact in the communities where it operates.', iso(2026, 8, 26, 10))
  add('nwb', 'Northwind Beverages Announces Timing and Availability of Third-Quarter 2026 Financial Results', 'Northwind Beverages will issue its third-quarter 2026 financial results and other related information on Thursday, October 8, 2026, by posting the following materials to its investor website: Form 10-Q, press release, and prepared remarks.', iso(2026, 8, 25, 7))
  add('nwb', 'Northwind Bebidas anuncia expansión de su planta en Monterrey', 'La compañía invertirá 220 millones de dólares para ampliar la capacidad de producción de snacks en el norte de México.', iso(2026, 8, 20, 9), 'Spanish')
  for (const c of COMPANIES.filter((c) => c.id !== 'nwb')) {
    add(c.id, `${c.name} Announces Date for Third-Quarter 2026 Results`, `${c.name} will release results and host a conference call. A live webcast and replay will be available on the investor relations website.`, iso(2026, 9, 20, 8))
    add(c.id, `${c.name} Declares Quarterly Dividend`, `The Board of Directors of ${c.name} declared a regular quarterly dividend, payable to shareholders of record.`, iso(2026, 8, 12, 16, 5))
  }
  return list.sort((a, b) => b.date.localeCompare(a.date))
})()

export const MENTIONS: Mention[] = [
  { id: 'm1', fromCompanyId: 'solf', toCompanyId: 'nwb', count: 1, source: 'H1 26/27', date: iso(2026, 10, 12, 8), text: 'Solano Foods\' media arm helped bring exclusive Northwind snack launches to market.', docType: 'Report' },
  { id: 'm2', fromCompanyId: 'hbw', toCompanyId: 'nwb', count: 2, source: 'Q4 FY2026', date: iso(2026, 10, 2, 8), text: 'Identified as Harbor Wholesale\'s top-selling branded beverage supplier.', docType: 'Report' },
  { id: 'm3', fromCompanyId: 'virc', toCompanyId: 'nwb', count: 9, source: 'Investor presentation', date: iso(2026, 10, 1, 8), text: 'Named as an example of a partner brand in Vireo\'s joint retail media program.', docType: 'Slides' },
  { id: 'm4', fromCompanyId: 'pncr', toCompanyId: 'nwb', count: 1, source: 'Q2 2026', date: iso(2026, 9, 30, 8), text: 'Listed among shippers converting cross-border volumes from truck to rail.', docType: 'Transcript' },
  { id: 'm5', fromCompanyId: 'tslp', toCompanyId: 'nwb', count: 2, source: 'Investor presentation', date: iso(2026, 9, 29, 8), text: 'Listed among Tessel\'s enterprise merchants, with a relationship exceeding seven years.', docType: 'Slides' },
  { id: 'm6', fromCompanyId: 'strc', toCompanyId: 'nwb', count: 3, source: 'Q2 2026', date: iso(2026, 8, 3, 8), text: 'Cited as a customer case study for AI agents in demand planning.', docType: 'Transcript' },
  { id: 'm7', fromCompanyId: 'nwb', toCompanyId: 'hbw', count: 4, source: 'Q3 2026', date: iso(2026, 10, 8, 8), text: 'Club channel called out as a growth driver for value multipacks.', docType: 'Transcript' },
  { id: 'm8', fromCompanyId: 'nwb', toCompanyId: 'pncr', count: 1, source: 'Q2 2026', date: iso(2026, 7, 9, 8), text: 'Rail partnership referenced in logistics productivity savings.', docType: 'Report' },
  { id: 'm9', fromCompanyId: 'aurs', toCompanyId: 'strc', count: 2, source: 'Q2 2026', date: iso(2026, 9, 4, 8), text: 'Named as a hyperscale software customer for AI networking.', docType: 'Transcript' },
  { id: 'm10', fromCompanyId: 'kstl', toCompanyId: 'orbt', count: 1, source: 'Q2 2026', date: iso(2026, 7, 21, 8), text: 'Propulsion supply agreement referenced for upper-stage engines.', docType: 'Report' },
]

// Monthly counts for the "Mentions over time" chart (inbound, Northwind)
export const MENTION_MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((m, i) => {
  const r = rng('mm' + i)
  const y = i < 2 ? 2025 : 2026
  return { month: `${m} ${y}`, short: m, reports: Math.round(3 + r() * 26), slides: Math.round(2 + r() * 28), transcripts: Math.round(1 + r() * 10) }
})

export function activityFeed(): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const e of EVENTS) {
    if (e.status === 'upcoming') continue
    const age = (TODAY.getTime() - new Date(e.date).getTime()) / 86400000
    if (age > 14 || age < -1) continue
    const base = { companyId: e.companyId, eventId: e.id }
    const t = new Date(e.date).getTime()
    const at = (minutes: number) => new Date(t + minutes * 60000).toISOString()
    for (const r of e.reports) items.push({ ...base, id: `${r.id}-a`, label: `${r.title}${r.oneLiner ? '' : ` - ${e.title}`}`, oneLiner: r.oneLiner, docType: 'report', date: at(-30), openTab: 'report' })
    if (e.slides) items.push({ ...base, id: `${e.id}-sl`, label: `Slides - ${e.title}`, docType: 'slides', date: at(-25), openTab: 'slides' })
    if (e.hasAudio && e.status !== 'live') items.push({ ...base, id: `${e.id}-au`, label: `Audio & transcript - ${e.title}`, docType: 'audio', date: at(e.durationSec / 60 + 20), openTab: 'transcript' })
    if (e.status === 'live') items.push({ ...base, id: `${e.id}-live`, label: `Live now - ${e.title}`, docType: 'audio', date: at(0), openTab: 'transcript' })
  }
  return items.filter((i) => new Date(i.date) <= new Date(TODAY.getTime() + 6 * 3600000)).sort((a, b) => b.date.localeCompare(a.date))
}

export const RELEASE_NOTES = [
  { date: '13 Oct 2026', title: 'Keyword alerts can be filtered by watchlist', body: 'Pick a watchlist at the top of Keyword alerts to see only hits from those companies.' },
  { date: '2 Oct 2026', title: 'Continue listening on Home', body: 'Calls you started but did not finish now appear at the bottom of Home with your progress.' },
  { date: '24 Sep 2026', title: 'Mentions over time', body: 'The Mentions tab on a company page now charts inbound and outbound mentions by month and document type.' },
  { date: '16 Sep 2026', title: 'Team labels for workspaces', body: 'Admins can manage a shared set of labels in Settings, and anyone can tag a workspace with them.' },
  { date: '24 Aug 2026', title: 'Automations', body: 'Run a saved prompt automatically when a company publishes, or on a daily, weekly or monthly schedule.' },
]
