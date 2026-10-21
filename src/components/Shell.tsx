import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  House, Building2, Calendar, Search, Sparkle, Bookmark, LayoutGrid, Layers, Quote, ListEnd, Gift, CircleHelp, Settings,
  PanelLeftClose, PanelLeftOpen, Menu as MenuIcon, ArrowRight,
} from 'lucide-react'
import { COMPANIES, companyById, EVENTS } from '../data'
import { useStore } from '../store'
import { Logo, Ticker } from './ui'
import { PlayerBar } from './PlayerBar'
import { EventPanel } from './EventPanel'
import { EventCompanyContext } from './EventCompanyContext'
import { eventById } from '../data'
import { ChatPanel } from '../pages/Chat'
import { eventWhen } from '../format'
import { matchTickers, titleCase, useTickers } from '../sec'

export function Wordmark() {
  return <span className="wordmark" aria-label="Schaper, Benz & Wise Research">
    <span className="sbw-tree" aria-hidden="true"><svg viewBox="0 0 120 120" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M59 111 Q59 94 56 78 Q48 81 38 90 M58 84 Q68 76 76 75 M58 95 Q45 92 39 101 M61 92 Q76 91 84 100" />
      <path d="M58 80 L57 61 M56 71 Q43 66 33 57 M57 65 Q70 56 82 57 M45 63 L42 48 M67 62 L71 46" />
      <path d="M15 62 Q5 55 13 44 Q6 32 22 29 Q22 16 36 18 Q43 7 54 17 Q63 6 72 17 Q84 11 90 25 Q107 23 103 39 Q116 48 105 61 Q110 75 96 80 Q94 92 80 88 Q69 98 59 87 Q48 100 36 90 Q21 94 17 80 Q5 77 15 62Z" />
      <path d="M26 38 Q31 35 37 41 M46 28 Q51 24 55 29 M75 28 Q82 26 86 35 M88 65 Q93 59 99 61 M27 72 Q30 78 35 76" strokeWidth="1.5" />
    </svg></span>
    <b>SBW</b><span>RESEARCH</span>
  </span>
}

const NAV = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/chat', label: 'Chat', icon: Sparkle },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/workspaces', label: 'Workspaces', icon: LayoutGrid },
  { to: '/watchlists', label: 'Watchlists', icon: Layers },
  { to: '/alerts', label: 'Keyword alerts', icon: Quote },
]

