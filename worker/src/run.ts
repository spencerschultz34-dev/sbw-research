// The call pipeline: for each company in companies.json, read its IR site for earnings events, and for every call
// that has happened but isn't stored yet: find the webcast stream, record it, transcribe it, name the speakers,
// and store the audio and transcript where the app's /api/calls reads them.
//
//   node src/run.ts                         all companies, new calls only
//   node src/run.ts --symbol MSFT           one company
//   node src/run.ts --symbol MSFT --url <webcast or event page> --year 2026 --quarter 4 [--date 2026-07-29]
//   add --dry-run to only find the stream and record a minute of it (no keys needed, nothing stored)
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import irHandler, { periodOf } from '../../api/ir.ts'
import type { IrEvent, IrSite } from '../../api/ir.ts'
import { findStream } from './discover.ts'
import { duration, pickVariant, record } from './record.ts'
import { transcribe } from './transcribe.ts'
import { nameSpeakers } from './speakers.ts'
import { buildTranscript } from './shape.ts'
import { existing, save, storeReady, uploadAudio } from './store.ts'

// `webcast`: a fixed page that always carries the latest call (Apple's, for one), tried for the newest call only.
interface Company { symbol: string; exchange: string; name: string; ir: string; fye: string; webcast?: string }
interface Job { company: Company; year: number; quarter: number; date: string | null; title: string; page: string | null; urls: string[] }

const { values: args } = parseArgs({
  options: {
    symbol: { type: 'string' }, url: { type: 'string' }, year: { type: 'string' }, quarter: { type: 'string' }, date: { type: 'string' },
    'dry-run': { type: 'boolean', default: false }, max: { type: 'string', default: '3' }, since: { type: 'string', default: '200' },
  },
})
const DRY = args['dry-run']!
const MAX_ATTEMPTS = 6 // the schedule runs every 3 hours, so a call is retried for about 18 hours
const MIN_SECONDS = 10 * 60 // anything shorter is a holding slate or a teaser, not the call
const dryOk: string[] = [], dryFailed: string[] = []
const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`)

/** Fiscal year and quarter of a call held on `date`, for a company whose fiscal year ends on MMDD. */
function fiscalOf(date: string, fye: string) {
  // Calls come 2 to 8 weeks after the quarter closes; step back 45 days to land inside the quarter reported on.
  const d = new Date(Date.parse(date) - 45 * 864e5)
  const m = d.getUTCMonth() + 1, y = d.getUTCFullYear()
  const endMonth = new Date(Date.UTC(2001, Number(fye.slice(0, 2)) - 1, Number(fye.slice(2)) - 15)).getUTCMonth() + 1
  return { year: m <= endMonth ? y : y + 1, quarter: Math.floor(((m - endMonth - 1 + 12) % 12) / 3) + 1 }
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout
  return Promise.race([p, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })]).finally(() => clearTimeout(timer))
}

async function irSite(url: string): Promise<IrSite> {
  const r = await irHandler(new Request(`https://worker.local/api/ir?type=site&url=${encodeURIComponent(url)}`))
  const body = await r.json()
  if (!r.ok) throw new Error(body.error ?? `IR reader returned ${r.status}`)
  return body as IrSite
}

function jobFor(company: Company, e: IrEvent): Job | null {
  if (e.type !== 'earnings' || !e.date) return null
  const p = periodOf(e.title)
  const { year, quarter } = p ? { year: p.y, quarter: p.q } : fiscalOf(e.date, company.fye)
  const urls = [...e.documents.filter((d) => d.kind === 'webcast').map((d) => d.url), ...(e.page ? [e.page] : [])]
  return urls.length ? { company, year, quarter, date: e.date, title: e.title, page: e.page, urls } : null
}

async function jobsFor(company: Company, sinceDays: number): Promise<Job[]> {
  const site = await irSite(company.ir)
  const now = Date.now()
  const jobs = site.events
    .filter((e) => e.date && Date.parse(e.date) < now - 3 * 3600e3 && Date.parse(e.date) > now - sinceDays * 864e5)
    .map((e) => jobFor(company, e)).filter((j): j is Job => !!j)
  if (DRY || !storeReady()) return jobs
  const have = await existing(company.symbol)
  return jobs.filter((j) => {
    const row = have.find((r) => r.year === j.year && r.quarter === j.quarter)
    return !row || (row.status !== 'done' && (row.attempts ?? 0) < MAX_ATTEMPTS)
  })
}

