import { COMPANIES, EVENTS } from './data'
import { companyById } from './data/companies'
import type { Citation } from './data/types'
import { fmtDate, fmtNum, pctChange } from './format'

export interface AnswerCite { n: number; eventId: string; tab: Citation['tab'] | 'overview'; ref?: string; label: string }
export type AnswerBlock =
  | { t: 'p'; text: string; cites?: number[] }
  | { t: 'h'; text: string }
  | { t: 'ul'; items: { text: string; cites?: number[] }[] }
  | { t: 'table'; head: string[]; rows: string[][] }
export interface Answer { blocks: AnswerBlock[]; cites: AnswerCite[]; followups: string[] }

const STOP = new Set('a an the of to in on for and or with what did does do is are was were how about say said tell me show give please can you from at by as it its this that their they them vs versus latest last quarter call company companies table chart compare summarize summary overview provide main business segments outlook'.split(' '))

export function detectCompanies(text: string, scope: string[] = []) {
  const l = text.toLowerCase()
  const hits = COMPANIES.filter((c) => l.includes(c.name.toLowerCase()) || l.includes(c.name.split(' ')[0].toLowerCase() + ' ') || new RegExp(`\\b${c.ticker.toLowerCase()}\\b`).test(l)).map((c) => c.id)
  return [...new Set([...scope, ...hits])]
}

export function answer(question: string, scope: string[] = [], watchlistIds: string[] = []): Answer {
  let ids = detectCompanies(question, scope)
  if (!ids.length && watchlistIds.length) ids = watchlistIds
  const cites: AnswerCite[] = []
  const cite = (c: Omit<AnswerCite, 'n'>) => {
    const ex = cites.find((x) => x.eventId === c.eventId && x.ref === c.ref && x.tab === c.tab)
    if (ex) return ex.n
    const n = cites.length + 1
    cites.push({ ...c, n })
    return n
  }
  const l = question.toLowerCase()
  const terms = l.replace(/[@"?.,]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !COMPANIES.some((c) => c.name.toLowerCase().includes(w) || c.ticker.toLowerCase() === w))
  const wantTable = /table|compare|beat|miss|versus|vs\.?/.test(l) || ids.length > 2
  const blocks: AnswerBlock[] = []

  if (!ids.length) {
    // Theme search across everything
    const paras = EVENTS.flatMap((e) => (e.transcript?.paragraphs ?? []).map((p) => ({ e, p }))).filter(({ p }) => terms.some((t) => p.text.toLowerCase().includes(t)))
    if (!paras.length) {
      return {
        blocks: [{ t: 'p', text: 'I could not find that in the transcripts loaded so far. Open a company\'s latest call first, or name a company with @.' }],
        cites: [], followups: ['What did @Apple Inc. say about services growth?', 'Which companies discussed AI capex?', 'Compare the latest results for @SBW WL in a table'],
      }
    }
    const byCo = new Map<string, typeof paras>()
    paras.forEach((x) => byCo.set(x.e.companyId, [...(byCo.get(x.e.companyId) ?? []), x]))
    blocks.push({ t: 'p', text: `${byCo.size} compan${byCo.size === 1 ? 'y has' : 'ies have'} discussed this in recent events:` })
    blocks.push({ t: 'ul', items: [...byCo.entries()].slice(0, 6).map(([cid, xs]) => {
      const { e, p } = xs[0]
      const sp = e.transcript!.speakers[p.speaker]
      return { text: `${companyById(cid).name} (${e.title}): ${sp.name} said, "${firstSentenceWith(p.text, terms)}"`, cites: [cite({ eventId: e.id, tab: 'transcript', ref: p.id, label: `${companyById(cid).name} · ${e.title} · ${sp.name}` })] }
    }) })
    return { blocks, cites, followups: ['Show this as a table', 'Which of these are in my watchlists?', 'How has this language changed over the last four quarters?'] }
  }

  const latest = (cid: string) => EVENTS.find((e) => e.companyId === cid && e.status !== 'upcoming' && e.summary)
  if (wantTable) {
    blocks.push({ t: 'p', text: `Latest reported results for ${ids.length} compan${ids.length === 1 ? 'y' : 'ies'}, against consensus where available:` })
    const rows: string[][] = []
    for (const cid of ids) {
      const e = latest(cid)
      if (!e) continue
      const rev = e.metrics?.find((m) => m.label === 'Revenue')
      const eps = e.metrics?.find((m) => m.label === 'EPS')
      const n = cite({ eventId: e.id, tab: 'overview', label: `${companyById(cid).name} · ${e.title} summary` })
      rows.push([
        companyById(cid).name, `${e.title} (${fmtDate(e.date)})`,
        rev?.actual ? `${fmtNum(rev.actual, 'B')} (${signed(pctChange(rev.actual, rev.estimate))})` : '–',
        eps?.actual ? `${eps.actual.toFixed(2)} (${signed(pctChange(eps.actual, eps.estimate))})` : '–',
        `${e.headline ?? ''} [${n}]`,
      ])
    }
    blocks.push({ t: 'table', head: ['Company', 'Event', 'Revenue vs est.', 'EPS vs est.', 'Takeaway'], rows })
    return { blocks, cites, followups: ['Which company had the biggest beat?', 'Chart revenue surprise by company', 'What did management say about guidance?'] }
  }

  for (const cid of ids.slice(0, 2)) {
    const c = companyById(cid)
    const e = latest(cid)
    if (!e) { blocks.push({ t: 'p', text: `${c.name} has not reported an event with a transcript yet.` }); continue }
    const paras = e.transcript?.paragraphs.filter((p) => terms.some((t) => p.text.toLowerCase().includes(t))) ?? []
    blocks.push({ t: 'h', text: `${c.name}, ${e.title}` })
    blocks.push({ t: 'p', text: e.headline ?? '', cites: [cite({ eventId: e.id, tab: 'overview', label: `${c.name} · ${e.title} summary` })] })
    if (paras.length) {
      blocks.push({ t: 'ul', items: paras.slice(0, 4).map((p) => {
        const sp = e.transcript!.speakers[p.speaker]
        return { text: `${sp.name}${sp.role ? ` (${sp.role.split(',')[0]})` : ''}: "${firstSentenceWith(p.text, terms)}"`, cites: [cite({ eventId: e.id, tab: 'transcript', ref: p.id, label: `${c.name} · ${e.title} · ${sp.name}` })] }
      }) })
    } else {
      blocks.push({ t: 'ul', items: e.summary!.flatMap((s) => s.bullets).slice(0, 4).map((b) => ({
        text: b.text, cites: b.cites.slice(0, 1).map((ct) => cite({ eventId: e.id, tab: ct.tab, ref: ct.ref, label: `${c.name} · ${e.title} · ${ct.tab}` })),
      })) })
    }
  }
  const t = terms[0]
  return {
    blocks, cites,
    followups: [
      'Compare with the prior quarter',
      t ? `What did analysts ask about ${t}?` : 'What did analysts focus on in Q&A?',
      'Show the key numbers as a table',
    ],
  }
}

export function automationAnswer(watchlistIds: string[]): Answer {
  const a = answer('Compare the latest results in a table', [], watchlistIds.slice(0, 6))
  a.blocks.unshift({ t: 'p', text: 'Automation run: companies in SBW WL that reported since the last run. Changes versus the prior event are summarized below.' })
  return a
}

function firstSentenceWith(text: string, terms: string[]) {
  const s = text.match(/.+?[.!?](?=\s|$)/g) ?? [text]
  return (s.find((x) => terms.some((t) => x.toLowerCase().includes(t))) ?? s[0]).trim()
}
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
