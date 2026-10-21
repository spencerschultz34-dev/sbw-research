// Speech-to-text labels voices "A", "B", ... Claude reads the call's own introductions ("Our next question comes
// from Keith Weiss with Morgan Stanley") and names each turn, and marks where Q&A starts. Needs ANTHROPIC_API_KEY;
// without it the transcript keeps "Speaker A" labels and Q&A is found by a simple phrase match.
import Anthropic from '@anthropic-ai/sdk'
import type { Utterance } from './transcribe.ts'

export interface Naming { speakers: { id: string; name: string; title: string }[]; byUtterance: Record<number, string>; qnaStart: number | null }

const QNA = /\b(first|next|following) question\b|\bopen (it|the (call|line)) (up )?for questions\b|\bquestion[- ]and[- ]answer session\b/i

export function plainNaming(utts: Utterance[]): Naming {
  // The operator announces the first question; Q&A starts with the turn after that announcement.
  const i = utts.findIndex((u, k) => k > 2 && QNA.test(u.text))
  return { speakers: [], byUtterance: {}, qnaStart: i >= 0 ? Math.min(i + 1, utts.length - 1) : null }
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['speakers', 'turns', 'qna_start'],
  properties: {
    speakers: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'name', 'title'],
        properties: {
          id: { type: 'string', description: 'Short lowercase slug, e.g. "amy-hood" or "operator"' },
          name: { type: 'string', description: 'Full name as said on the call, or "Operator"' },
          title: { type: 'string', description: 'Role and company, e.g. "CFO, Microsoft" or "Analyst, Morgan Stanley"; empty if unknown' },
        },
      },
    },
    turns: {
      type: 'array',
      description: 'One entry per numbered turn, saying who spoke it',
      items: { type: 'object', additionalProperties: false, required: ['i', 'id'], properties: { i: { type: 'integer' }, id: { type: 'string' } } },
    },
    qna_start: { type: ['integer', 'null'], description: 'Number of the turn where the first analyst question begins, or null if there is no Q&A' },
  },
} as const

export async function nameSpeakers(utts: Utterance[], company: string, log: (m: string) => void = () => {}): Promise<Naming> {
  if (!process.env.ANTHROPIC_API_KEY || !utts.length) return plainNaming(utts)
  const lines = utts.map((u, i) => `[${i}] voice ${u.speaker}: ${u.text.length > 700 ? u.text.slice(0, 500) + ' … ' + u.text.slice(-150) : u.text}`).join('\n')
  const client = new Anthropic()
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: 'You label speakers in earnings call transcripts. Voice letters come from automatic diarization: the same person can appear under more than one letter, and different people (often the analysts) can share a letter. Use the introductions on the call (the operator, the IR host, executives handing over, "our next question comes from ...") to name the person speaking each turn. Use one id per real person. Only use names that are said on the call; if a turn\'s speaker cannot be told, give it the id "unknown-<voice letter>" and name "Unknown speaker".',
      messages: [{ role: 'user', content: `${company} earnings call, ${utts.length} turns:\n\n${lines}` }],
    })
    if (res.stop_reason === 'refusal') throw new Error('declined')
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const out = JSON.parse(text) as { speakers: Naming['speakers']; turns: { i: number; id: string }[]; qna_start: number | null }
    const byUtterance: Record<number, string> = {}
    for (const t of out.turns) if (t.i >= 0 && t.i < utts.length) byUtterance[t.i] = t.id
    for (const s of out.speakers) if (/^unknown/.test(s.id) && !s.name) s.name = 'Unknown speaker'
    const qnaStart = Number.isInteger(out.qna_start) && out.qna_start! >= 0 && out.qna_start! < utts.length ? out.qna_start : plainNaming(utts).qnaStart
    log(`Named ${out.speakers.length} speakers`)
    return { speakers: out.speakers, byUtterance, qnaStart }
  } catch (e) {
    log(`Speaker naming skipped: ${(e as Error).message}`)
    return plainNaming(utts)
  }
}