export function Shell() {
  const store = useStore()
  const { panel, expanded, prefs, toast, quickOpen, setQuickOpen } = store
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const loc = useLocation()

  useEffect(() => {
    setMobileNav(false)
    // Event readers belong to company routes. Other sidebar destinations
    // always render the destination, not a stale company context.
    if (!/^\/company\//.test(loc.pathname) && panel?.kind === 'event') store.closePanel()
  }, [loc.pathname, panel?.kind, store.closePanel])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setQuickOpen(!quickOpen) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [quickOpen, setQuickOpen])

  const mode = prefs.theme === 'System' ? 'system' : prefs.theme.toLowerCase()
  const hasPanel = panel !== null
  const activeEvent = panel?.kind === 'event' && /^\/company\//.test(loc.pathname) ? eventById(panel.eventId) : null

  return (
    <div className={`app mode-${mode}${prefs.pointer ? ' pointer' : ''}${collapsed ? ' collapsed' : ''}`}>
      <header className="mobile-top">
        <button className="ghost-icon" aria-label="Open menu" onClick={() => setMobileNav(true)}><MenuIcon size={18} /></button>
        <Wordmark />
        <button className="ghost-icon" aria-label="Quick access" onClick={() => setQuickOpen(true)}><Search size={18} /></button>
      </header>
      <aside className={`sidebar${mobileNav ? ' open' : ''}`}>
        <div className="sidebar-top">
          {!collapsed && <Wordmark />}
          <button className="ghost-icon" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <button className="quick-btn" onClick={() => setQuickOpen(true)}>
          {collapsed ? <Search size={15} /> : <><span>Quick access</span><kbd>Ctrl K</kbd></>}
        </button>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title={n.label}>
              <n.icon size={16} strokeWidth={1.8} /><span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="nav-spacer" />
        <nav className="nav">
          <NavLink to="/queue" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Event queue">
            <ListEnd size={16} strokeWidth={1.8} /><span>Event queue</span>{store.queue.length > 0 && <em className="count">{store.queue.length}</em>}
          </NavLink>
        </nav>
        <div className="nav-sep" />
        <nav className="nav">
          <NavLink to="/release-notes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Release notes"><Gift size={16} strokeWidth={1.8} /><span>Release notes</span></NavLink>
          <NavLink to="/help" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Help & support"><CircleHelp size={16} strokeWidth={1.8} /><span>Help &amp; support</span></NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Settings"><Settings size={16} strokeWidth={1.8} /><span>Settings</span></NavLink>
        </nav>
      </aside>
      {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}

      <div className="stage">
        <div className={`panels${hasPanel ? ' split' : ''}${expanded ? ' expanded' : ''}`}>
          <main className={`panel main-panel${activeEvent ? ' sbw-context-host' : ''}`}>
            {activeEvent ? <EventCompanyContext companyId={activeEvent.companyId} selectedEventId={activeEvent.id} /> : <Outlet />}
          </main>
          {panel?.kind === 'event' && activeEvent && <section className="panel side-panel"><EventPanel key={panel.eventId} /></section>}
          {panel?.kind === 'chat' && <section className="panel side-panel"><ChatPanel /></section>}
        </div>
        <PlayerBar />
        <div className="bottom-strip">
          <span className="sample-note">Live data · SEC, EarningsCall, Finnhub</span>
          <button className="float-chat" onClick={() => (panel?.kind === 'chat' ? store.closePanel() : store.openChatPanel())}><Sparkle size={14} />Chat</button>
        </div>
      </div>

      {quickOpen && <QuickAccess onClose={() => setQuickOpen(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function QuickAccess({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const nav = useNavigate()
  const { openEvent, set, prefs, dataVersion } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const secList = useTickers()
  useEffect(() => { inputRef.current?.focus() }, [])

  type Row = { group: string; key: string; label: React.ReactNode; hint?: string; run: () => void }
  const rows = useMemo<Row[]>(() => {
    const t = q.trim().toLowerCase()
    const out: Row[] = []
    const comps = COMPANIES.filter((c) => !t || c.name.toLowerCase().includes(t) || c.ticker.toLowerCase().startsWith(t) || c.ticker.toLowerCase().replace(/[.\/-]/g,' ').startsWith(t)).slice(0, t ? 6 : 4)
    comps.forEach((c) => out.push({ group: 'Companies', key: c.id, label: <><Logo id={c.id} size={20} /><span>{c.name}</span><Ticker id={c.id} /></>, run: () => nav(`/company/${c.id}`) }))
    matchTickers(secList, t, 8).filter(([, tk]) => !comps.some((c) => c.ticker === tk)).slice(0, 5).forEach(([cik, tk, name]) => out.push({ group: 'All US companies', key: `sec${cik}`, label: <><span className="logo" style={{ width: 20, height: 20, background: 'var(--s1)', fontSize: 10 }}>{name[0]}</span><span>{titleCase(name)}</span><span className="chip chip-ticker">{tk}</span></>, run: () => nav(`/company/${tk.toLowerCase()}`) }))
    const evs = EVENTS.filter((e) => e.status !== 'upcoming' && COMPANIES.some((c) => c.id === e.companyId) && (!t || `${companyById(e.companyId).name} ${e.title}`.toLowerCase().includes(t))).slice(0, t ? 5 : 3)
    evs.forEach((e) => out.push({ group: 'Events', key: e.id, label: <><Logo id={e.companyId} size={20} /><span>{companyById(e.companyId).name} · {e.title}</span></>, hint: eventWhen(e.date), run: () => openEvent(e.id) }))
    const pages: [string, string][] = [['Home', '/'], ['Companies','/companies'], ['Calendar', '/calendar'], ['Search', '/search'], ['Chat', '/chat'], ['Saved', '/saved'], ['Workspaces', '/workspaces'], ['Watchlists', '/watchlists'], ['Keyword alerts', '/alerts'], ['Event queue', '/queue'], ['Settings', '/settings']]
    pages.filter(([l]) => !t || l.toLowerCase().includes(t)).slice(0, t ? 4 : 0).forEach(([l, p]) => out.push({ group: 'Go to', key: p, label: <span>{l}</span>, run: () => nav(p) }))
    const actions: [string, () => void][] = [
      ['New chat', () => nav('/chat')],
      ['New watchlist', () => nav('/watchlists?new=1')],
      ['New keyword alert', () => nav('/alerts?new=1')],
      [`Switch to ${prefs.theme === 'Light' ? 'dark' : 'light'} theme`, () => set('prefs', (p) => ({ ...p, theme: p.theme === 'Light' ? 'Dark' : 'Light' }))],
    ]
    actions.filter(([l]) => !t || l.toLowerCase().includes(t)).forEach(([l, run]) => out.push({ group: 'Actions', key: l, label: <span>{l}</span>, run }))
    if (t) out.push({ group: 'Search', key: 'search', label: <span>Search all documents for “{q}”</span>, run: () => nav(`/search?q=${encodeURIComponent(q)}`) })
    return out
  }, [q, nav, openEvent, set, prefs.theme, secList, dataVersion])

  useEffect(() => setSel(0), [q])
  const run = (r: Row) => { r.run(); onClose() }
  let lastGroup = ''
  return (
    <div className="modal-back top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="quick" role="dialog" aria-label="Quick access">
        <div className="quick-input">
          <Search size={16} />
          <input id="quick-input" ref={inputRef} value={q} placeholder="Search companies, events, pages and actions" onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(rows.length - 1, s + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
              if (e.key === 'Enter' && rows[sel]) run(rows[sel])
              if (e.key === 'Escape') onClose()
            }} />
          <kbd>Esc</kbd>
        </div>
        <div className="quick-list">
          {rows.length === 0 && <div className="empty">No matches. Press Enter to search documents.</div>}
          {rows.map((r, i) => {
            const head = r.group !== lastGroup
            lastGroup = r.group
            return (
              <div key={r.group + r.key}>
                {head && <div className="quick-group">{r.group}</div>}
                <button className={`quick-row${i === sel ? ' sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => run(r)}>
                  <span className="quick-label">{r.label}</span>
                  {r.hint && <span className="quick-hint">{r.hint}</span>}
                  {i === sel && <ArrowRight size={14} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
