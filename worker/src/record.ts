// Saves a webcast stream as a small mono MP3 with ffmpeg. A replay (VOD) downloads as fast as the host allows;
// a live stream records in real time until it ends or maxSeconds passes.
import { spawn } from 'node:child_process'
import type { Found } from './discover.ts'

/** For an HLS master playlist, the lightest stream that carries the audio, so we don't download HD video. */
export async function pickVariant(found: Found): Promise<string> {
  if (!/\.m3u8(\?|$)/i.test(found.mediaUrl)) return found.mediaUrl
  const r = await fetch(found.mediaUrl, { headers: found.headers }).catch(() => null)
  if (!r?.ok) return found.mediaUrl
  const text = await r.text()
  const abs = (u: string) => new URL(u, r.url || found.mediaUrl).href
  // A separate audio rendition (#EXT-X-MEDIA:TYPE=AUDIO,...,URI="...") is the smallest choice.
  const audio = text.match(/#EXT-X-MEDIA:[^\n]*TYPE=AUDIO[^\n]*URI="([^"]+)"/)
  if (audio) return abs(audio[1])
  const variants = [...text.matchAll(/#EXT-X-STREAM-INF:([^\n]*)\n\s*([^#\s][^\n]*)/g)].map((m) => ({ bw: Number(m[1].match(/(?:^|,)BANDWIDTH=(\d+)/)?.[1] ?? Infinity), url: abs(m[2].trim()) }))
  if (!variants.length) return found.mediaUrl
  return variants.sort((a, b) => a.bw - b.bw)[0].url
}

export function record(input: string, headers: Record<string, string>, out: string, maxSeconds: number, log: (m: string) => void = () => {}) {
  const { 'User-Agent': ua, ...rest } = headers
  const args = [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
    ...(ua ? ['-user_agent', ua] : []),
    ...(Object.keys(rest).length ? ['-headers', Object.entries(rest).map(([k, v]) => `${k}: ${v}\r\n`).join('')] : []),
    '-rw_timeout', '30000000', '-reconnect', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '10',
    '-i', input,
    '-vn', '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '48k', '-t', String(maxSeconds),
    out,
  ]
  log(`Recording ${new URL(input).host} (up to ${Math.round(maxSeconds / 60)} min)`)
  return new Promise<void>((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => { err = (err + d).slice(-2000) })
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${err.trim().split('\n').slice(-3).join(' ')}`))))
  })
}

export function duration(file: string) {
  return new Promise<number>((resolve, reject) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.on('error', reject)
    p.on('close', () => resolve(Number(out.trim()) || 0))
  })
}
