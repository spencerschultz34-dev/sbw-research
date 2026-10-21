// Where finished calls go: the MP3 in S3-compatible storage (Cloudflare R2), the row in Supabase (table "calls",
// see supabase/calls.sql). Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY plus the S3_* settings in lib/s3.ts.
import { readFile } from 'node:fs/promises'
import { putObject, s3FromEnv } from '../../lib/s3.ts'

export interface CallRow {
  symbol: string; year: number; quarter: number; exchange?: string; company?: string; title?: string; event_date?: string | null
  event_page?: string | null; media_url?: string | null; audio_key?: string | null; duration_sec?: number | null
  transcript?: unknown; status?: 'pending' | 'done' | 'failed'; error?: string | null; attempts?: number
}

const SB_URL = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export const storeReady = () => !!(SB_URL && SB_KEY && s3FromEnv(process.env))

async function sb(path: string, init: RequestInit = {}) {
  if (!SB_URL || !SB_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set')
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SB_URL)) throw new Error('SUPABASE_URL is not a valid Supabase project URL. In GitHub Actions secrets, use https://<project-ref>.supabase.co (not the dashboard URL).')
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', ...init.headers } })
  if (!r.ok) throw new Error(`Supabase ${init.method ?? 'GET'} ${path.split('?')[0]} returned ${r.status}: ${(await r.text()).slice(0, 300)}`)
  if (init.method !== 'POST' && !(r.headers.get('content-type') ?? '').includes('application/json')) throw new Error(`Supabase returned ${r.status} with a non-JSON response. Check that GitHub Actions secret SUPABASE_URL is the project API URL and the project is active.`)
  return r
}

export async function existing(symbol: string): Promise<Pick<CallRow, 'year' | 'quarter' | 'status' | 'attempts'>[]> {
  return (await sb(`calls?symbol=eq.${encodeURIComponent(symbol)}&select=year,quarter,status,attempts`)).json()
}

export async function save(row: CallRow) {
  await sb('calls?on_conflict=symbol,year,quarter', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
  })
}

export async function uploadAudio(file: string, key: string) {
  const s3 = s3FromEnv(process.env)
  if (!s3) throw new Error('S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are not set')
  await putObject(s3, key, new Uint8Array(await readFile(file)), 'audio/mpeg')
}
