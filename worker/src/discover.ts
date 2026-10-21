// Finds the audio/video stream behind an earnings webcast page.
// Webcast players differ by vendor (Q4, Notified, Cvent, ON24, Microsoft's own, ...), so instead of one reader per
// vendor this opens the page in headless Chromium, fills in the attendee form if one is shown, presses play and
// watches the network for the stream (HLS .m3u8, or a plain MP4/MP3/M4A file).
import { chromium, type Browser, type Page } from 'playwright'

export interface Found { mediaUrl: string; headers: Record<string, string>; pageUrl: string }

export const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const MEDIA = /\.(m3u8|mp4|m4a|mp3|aac)(\?|$)/i
// Short clips that are not the call: ads, intros, hold music, player chrome.
const NOT_CALL = /(^|[/_.-])(ads?|preroll|intro|bumper|promo|hold|music|silence|blank|logo|poster|thumbnail)([/_.-]|$)/i
// Links on an event page that lead to the webcast player.
const PLAYER = /webcast|listen|replay|player|q4inc\.com|notified|media-server\.com|webcasts\.com|on24|cvent|onlinexperiences|webcaster|choruscall|brightcove|vimeo|medius|zoom\.us\/(rec|webinar)|livestream/i

/** Who we register as when a webcast asks for attendee details. Set WEBCAST_* in the worker's environment. */
function attendee(env = process.env) {
  return {
    first: env.WEBCAST_FIRST_NAME || 'SBW',
    last: env.WEBCAST_LAST_NAME || 'Research',
    email: env.WEBCAST_EMAIL || env.SEC_CONTACT_EMAIL || 'research@sbw-invest.com',
    company: env.WEBCAST_COMPANY || 'SBW Research',
    title: env.WEBCAST_TITLE || 'Analyst',
  }
}

export async function findStream(urls: string[], opts: { timeoutMs?: number; log?: (m: string) => void } = {}): Promise<Found | null> {
  const log = opts.log ?? (() => {})
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] })
  try {
    const seen = new Set<string>()
    const queue = [...new Set(urls)].map((u) => ({ url: u, depth: 0 }))
    while (queue.length) {
      const { url, depth } = queue.shift()!
      if (seen.has(url) || seen.size >= 6) continue
      seen.add(url)
      log(`Opening ${url}`)
      const r = await tryPage(browser, url, opts.timeoutMs ?? 60_000, log)
      if (r.found) return r.found
      if (depth < 2) for (const next of r.links) if (!seen.has(next)) queue.push({ url: next, depth: depth + 1 })
    }
    return null
  } finally {
    await browser.close()
  }
}

async function tryPage(browser: Browser, url: string, timeoutMs: number, log: (m: string) => void): Promise<{ found: Found | null; links: string[] }> {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'en-US' })
  let page = await ctx.newPage()
  ctx.on('page', (p) => { page = p }) // players that open in a new window
  const hits: { url: string; referer: string }[] = []
  ctx.on('request', (req) => {
    const u = req.url()
    if (!/^https?:/.test(u) || !MEDIA.test(u) || NOT_CALL.test(new URL(u).pathname)) return
    hits.push({ url: u, referer: req.headers()['referer'] ?? req.frame()?.url() ?? url })
  })
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    const deadline = Date.now() + timeoutMs
    let registered = false, played = 0
    while (Date.now() < deadline && !best(hits)) {
      if (!registered && (registered = await register(page))) {
        log('Filled in the attendee form')
        await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
      }
      if (played < 3 && await play(page)) { played++; log('Pressed play') }
      await new Promise((r) => setTimeout(r, 3000))
    }
    const hit = best(hits)
    if (hit) {
      const cookies = await ctx.cookies(hit.url)
      const headers: Record<string, string> = { 'User-Agent': UA, Referer: hit.referer }
      if (cookies.length) headers.Cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
      return { found: { mediaUrl: hit.url, headers, pageUrl: url }, links: [] }
    }
    return { found: null, links: await playerLinks(page) }
  } catch (e) {
    log(`Could not read ${url}: ${(e as Error).message.split('\n')[0]}`)
    return { found: null, links: [] }
  } finally {
    await ctx.close()
  }
}

