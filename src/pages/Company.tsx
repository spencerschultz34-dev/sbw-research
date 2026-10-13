import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { Search, Sparkle, ChevronLeft, ChevronRight, ChevronDown, Settings as Gear, ChartColumn } from 'lucide-react'
import { COMPANIES, eventsForCompany, MENTIONS, MENTION_MONTHS, PRESS_RELEASES, TODAY } from '../data'
import { companyById } from '../data/companies'
import type { CompanyEvent, EventType } from '../data/types'
import { useStore } from '../store'
import { eventWhen, fmtDate, fmtDayMonth, fmtDateShort, fmtTime } from '../format'
import { ContentChips, FollowButton, Logo, Menu, ReportIcon, SlidesIcon, Ticker, TimingChips, Empty, Flag } from '../components/ui'
import { Donut, SERIES, SlideView, StackedBars } from '../components/visuals'
import { ConsensusTable } from '../components/EventPanel'

const TABS = [
  { id: '', label: 'Overview' }, { id: 'events', label: 'Events' }, { id: 'documents', label: 'Documents' },
  { id: 'press-releases', label: 'Press releases' }, { id: 'mentions', label: 'Mentions' },
]

export function CompanyPage() {
  const { id = '', tab = '' } = useParams()
  const c = COMPANIES.find((x) => x.id === id)
  const store = useStore()
  const nav = useNavigate()
  if (!c) return <div className="page"><Empty>Company not found.</Empty></div>
  return (
    <div className="page company">
      <div className="company-head">
        <Logo id={c.id} size={26} />
        <span className="company-name">{c.name}</span>
        <Ticker id={c.id} />
        <span className="chip hide-narrow">{c.industry}</span>
        <span className="chip hide-narrow">Market cap: {c.marketCap}</span>
        <span className="grow" />
        <button className="ghost-icon hide-narrow" title={`Search ${c.name}`} onClick={() => nav(`/search?company=${c.id}`)}><Search size={16} /></button>
        <button className="ghost-icon" title={`Ask AI about ${c.name}`} onClick={() => nav(`/chat?scope=${c.id}`)}><Sparkle size={16} /></button>
        <FollowButton id={c.id} small />
      </div>
      <div className="tabs company-tabs">
        {TABS.map((t) => (
          <NavLink key={t.id} to={`/company/${c.id}${t.id ? `/${t.id}` : ''}`} end className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>{t.label}</NavLink>
        ))}
        {tab === 'mentions' && <MentionsToggle />}
      </div>
      <div className="page-scroll">
        {tab === '' && <Overview cid={c.id} />}
        {tab === 'events' && <EventsTab cid={c.id} />}
        {tab === 'documents' && <DocumentsTab cid={c.id} />}
        {tab === 'press-releases' && <PressTab cid={c.id} />}
        {tab === 'mentions' && <MentionsTab cid={c.id} />}
      </div>
      {store.panel === null && null}
    </div>
  )
}

/* ---------- Overview ---------- */

