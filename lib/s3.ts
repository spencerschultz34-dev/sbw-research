// Minimal S3 client (AWS Signature V4 over fetch + WebCrypto) for Cloudflare R2 or any S3-compatible store.
// Runs both in Vercel Edge Functions and in Node, so the app and the call worker share it.
// Settings: S3_ENDPOINT (e.g. https://<account>.r2.cloudflarestorage.com), S3_BUCKET, S3_ACCESS_KEY_ID,
// S3_SECRET_ACCESS_KEY and optionally S3_REGION (R2 uses "auto").

export interface S3Config { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region: string }

export function s3FromEnv(env: Record<string, string | undefined>): S3Config | null {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null
  return { endpoint: S3_ENDPOINT.replace(/\/+$/, ''), bucket: S3_BUCKET, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, region: env.S3_REGION || 'auto' }
}

const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
const sha256 = async (data: string | Uint8Array) => hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data))
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(msg))
}
// RFC 3986 encoding, keeping "/" in paths.
const uri = (s: string, slash = false) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(slash ? /%2F/g : /$^/, '/')

async function signingKey(c: S3Config, day: string) {
  let k = await hmac(enc.encode('AWS4' + c.secretAccessKey), day)
  for (const part of [c.region, 's3', 'aws4_request']) k = await hmac(k, part)
  return k
}

function stamp(now = new Date()) {
  const amz = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return { amz, day: amz.slice(0, 8) }
}

/** A time-limited GET link to a private object, for the browser's audio player. */
export async function presignGet(c: S3Config, key: string, expires = 3600, now = new Date()) {
  const { amz, day } = stamp(now)
  const url = new URL(`${c.endpoint}/${uri(c.bucket)}/${uri(key, true)}`)
  const scope = `${day}/${c.region}/s3/aws4_request`
  const q: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${c.accessKeyId}/${scope}`, 'X-Amz-Date': amz,
    'X-Amz-Expires': String(expires), 'X-Amz-SignedHeaders': 'host',
  }
  const query = Object.keys(q).sort().map((k) => `${uri(k)}=${uri(q[k])}`).join('&')
  const canonical = ['GET', url.pathname, query, `host:${url.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, await sha256(canonical)].join('\n')
  const sig = hex(await hmac(await signingKey(c, day), toSign))
  return `${url.origin}${url.pathname}?${query}&X-Amz-Signature=${sig}`
}

/** Uploads one object with a single signed PUT (fine for call recordings, which are tens of MB). */
export async function putObject(c: S3Config, key: string, body: Uint8Array, contentType: string, now = new Date()) {
  const { amz, day } = stamp(now)
  const url = new URL(`${c.endpoint}/${uri(c.bucket)}/${uri(key, true)}`)
  const scope = `${day}/${c.region}/s3/aws4_request`
  const hash = await sha256(body)
  const headers: Record<string, string> = { 'content-type': contentType, host: url.host, 'x-amz-content-sha256': hash, 'x-amz-date': amz }
  const names = Object.keys(headers).sort()
  const canonical = ['PUT', url.pathname, '', names.map((h) => `${h}:${headers[h]}\n`).join(''), names.join(';'), hash].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, await sha256(canonical)].join('\n')
  const sig = hex(await hmac(await signingKey(c, day), toSign))
  const { host: _host, ...sent } = headers
  const r = await fetch(url, {
    method: 'PUT', body,
    headers: { ...sent, authorization: `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}` },
  })
  if (!r.ok) throw new Error(`Upload to storage failed (${r.status}): ${(await r.text()).slice(0, 300)}`)
}
