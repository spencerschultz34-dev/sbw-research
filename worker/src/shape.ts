// Turns AssemblyAI utterances plus speaker names into the transcript shape the app's CallView reads
// (the same shape api/calls.ts returns for EarningsCall): speakers, paragraphs, sentences with start times in seconds.
import type { Utterance } from './transcribe.ts'
import type { Naming } from './speakers.ts'

export interface Transcript {
  company: string; year: number; quarter: number; date: string | null; timed: boolean; qnaStart: string | null; audio: boolean; source: string
  speakers: Record<string, { name: string; title: string }>
  paragraphs: { id: string; speaker: string; start: number | null; sentences: { t: number | null; text: string }[] }[]
}

export function buildTranscript(utts: Utterance[], naming: Naming, meta: { company: string; year: number; quarter: number; date: string | null }): Transcript {
  const speakers: Transcript['speakers'] = {}
  for (const s of naming.speakers) speakers[s.id] = { name: s.name, title: s.title }
  const paragraphs: Transcript['paragraphs'] = []
  let qnaStart: string | null = null
  utts.forEach((u, i) => {
    const who = naming.byUtterance[i] ?? `speaker-${u.speaker.toLowerCase()}`
    if (!speakers[who]) speakers[who] = { name: `Speaker ${u.speaker}`, title: '' }
    const sentences = sentencesFromWords(u.words.length ? u.words : [{ text: u.text, start: u.start, end: u.end, speaker: u.speaker }])
    const last = paragraphs[paragraphs.length - 1]
    // Consecutive utterances by the same person read as one turn, unless Q&A starts in between.
    if (last && last.speaker === who && i !== naming.qnaStart) last.sentences.push(...sentences)
    else paragraphs.push({ id: `p${paragraphs.length + 1}`, speaker: who, start: sentences[0]?.t ?? null, sentences })
    if (i === naming.qnaStart) qnaStart = paragraphs[paragraphs.length - 1].id
  })
  return { ...meta, speakers, paragraphs, qnaStart, timed: true, audio: true, source: 'SBW recording' }
}

const ABBREV = /^(Mr|Mrs|Ms|Dr|Inc|Co|Corp|vs|St|U\.S|approx|No)\.$/i

function sentencesFromWords(words: { text: string; start: number }[]) {
  const out: { t: number; text: string }[] = []
  let buf: string[] = [], t0 = 0
  for (const w of words) {
    if (!buf.length) t0 = w.start
    buf.push(w.text)
    if (/[.!?]["')\]]?$/.test(w.text) && !ABBREV.test(w.text)) { out.push({ t: Math.round(t0 / 100) / 10, text: buf.join(' ') }); buf = [] }
  }
  if (buf.length) out.push({ t: Math.round(t0 / 100) / 10, text: buf.join(' ') })
  return out
}
