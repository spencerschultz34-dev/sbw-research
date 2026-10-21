import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChartNoAxesColumn, ChevronDown, ListEnd, Pause, Play, Presentation, Type, X, Headphones } from 'lucide-react'
import { companyById, FLAGS } from '../data/companies'
import type { Company, CompanyEvent } from '../data/types'
import { usePlayer, useStore } from '../store'

/* Company logo tile: the company's logo when Finnhub has one, otherwise a coloured monogram */
export function Logo({ id, size = 32, badge }: { id: string; size?: number; badge?: ReactNode }) {
  const c = companyById(id)
  const [broken, setBroken] = useState(false)
  const img = c.logo && !broken
  return (
    <span className="logo" style={{ width: size, height: size, background: img ? '#fff' : c.color, fontSize: size * (c.monogram.length > 1 ? 0.36 : 0.46) }}>
      {img ? <img src={c.logo} alt="" width={size} height={size} style={{ objectFit: 'contain', borderRadius: 'inherit', padding: size > 24 ? 3 : 1 }} onError={() => setBroken(true)} /> : c.monogram}
      {badge && <span className="logo-badge">{badge}</span>}
    </span>
  )
}

export function Flag({ country }: { country: Company['country'] }) {
  if (country !== 'US' && country !== 'CA' && country !== 'GB' && !FLAGS[country]) return <span className="muted small">{country}</span>
  // Minimal flag glyphs drawn in SVG so they render on every OS
  const common = { width: 16, height: 11, className: 'flag', role: 'img' as const, 'aria-label': country }
  if (country === 'US') return (
    <svg {...common} viewBox="0 0 16 11"><rect width="16" height="11" fill="#B22234" />{[1, 3, 5, 7, 9].map((y) => <rect key={y} y={y} width="16" height="1" fill="#fff" />)}<rect width="7" height="6" fill="#3C3B6E" /></svg>
  )
  if (country === 'CA') return (
    <svg {...common} viewBox="0 0 16 11"><rect width="16" height="11" fill="#fff" /><rect width="4" height="11" fill="#D52B1E" /><rect x="12" width="4" height="11" fill="#D52B1E" /><path d="M8 2.5l1 2 1.2-.4-.6 2.2 1-.2-2.6 2.2-2.6-2.2 1 .2-.6-2.2 1.2.4z" fill="#D52B1E" /></svg>
  )
  if (country === 'GB') return (
    <svg {...common} viewBox="0 0 16 11"><rect width="16" height="11" fill="#012169" /><path d="M0 0l16 11M16 0L0 11" stroke="#fff" strokeWidth="2" /><path d="M0 0l16 11M16 0L0 11" stroke="#C8102E" strokeWidth=".8" /><path d="M8 0v11M0 5.5h16" stroke="#fff" strokeWidth="3" /><path d="M8 0v11M0 5.5h16" stroke="#C8102E" strokeWidth="1.6" /></svg>
  )
  return <span>{FLAGS[country]}</span>
}

export function Ticker({ id }: { id: string }) {
  const c = companyById(id)
  return <span className="chip chip-ticker"><Flag country={c.country} />{c.ticker}</span>
}

/* Icon used for each content type */
export const TranscriptIcon = () => <span className="t-icon">T</span>
export const ReportIcon = ({ size = 13 }: { size?: number }) => <ChartNoAxesColumn size={size} strokeWidth={2.2} />
export const SlidesIcon = ({ size = 13 }: { size?: number }) => <Presentation size={size} strokeWidth={2} />
export const AudioIcon = ({ size = 12 }: { size?: number }) => <Headphones size={size} strokeWidth={2.2} />