function Overview({ cid }: { cid: string }) {
  const c = companyById(cid)
  const store = useStore()
  const evs = eventsForCompany(cid)
  const upcoming = evs.filter((e) => e.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date))[0]
  const past = evs.filter((e) => e.status !== 'upcoming')
  const latest = past[0]
  const keySlides = past.filter((e) => e.slides).flatMap((e) => e.slides!.filter((s) => s.kind !== 'cover').map((s) => ({ s, e }))).slice(0, 8)
  const docs = past.flatMap((e) => e.reports.map((r) => ({ r, e }))).slice(0, 4)
  const [segI, setSegI] = useState(0)
  const [slideI, setSlideI] = useState(0)
  return (
    <div className="co-overview">
      <div className="co-left">
        {upcoming && (
          <>
            <h3 className="sec-title">Upcoming event</h3>
            <div className="card pad clickable" onClick={() => store.openEvent(upcoming.id)}>
              <div className="co-ev-head"><div><b>{upcoming.title}</b><small>{fmtDayMonth(upcoming.date)}</small></div></div>
              <TimingChips ev={upcoming} h12={store.prefs.timeFormat === '12'} />
              {upcoming.metrics && <ConsensusTable ev={upcoming} compact />}
            </div>
          </>
        )}
        {latest && (
          <>
            <h3 className="sec-title">Latest event</h3>
            <div className="card pad clickable" onClick={() => store.openEvent(latest.id)}>
              <div className="co-ev-head"><div><b className="trunc">{latest.title}</b><small>{eventWhen(latest.date)}</small></div><ContentChips ev={latest} /></div>
              {latest.headline && <div className="inset">{latest.headline}</div>}
              {latest.metrics?.some((m) => m.actual) && <ConsensusTable ev={latest} compact />}
            </div>
          </>
        )}
        {!c.hasEstimates && (
          <>
            <div className="sec-head"><h3 className="sec-title">Earlier events</h3><NavLink className="text-btn" to={`/company/${cid}/events`}>See all<ChevronRight size={14} /></NavLink></div>
            <div className="card list-card">
              {past.slice(1, 6).map((e) => (
                <div key={e.id} className="list-row clickable" onClick={() => store.openEvent(e.id)}>
                  <div><b className="trunc">{e.title}</b><small>{fmtDayMonth(e.date)}</small></div><ContentChips ev={e} />
                </div>
              ))}
            </div>
          </>
        )}
        <div className="sec-head"><h3 className="sec-title">Documents</h3><NavLink className="text-btn" to={`/company/${cid}/documents`}>See all<ChevronRight size={14} /></NavLink></div>
        <div className="card list-card">
          {docs.map(({ r, e }) => (
            <div key={r.id} className="list-row clickable" onClick={() => store.openEvent(e.id, 'report', `${r.id}:0`)}>
              <div><b className="trunc">{r.title}</b><small>{r.kind}{r.form && <span className="form-chip">{r.form}</span>}</small></div>
              <span className="muted small">{fmtDate(e.date)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="co-right">
        <div className="sec-head"><h3 className="sec-title">Segments</h3>
          <span className="arrows"><button className="ghost-icon" disabled={segI === 0} onClick={() => setSegI(segI - 1)}><ChevronLeft size={16} /></button><button className="ghost-icon" disabled={segI >= c.segments.length - 1} onClick={() => setSegI(segI + 1)}><ChevronRight size={16} /></button></span>
        </div>
        <div className="carousel">
          <div className="carousel-track" style={{ transform: `translateX(calc(${-segI} * (var(--seg-w) + 12px)))` }}>
            {c.segments.map((s, i) => (
              <div key={i} className="card seg-card">
                <div className="seg-title"><b>{s.title}</b><small>{s.subtitle}</small></div>
                <div className="seg-body">
                  <Donut items={s.items} />
                  <ul className="legend">
                    {s.items.map((it, j) => <li key={it.name}><i style={{ background: SERIES[j % SERIES.length] }} /><span className="trunc">{it.name}</span><b>{it.pct}%</b></li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sec-head"><h3 className="sec-title">Key slides</h3>
          <span className="arrows"><button className="ghost-icon" disabled={slideI === 0} onClick={() => setSlideI(slideI - 1)}><ChevronLeft size={16} /></button><button className="ghost-icon" disabled={slideI >= keySlides.length - 1} onClick={() => setSlideI(slideI + 1)}><ChevronRight size={16} /></button></span>
        </div>
        {keySlides.length === 0 ? <Empty>No slides published yet.</Empty> : (
          <div className="carousel">
            <div className="carousel-track" style={{ transform: `translateX(calc(${-slideI} * (var(--slide-w) + 12px)))` }}>
              {keySlides.map(({ s, e }, i) => (
                <div key={i} className="card slide-card clickable" onClick={() => store.openEvent(e.id, 'slides', s.key)}>
                  <SlideView slide={s} companyId={cid} />
                  <div className="slide-card-foot"><span className="chip">{s.category}</span><span className="trunc">{e.title}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Events ---------- */

function EventsTab({ cid }: { cid: string }) {
  const store = useStore()
  const evs = eventsForCompany(cid)
  const counts = useMemo(() => {
    const m = new Map<EventType, number>()
    evs.forEach((e) => m.set(e.type, (m.get(e.type) ?? 0) + 1))
    return [...m.entries()]
  }, [evs])
  const [type, setType] = useState<EventType | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const list = evs.filter((e) => !type || e.type === type)
  const up = list.filter((e) => e.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date))
  const past = list.filter((e) => e.status !== 'upcoming')
  const table = (rows: CompanyEvent[], upcoming: boolean) => (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Title</th><th>Type</th><th>Date</th><th /></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="clickable" onClick={() => store.openEvent(e.id)}>
              <td><span className="cell-title"><input type="checkbox" aria-label="Select" checked={checked.includes(e.id)} onClick={(x) => x.stopPropagation()} onChange={() => setChecked((c) => (c.includes(e.id) ? c.filter((x) => x !== e.id) : [...c, e.id]))} />{e.title}{e.status === 'live' && <span className="live-badge"><i />LIVE</span>}</span></td>
              <td>{e.type === 'AGM' ? 'Annual General Meeting' : e.type}</td>
              <td className="nowrap">{fmtDate(e.date)}</td>
              <td className="right">{upcoming ? <TimingChips ev={e} /> : <ContentChips ev={e} compactReports={false} showQueue={false} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
  return (
    <div className="tab-body">
      <div className="filter-row">
        {counts.map(([t, n]) => <button key={t} className={`fchip${type === t ? ' on' : ''}`} onClick={() => setType(type === t ? null : t)}>{t === 'AGM' ? 'AGM' : t} <em>{n}</em></button>)}
        <span className="grow" />
        <ActionsMenu count={checked.length} onClear={() => setChecked([])} />
      </div>
      {up.length > 0 && <><h3 className="sec-title">Upcoming events</h3>{table(up, true)}</>}
      <h3 className="sec-title">Earlier events</h3>
      {table(past, false)}
    </div>
  )
}

function ActionsMenu({ count, onClear }: { count: number; onClear: () => void }) {
  const store = useStore()
  const nav = useNavigate()
  return (
    <Menu align="right" width={220} trigger={(_o, t) => <button className="btn btn-quiet btn-sm" onClick={t}>Actions<ChevronDown size={14} /></button>}>
      {(close) => (
        <>
          <div className="menu-label">{count ? `${count} selected` : 'Select rows first'}</div>
          <button className="menu-item" disabled={!count} onClick={() => { nav('/chat'); close() }}><span><Sparkle size={14} /> Ask AI about selection</span></button>
          <button className="menu-item" disabled={!count} onClick={() => { store.notify(`${count} item${count > 1 ? 's' : ''} saved`); onClear(); close() }}><span>Save to Saved</span></button>
          <button className="menu-item" disabled={!count} onClick={() => { store.notify('Downloads work in the hosted version of the app'); close() }}><span>Download</span></button>
          <button className="menu-item" disabled={!count} onClick={() => { onClear(); close() }}><span>Clear selection</span></button>
        </>
      )}
    </Menu>
  )
}

/* ---------- Documents ---------- */

function DocumentsTab({ cid }: { cid: string }) {
  const store = useStore()
  const rows = eventsForCompany(cid).filter((e) => e.status !== 'upcoming').flatMap((e) => [
    ...e.reports.map((r) => ({ id: r.id, title: r.title, kind: r.kind as string, form: r.form, one: r.oneLiner, e, open: () => store.openEvent(e.id, 'report', `${r.id}:0`) })),
    ...(e.slides ? [{ id: `${e.id}-slides`, title: 'Slides', kind: 'Slides', form: undefined, one: undefined, e, open: () => store.openEvent(e.id, 'slides') }] : []),
  ])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.kind, (m.get(r.kind) ?? 0) + 1))
    return [...m.entries()]
  }, [rows])
  const [kind, setKind] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  return (
    <div className="tab-body">
      <div className="filter-row">
        {counts.map(([k, n]) => <button key={k} className={`fchip${kind === k ? ' on' : ''}`} onClick={() => setKind(kind === k ? null : k)}>{k} <em>{n}</em></button>)}
        <span className="grow" />
        <ActionsMenu count={checked.length} onClear={() => setChecked([])} />
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Type</th><th>Event</th><th className="right">Date</th></tr></thead>
          <tbody>
            {rows.filter((r) => !kind || r.kind === kind).map((r) => (
              <tr key={r.id} className="clickable" onClick={r.open}>
                <td><span className="cell-title"><input type="checkbox" aria-label="Select" checked={checked.includes(r.id)} onClick={(x) => x.stopPropagation()} onChange={() => setChecked((c) => (c.includes(r.id) ? c.filter((x) => x !== r.id) : [...c, r.id]))} />{r.title}{r.one && <span className="muted trunc"> - {r.one}</span>}</span></td>
                <td>{r.form && <span className="form-chip">{r.form}</span>}</td>
                <td className="nowrap">{r.e.title.length > 18 ? r.e.title.slice(0, 18) + '…' : r.e.title}</td>
                <td className="right nowrap">{fmtDate(r.e.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- Press releases ---------- */

function PressTab({ cid }: { cid: string }) {
  const { prefs } = useStore()
  const nav = useNavigate()
  const [open, setOpen] = useState<string | null>(null)
  const list = PRESS_RELEASES.filter((p) => p.companyId === cid && prefs.languages.includes(p.language))
  return (
    <div className="narrow-col">
      <h2 className="col-title">Press releases</h2>
      <div className="row between">
        <span className="row gap6">{prefs.languages.map((l) => <span key={l} className="chip">{l}</span>)}</span>
        <button className="ghost-icon" title="Press release languages" onClick={() => nav('/settings/press-releases')}><Gear size={15} /></button>
      </div>
      {list.length === 0 && <Empty>No press releases in your selected languages.</Empty>}
      {list.map((p) => (
        <div key={p.id} className="card pad pr-card clickable" onClick={() => setOpen(open === p.id ? null : p.id)}>
          <b>{p.title}</b>
          <p className={open === p.id ? '' : 'clamp3'}>{p.excerpt}</p>
          <div className="row gap8"><span className="muted small mono">{fmtDateShort(p.date)} {fmtTime(p.date)}</span><span className="chip">{p.language}</span></div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Mentions ---------- */

let mentionDir: 'Inbound' | 'Outbound' = 'Inbound'
let mentionChart = true
const listeners = new Set<() => void>()
function useMentionsUi() {
  const [, force] = useState(0)
  useEffect(() => { const f = () => force((x) => x + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  return {
    dir: mentionDir, chart: mentionChart,
    setDir: (d: typeof mentionDir) => { mentionDir = d; listeners.forEach((f) => f()) },
    toggleChart: () => { mentionChart = !mentionChart; listeners.forEach((f) => f()) },
  }
}

function MentionsToggle() {
  const ui = useMentionsUi()
  return (
    <span className="tabs-right">
      <span className="segmented">
        {(['Inbound', 'Outbound'] as const).map((d) => <button key={d} className={ui.dir === d ? 'on' : ''} onClick={() => ui.setDir(d)}>{d}</button>)}
      </span>
      <button className={`ghost-icon boxed${ui.chart ? ' on' : ''}`} title="Mentions over time" onClick={ui.toggleChart}><ChartColumn size={15} /></button>
    </span>
  )
}

function MentionsTab({ cid }: { cid: string }) {
  const ui = useMentionsUi()
  const store = useStore()
  const list = MENTIONS.filter((m) => (ui.dir === 'Inbound' ? m.toCompanyId === cid : m.fromCompanyId === cid))
  const months = cid === 'nwb' ? MENTION_MONTHS : MENTION_MONTHS.map((m) => ({ ...m, reports: Math.round(m.reports / 4), slides: Math.round(m.slides / 4), transcripts: Math.round(m.transcripts / 3) }))
  return (
    <div className={`mentions${ui.chart ? ' with-chart' : ''}`}>
      <div className="narrow-col">
        <h2 className="col-title">Mentions</h2>
        {list.length === 0 && <Empty>No {ui.dir.toLowerCase()} mentions yet.</Empty>}
        {list.map((m) => {
          const other = ui.dir === 'Inbound' ? m.fromCompanyId : m.toCompanyId
          const badge = m.docType === 'Slides' ? <SlidesIcon size={10} /> : <ReportIcon size={10} />
          return (
            <div key={m.id} className="card pad mention-card">
              <div className="row gap10">
                <Logo id={other} size={30} badge={badge} />
                <div className="grow"><b>{companyById(other).name}</b><small className="muted block">{m.count} mention{m.count > 1 ? 's' : ''} - {m.source}</small></div>
                <span className="muted small">{eventWhen(m.date) === 'Yesterday' ? 'Yesterday' : fmtDateShort(m.date)}</span>
              </div>
              <div className="inset">{m.text}</div>
            </div>
          )
        })}
      </div>
      {ui.chart && (
        <aside className="mentions-side">
          <h3 className="sec-title">Mentions over time</h3>
          <div className="legend-row"><span><i style={{ background: 'var(--s1)' }} />Reports</span><span><i style={{ background: 'var(--s2)' }} />Slides</span><span><i style={{ background: 'var(--s3)' }} />Transcripts</span></div>
          <StackedBars data={months.map((m) => ({ label: m.short, reports: m.reports, slides: m.slides, transcripts: m.transcripts }))} keys={['reports', 'slides', 'transcripts']} colors={['var(--s1)', 'var(--s2)', 'var(--s3)']} />
          <table className="num-table small-table">
            <thead><tr><th>Month</th><th>Reports</th><th>Slides</th><th>Transcripts</th></tr></thead>
            <tbody>{[...months].reverse().map((m) => <tr key={m.month}><td>{m.month}</td><td>{m.reports}</td><td>{m.slides}</td><td>{m.transcripts}</td></tr>)}</tbody>
          </table>
        </aside>
      )}
      {store.panel && null}
    </div>
  )
}

export { Flag, TODAY }
