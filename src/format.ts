import { TODAY } from './data'

const TZ = 'America/Chicago'
const parts = (iso: string) => {
  const d = new Date(iso)
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'long', hour12: false })
  const o: Record<string, string> = {}
  for (const p of f.formatToParts(d)) o[p.type] = p.value
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute, weekday: o.weekday }
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON = MONTHS.map((m) => m.slice(0, 3))

export const dayKey = (iso: string) => { const p = parts(iso); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` }
export const todayKey = () => dayKey(TODAY.toISOString())
const dayDiff = (iso: string) => {
  const a = parts(iso), b = parts(TODAY.toISOString())
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000)
}

/** "8 Oct, 2026" */
export const fmtDate = (iso: string) => { const p = parts(iso); return `${p.d} ${MON[p.m - 1]}, ${p.y}` }
/** "8 Oct 2026" */
export const fmtDateShort = (iso: string) => { const p = parts(iso); return `${p.d} ${MON[p.m - 1]} ${p.y}` }
/** "4 February" */
export const fmtDayMonth = (iso: string) => { const p = parts(iso); return `${p.d} ${MONTHS[p.m - 1]}` }
export const fmtTime = (iso: string, h12 = false) => {
  const p = parts(iso)
  if (!h12) return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`
  const h = p.h % 12 || 12
  return `${h}:${String(p.min).padStart(2, '0')} ${p.h < 12 ? 'AM' : 'PM'}`
}
export const fmtClock = (hhmm: string, h12: boolean) => {
  if (!h12 || !/^\d\d:\d\d$/.test(hhmm)) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** Feed day group: Today / Yesterday / 7 Oct 2026 */
export const dayGroup = (iso: string) => {
  const d = dayDiff(iso)
  if (d === 0) return 'Today'
  if (d === -1) return 'Yesterday'
  return fmtDateShort(iso)
}

/** Event card date: Today / Yesterday / 8 October (past), Tuesday, 13 October (this week) / 16 October */
export const eventWhen = (iso: string) => {
  const d = dayDiff(iso)
  if (d === 0) return 'Today'
  if (d === -1) return 'Yesterday'
  if (d === 1) return 'Tomorrow'
  const p = parts(iso)
  if (d > 1 && d < 7) return `${p.weekday}, ${p.d} ${MONTHS[p.m - 1]}`
  return `${p.d} ${MONTHS[p.m - 1]}`
}

export const relAge = (iso: string) => {
  const ms = TODAY.getTime() + 6 * 3600000 - new Date(iso).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m`
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`
  return `${Math.floor(d / 30)} month${d >= 60 ? 's' : ''} ago`
}

export const fmtDur = (sec: number) => {
  sec = Math.max(0, Math.floor(sec))
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
export const fmtStamp = (sec: number) => {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const fmtNum = (v: number, unit: 'B' | '') => (unit === 'B' ? `${v >= 100 ? v.toFixed(0) : v.toFixed(v >= 10 ? 1 : 2)}B` : v.toFixed(2))
export const pctChange = (a: number, b: number) => ((a - b) / Math.abs(b)) * 100

export const weekday = (iso: string) => parts(iso).weekday
export const ymd = (iso: string) => parts(iso)
export { MONTHS, MON }