/* Availability chips + play + queue: identical on every card and row */
export function ContentChips({ ev, showQueue = true, compactReports = true }: { ev: CompanyEvent; showQueue?: boolean; compactReports?: boolean }) {
  const { openEvent, set, queue, notify } = useStore()
  const player = usePlayer()
  const playing = player.eventId === ev.id && player.playing
  return (
    <span className="content-chips" onClick={(e) => e.stopPropagation()}>
      {(ev.transcript || ev.call) && <button className="icon-chip" title="Transcript" onClick={() => openEvent(ev.id, 'transcript')}><TranscriptIcon /></button>}
      {ev.slides && <button className="icon-chip" title="Slides" onClick={() => openEvent(ev.id, 'slides')}><SlidesIcon /></button>}
      {compactReports || !ev.reports.length
        ? (ev.reports.length > 0 || ev.filing) && <button className="icon-chip" title="Report" onClick={() => openEvent(ev.id, 'report')}><ReportIcon /></button>
        : ev.reports.map((r) => (
          <button key={r.id} className="icon-chip wide" title={r.title} onClick={() => openEvent(ev.id, 'report', `${r.id}:0`)}><ReportIcon size={12} />{r.form ?? r.title}</button>
        ))}
      {ev.hasAudio && (
        <button className={`play-btn${playing ? ' on' : ''}`} title={playing ? 'Pause' : 'Play'} onClick={() => (playing ? player.toggle() : player.play(ev.id))}>
          {playing ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
        </button>
      )}
      {showQueue && ev.hasAudio && (
        <button className="ghost-icon" title={queue.includes(ev.id) ? 'In event queue' : 'Add to event queue'} onClick={() => {
          if (!queue.includes(ev.id)) { set('queue', (q) => [...q, ev.id]); notify('Added to event queue') }
        }}><ListEnd size={14} /></button>
      )}
    </span>
  )
}

/* Report-timing chip for upcoming events */
export function TimingChips({ ev, h12 }: { ev: CompanyEvent; h12?: boolean }) {
  const est = ev.estimated
  const fmt = (t: string) => (/^\d\d:\d\d$/.test(t) && h12 ? `${(+t.slice(0, 2)) % 12 || 12}:${t.slice(3)} ${+t.slice(0, 2) < 12 ? 'AM' : 'PM'}` : t)
  return (
    <span className="timing-chips">
      {ev.liveTime && !est && <span className="chip"><AudioIcon />LIVE at {fmt(ev.liveTime)}</span>}
      {ev.reportTiming && !est && <span className="chip"><ReportIcon size={12} />{fmt(ev.reportTiming)}{/[a-z]/.test(ev.reportTiming) && <i className="dot-est" />}</span>}
      {est && <span className="chip" title="Estimated date"><ReportIcon size={12} /><i className="dot-est" /></span>}
    </span>
  )
}

/* Generic popover menu */
export function Menu({ trigger, children, align = 'left', width }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && <div className={`menu menu-${align}`} style={width ? { width } : undefined}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function Select<T extends string>({ value, options, onChange, id, width }: { value: T; options: readonly T[] | { value: T; label: string }[]; onChange: (v: T) => void; id?: string; width?: number }) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const cur = opts.find((o) => o.value === value)
  return (
    <Menu align="right" width={width} trigger={(open, toggle) => (
      <button id={id} className={`select${open ? ' open' : ''}`} style={width ? { minWidth: width } : undefined} onClick={toggle}>
        <span>{cur?.label ?? value}</span><ChevronDown size={14} />
      </button>
    )}>
      {(close) => opts.map((o) => (
        <button key={o.value} className="menu-item" onClick={() => { onChange(o.value); close() }}>
          <span>{o.label}</span>{o.value === value && <Check size={14} />}
        </button>
      ))}
    </Menu>
  )
}

export function Toggle({ on, onChange, id, label }: { on: boolean; onChange: (v: boolean) => void; id?: string; label?: string }) {
  return <button id={id} role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)}><span /></button>
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  )
}

export function Modal({ title, onClose, children, width = 480, footer }: { title: string; onClose: () => void; children: ReactNode; width?: number; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width }} role="dialog" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="ghost-icon" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

/* Follow button with the "which watchlists?" popover */
export function FollowButton({ id, small }: { id: string; small?: boolean }) {
  const { follows, set, watchlists, notify } = useStore()
  const followed = follows.includes(id)
  return (
    <Menu align="right" width={240} trigger={(_open, toggle) => (
      <button className={`btn ${followed ? 'btn-quiet' : 'btn-light'}${small ? ' btn-sm' : ''}`} onClick={() => {
        if (!followed) { set('follows', (f) => [...f, id]); notify(`Following ${companyById(id).name}`) }
        toggle()
      }}>{followed ? 'Following' : 'Follow'}</button>
    )}>
      {(close) => (
        <div className="follow-pop">
          <div className="menu-label">Add to watchlists</div>
          <button className="menu-item" onClick={() => {
            set('follows', (f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
          }}><span>Followed companies</span>{follows.includes(id) && <Check size={14} />}</button>
          {watchlists.map((w) => (
            <button key={w.id} className="menu-item" onClick={() => set('watchlists', (ws) => ws.map((x) => x.id !== w.id ? x : { ...x, companyIds: x.companyIds.includes(id) ? x.companyIds.filter((c) => c !== id) : [...x.companyIds, id] }))}>
              <span>{w.name}</span>{w.companyIds.includes(id) && <Check size={14} />}
            </button>
          ))}
          <div className="menu-sep" />
          <button className="menu-item" onClick={close}><span>Done</span></button>
        </div>
      )}
    </Menu>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Avatar({ name, size = 24, color }: { name: string; size?: number; color?: string }) {
  const initials = name.replace(/^(Dr\.|Mr\.|Ms\.)\s/, '').split(' ').map((s) => s[0]).slice(0, 2).join('')
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: color ?? `hsl(${h} 30% 38%)` }}>{initials}</span>
}

export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const term = q.replace(/^"|"$/g, '').trim()
  if (!term) return <>{text}</>
  const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')
  const parts = text.split(re)
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}</>
}