async function process1(job: Job, attempts: number) {
  const { company, year, quarter } = job
  const tag = `${company.symbol} FY${year} Q${quarter}`
  log(`${tag}: ${job.title}`)
  const dir = await mkdtemp(join(tmpdir(), 'call-'))
  const base = { symbol: company.symbol, year, quarter, exchange: company.exchange, company: company.name, title: job.title, event_date: job.date, event_page: job.page }
  try {
    const found = await withTimeout(findStream(job.urls, { log }), 12 * 60_000, 'Looking for the webcast stream took over 12 minutes')
    if (!found) throw new Error('No webcast stream found on the event pages (the replay may not be up yet, or the player needs a reader of its own)')
    const input = await pickVariant(found)
    log(`${tag}: stream ${new URL(input).origin}${new URL(input).pathname}`) // no query: it can hold access tokens, and Actions logs are public
    const mp3 = join(dir, 'call.mp3')
    await record(input, found.headers, mp3, DRY ? 60 : 4 * 3600, log)
    const secs = Math.round(await duration(mp3))
    log(`${tag}: recorded ${Math.floor(secs / 60)} min ${secs % 60} s, ${((await readFile(mp3)).length / 1e6).toFixed(1)} MB`)
    if (DRY) return void dryOk.push(tag)
    if (secs < MIN_SECONDS) throw new Error(`The recording is only ${Math.round(secs / 60)} minutes long, so it is probably a holding slate, not the call`)

    const utts = await transcribe(mp3, log)
    const naming = await nameSpeakers(utts, company.name, log)
    const transcript = buildTranscript(utts, naming, { company: company.name, year, quarter, date: job.date })
    const key = `calls/${company.symbol}/${year}-Q${quarter}.mp3`
    await uploadAudio(mp3, key)
    await save({ ...base, media_url: found.mediaUrl, audio_key: key, duration_sec: secs, transcript, status: 'done', error: null, attempts: attempts + 1 })
    log(`${tag}: stored (${transcript.paragraphs.length} turns, ${Object.keys(transcript.speakers).length} speakers)`)
  } catch (e) {
    const msg = (e as Error).message
    log(`${tag}: failed: ${msg}`)
    if (!DRY && storeReady()) await save({ ...base, status: 'failed', error: msg.slice(0, 1000), attempts: attempts + 1 }).catch((x) => log(`Could not save the failure: ${x.message}`))
    if (DRY) dryFailed.push(tag)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function main() {
  if (!DRY && !storeReady()) throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and the S3_* storage settings, or pass --dry-run')
  const all = JSON.parse(await readFile(new URL('../companies.json', import.meta.url), 'utf8')) as Company[]
  const companies = args.symbol ? all.filter((c) => c.symbol === args.symbol!.toUpperCase()) : all
  if (!companies.length) throw new Error(`${args.symbol} is not in companies.json`)

  if (args.url) {
    const c = companies[0]
    const date = args.date ? new Date(args.date).toISOString() : null
    const p = args.year && args.quarter ? { year: Number(args.year), quarter: Number(args.quarter) } : date ? fiscalOf(date, c.fye) : null
    if (!p) throw new Error('Pass --year and --quarter (or --date) with --url')
    const prev = !DRY && storeReady() ? (await existing(c.symbol)).find((r) => r.year === p.year && r.quarter === p.quarter) : undefined
    return process1({ company: c, ...p, date, title: `${c.name} FY${p.year} Q${p.quarter} earnings call`, page: args.url, urls: [args.url] }, prev?.attempts ?? 0)
  }

  let budget = Number(args.max)
  for (const c of companies) {
    let jobs: Job[]
    try { jobs = await jobsFor(c, Number(args.since)) } catch (e) { log(`${c.symbol}: could not read ${c.ir}: ${(e as Error).message}`); continue }
    log(`${c.symbol}: ${jobs.length} call(s) to do`)
    // Newest first, so a fresh call isn't stuck behind a backlog. A dry run only checks the latest call.
    const todo = jobs.sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!)).slice(0, DRY ? 1 : undefined)
    if (c.webcast && todo[0]) todo[0].urls.push(c.webcast)
    for (const j of todo) {
      if (budget-- <= 0) return log('Reached --max for this run; the rest wait for the next one')
      const prev = storeReady() && !DRY ? (await existing(c.symbol)).find((r) => r.year === j.year && r.quarter === j.quarter) : undefined
      await process1(j, prev?.attempts ?? 0)
    }
  }
}

/** A dry run passes when at least one call was found and recorded; old replays do get taken down. */
function dryVerdict() {
  if (!DRY) return
  log(`Dry run: recorded ${dryOk.join(', ') || 'nothing'}; no stream for ${dryFailed.join(', ') || 'none'}`)
  for (const t of dryFailed) console.log(`::warning::No webcast stream found for ${t}`)
  if (!dryOk.length) process.exitCode = 1
}

// Exit explicitly: a browser left open by a timed-out search would otherwise keep the process alive.
main().then(dryVerdict).then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e.message); process.exit(1) })