/** The stream to record: an HLS playlist if there is one (the master, seen first), otherwise the longest-looking file. */
function best(hits: { url: string; referer: string }[]) {
  return hits.find((h) => /\.m3u8(\?|$)/i.test(h.url)) ?? hits.find((h) => /\.(mp3|m4a|aac)(\?|$)/i.test(h.url)) ?? hits.find((h) => /\.mp4(\?|$)/i.test(h.url))
}

/** Fills in a visible attendee form (name, email, company) and submits it. Returns true if a form was sent. */
async function register(page: Page): Promise<boolean> {
  const who = attendee()
  for (const f of page.frames()) {
    const email = f.locator('input[type=email]:visible, input[name*=mail i]:visible, input[id*=mail i]:visible').first()
    if (!(await email.count().catch(() => 0))) continue
    const fill = async (re: string, value: string) => {
      for (const input of await f.locator('input:visible:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=submit])').all()) {
        const attrs = await input.evaluate((x: HTMLInputElement) => [x.name, x.id, x.placeholder, x.getAttribute('aria-label') ?? '', x.labels?.[0]?.textContent ?? '', x.type].join(' ')).catch(() => '')
        if (new RegExp(re, 'i').test(attrs) && !(await input.inputValue().catch(() => 'x'))) await input.fill(value).catch(() => {})
      }
    }
    await fill('first|given|fname', who.first)
    await fill('last|surname|family|lname', who.last)
    await fill('^(?!.*(first|last)).*\\bname\\b', `${who.first} ${who.last}`)
    await fill('mail', who.email)
    await fill('company|organi[sz]ation|firm|employer', who.company)
    await fill('title|position|role', who.title)
    // Dropdowns (country, investor type): pick the first real option. Checkboxes: consent / terms.
    for (const sel of await f.locator('select:visible').all()) {
      await sel.evaluate((s: HTMLSelectElement) => {
        if (s.selectedIndex > 0 || s.options.length < 2) return
        const pick = [...s.options].findIndex((o, i) => i > 0 && /united states|^us$|investor|analyst/i.test(o.text))
        s.selectedIndex = pick > 0 ? pick : 1
        s.dispatchEvent(new Event('change', { bubbles: true }))
      }).catch(() => {})
    }
    for (const box of await f.locator('input[type=checkbox]:visible').all()) await box.check({ timeout: 1000 }).catch(() => {})
    const submit = f.locator('button[type=submit]:visible, input[type=submit]:visible')
      .or(f.locator('button:visible').filter({ hasText: /register|submit|continue|enter|join|watch|listen|access/i })).first()
    if (await submit.count()) { await submit.click({ timeout: 5000 }).catch(() => {}); return true }
    await email.press('Enter').catch(() => {})
    return true
  }
  return false
}

/** Presses the most likely play button in any frame. */
async function play(page: Page): Promise<boolean> {
  for (const f of page.frames()) {
    const btn = f.locator('button[aria-label*="play" i]:visible, .vjs-big-play-button:visible, [class*="play-button" i]:visible, [class*="playbutton" i]:visible, [class*="btn-play" i]:visible')
      .or(f.locator('button:visible, [role=button]:visible').filter({ hasText: /^\s*(play|listen|watch|replay|launch|join)\b/i }))
      .or(f.locator('a:visible').filter({ hasText: /^\s*(listen|watch|play|replay)\b/i })).first()
    if (await btn.count().catch(() => 0)) {
      if (await btn.click({ timeout: 3000 }).then(() => true, () => false)) return true
    }
    const media = f.locator('video, audio').first()
    if (await media.count().catch(() => 0)) {
      if (await media.evaluate((m: HTMLMediaElement) => m.play().then(() => true, () => false)).catch(() => false)) return true
    }
  }
  return false
}

/** Links and frames on the page that look like they lead to the webcast player. */
async function playerLinks(page: Page): Promise<string[]> {
  const out = new Set<string>()
  for (const f of page.frames()) {
    const urls = await f.$$eval('a[href], iframe[src]', (els) => els.map((e) => ((e as HTMLAnchorElement).href || (e as HTMLIFrameElement).src) + '\u0000' + (e.textContent ?? ''))).catch(() => [] as string[])
    for (const x of urls) {
      const [u, text] = x.split('\u0000')
      if (/^https?:/.test(u) && (PLAYER.test(u) || /webcast|listen|replay/i.test(text)) && !/\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(u)) out.add(u.split('#')[0])
    }
  }
  return [...out].slice(0, 4)
}
