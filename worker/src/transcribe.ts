// Speech to text with speaker labels and word timings, via AssemblyAI (ASSEMBLYAI_API_KEY).
// About $0.23 per hour of audio with speaker labels; new accounts start with free hours.
import { readFile } from 'node:fs/promises'

const API = 'https://api.assemblyai.com/v2'

export interface Word { text: string; start: number; end: number; speaker: string | null }
export interface Utterance { speaker: string; start: number; end: number; text: string; words: Word[] }

export async function transcribe(file: string, log: (m: string) => void = () => {}): Promise<Utterance[]> {
  const key = process.env.ASSEMBLYAI_API_KEY
  if (!key) throw new Error('ASSEMBLYAI_API_KEY is not set')
  const auth = { authorization: key }

  const up = await fetch(`${API}/upload`, { method: 'POST', headers: { ...auth, 'content-type': 'application/octet-stream' }, body: await readFile(file) })
  if (!up.ok) throw new Error(`AssemblyAI upload failed (${up.status}): ${await up.text()}`)
  const { upload_url } = (await up.json()) as { upload_url: string }

  const sub = await fetch(`${API}/transcript`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, speaker_labels: true, language_code: 'en_us', punctuate: true, format_text: true }),
  })
  if (!sub.ok) throw new Error(`AssemblyAI rejected the job (${sub.status}): ${await sub.text()}`)
  const { id } = (await sub.json()) as { id: string }
  log(`Transcribing (AssemblyAI job ${id})`)

  for (let i = 0; i < 360; i++) { // up to an hour
    await new Promise((r) => setTimeout(r, 10_000))
    const r = await fetch(`${API}/transcript/${id}`, { headers: auth })
    if (!r.ok) continue
    const t = (await r.json()) as { status: string; error?: string; utterances?: Utterance[] }
    if (t.status === 'completed') return t.utterances ?? []
    if (t.status === 'error') throw new Error(`AssemblyAI failed: ${t.error}`)
  }
  throw new Error('AssemblyAI took longer than an hour')
}
