import type { CompanyEvent } from '../data/types'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, ListEnd, Check } from 'lucide-react'
import { activityFeed, EVENTS, eventById, TODAY } from '../data'
import { companyById } from '../data/companies'
import type { ActivityItem } from '../data/types'
import { usePlayer, useStore } from '../store'
import { dayGroup, eventWhen, relAge, fmtDur } from '../format'
import { AudioIcon, ContentChips, Logo, Menu, ReportIcon, SlidesIcon, TimingChips, TranscriptIcon } from '../components/ui'

const TYPES = [
  { id: 'report', label: 'Reports' }, { id: 'audio', label: 'Audio & transcripts' }, { id: 'slides', label: 'Slides' }, { id: 'live', label: 'Live events' },
] as const

export function useScope() {
  const { follows, watchlists } = useStore()
  const [scope, setScope] = useState<string>('all')
  const ids = useMemo(() => {
    if (scope === 'all') return new Set([...follows, ...watchlists.flatMap((w) => w.companyIds)])
    if (scope === 'followed') return new Set(follows)
    return new Set(watchlists.find((w) => w.id === scope)?.companyIds ?? [])
  }, [scope, follows, watchlists])
  const label = scope === 'all' ? 'All watchlists' : scope === 'followed' ? 'Followed companies' : watchlists.find((w) => w.id === scope)?.name ?? ''
  const picker = (
    <Menu width={230} trigger={(_o, t) => <button className="text-btn head-select" onClick={t}>{label}<ChevronDown size={14} /></button>}>
      {(close) => (
        <>
          {[{ id: 'all', name: 'All watchlists' }, { id: 'followed', name: 'Followed companies' }, ...watchlists].map((w) => (
            <button key={w.id} className="menu-item" onClick={() => { setScope(w.id); close() }}><span>{w.name}</span>{scope === w.id && <Check size={14} />}</button>
          ))}
        </>
      )}
    </Menu>
  )
  return { ids, picker }
}

export function Home() {
  const { ids, picker } = useScope()
  const store = useStore()
  const [types, setTypes] = useState<string[]>(TYPES.map((t) => t.id))
  const nav = useNavigate()

  const feed = useMemo(() => activityFeed().filter((a) => ids.has(a.companyId)).filter((a) => {
    const live = a.id.endsWith('-live')
    return live ? types.includes('live') : a.docType === 'transcript' ? types.includes('audio') : types.includes(a.docType)
  }), [ids, types, store.dataVersion])

  // group by day, then stack consecutive items of the same event in one card
  const groups = useMemo(() => {
    const out: { day: string; cards: ActivityItem[][] }[] = []
    for (const it of feed) {
      const day = dayGroup(it.date)
      let g = out.find((x) => x.day === day)
      if (!g) { g = { day, cards: [] }; out.push(g) }
      const last = g.cards[g.cards.length - 1]
      if (last && last[0].eventId === it.eventId) last.push(it)
      else g.cards.push([it])
    }
    return out
  }, [feed])

  const latest = EVENTS.filter((e) => e.status !== 'upcoming' && ids.has(e.companyId) && (e.call || e.filing) && new Date(e.date) <= new Date(TODAY.getTime() + 8 * 3600000)).slice(0, 4)
  const upcoming = EVENTS.filter((e) => e.status === 'upcoming' && ids.has(e.companyId) && new Date(e.date) > new Date(TODAY.getTime() + 8 * 3600000)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
  const cont = Object.entries(store.progress).map(([id, pos]) => ({ ev: eventById(id), pos })).filter((x) => x.ev && x.pos > 30 && x.pos < x.ev.durationSec - 30).slice(0, 3)

  return (
    <div className="page">
      <div className="page-head">
        <span className="page-title">Home</span>
        {picker}
      </div>
      <div className="page-scroll">
        <div className="home">
          <section className="feed-col">
            <div className="sec-head">
              <h2>Activity feed</h2>
              <Menu align="right" width={220} trigger={(_o, t) => <button className="text-btn" onClick={t}>Filter <em className="count">{types.length}</em><ChevronDown size={14} /></button>}>
                {() => TYPES.map((t) => (
                  <button key={t.id} className="menu-item" onClick={() => setTypes((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id]))}>
                    <span>{t.label}</span>{types.includes(t.id) && <Check size={14} />}
                  </button>
                ))}
              </Menu>
            </div>
            {groups.length === 0 && <div className="empty">Nothing new from these companies in the last two weeks.</div>}
            {groups.map((g) => (
              <div key={g.day} className="feed-day">
                <div className="day-label">{g.day}</div>
                {g.cards.map((card) => (
                  <div key={card[0].id} className="card feed-card">
                    {card.map((it) => <FeedRow key={it.id} it={it} />)}
                  </div>
                ))}
              </div>
            ))}
          </section>
          <section className="right-col">
            <div className="sec-head"><h2>Latest events</h2><button className="text-btn" onClick={() => nav('/calendar')}>Go to calendar<ChevronRight size={14} /></button></div>
            <div className="grid-2">
              {latest.map((e) => (
                <div key={e.id} className="card ev-card clickable" onClick={() => { nav(`/company/${e.companyId}`); store.closePanel() }}>
                  <div className="ev-card-head">
                    <Logo id={e.companyId} size={34} />
                    <div className="ev-card-id"><button className="sbw-company-link" onClick={(event) => { event.stopPropagation(); nav(`/company/${e.companyId}`); store.closePanel() }}>{companyById(e.companyId).name}</button><small>{e.title} - {eventWhen(e.date)}</small></div>
                    <ContentChips ev={e} />
                  </div>
                  <button className="sbw-card-event-action" onClick={(click) => { click.stopPropagation(); store.openEvent(e.id) }}>Open {e.title} event <ChevronRight size={13} /></button>
                  {e.status === 'live' ? <div className="inset live-inset"><span className="live-badge"><i />LIVE</span>Call in progress. Listen live and follow the transcript.</div> : <ConsensusOrNote e={e} />}
                </div>
              ))}
            </div>
            <div className="sec-head"><h2>Upcoming events</h2><button className="text-btn" onClick={() => nav('/calendar')}>Go to calendar<ChevronRight size={14} /></button></div>
            <div className="grid-3">
              {upcoming.map((e) => (
                <div key={e.id} className="card up-card clickable" onClick={() => { nav(`/company/${e.companyId}`); store.closePanel() }}>
                  <div className="ev-card-head">
                    <Logo id={e.companyId} size={34} />
                    <div className="ev-card-id"><button className="sbw-company-link" onClick={(event) => { event.stopPropagation(); nav(`/company/${e.companyId}`); store.closePanel() }}>{companyById(e.companyId).name}</button><small><span className="trunc">{e.title}</span> - {eventWhen(e.date)}</small></div>
                  </div>
                  <TimingChips ev={e} h12={store.prefs.timeFormat === '12'} />
                  <button className="sbw-card-event-action" onClick={(click) => { click.stopPropagation(); store.openEvent(e.id) }}>View event <ChevronRight size={13} /></button>
                </div>
              ))}
            </div>
            {cont.length > 0 && (
              <>
                <div className="sec-head"><h2>Continue listening</h2></div>
                <div className="grid-3">
                  {cont.map(({ ev, pos }) => <ContinueCard key={ev!.id} id={ev!.id} pos={pos} />)}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function FeedRow({ it }: { it: ActivityItem }) {
  const store = useStore()
  const nav = useNavigate()
  const read = store.readActivity.includes(it.id)
  const ev = eventById(it.eventId)!
  const badge = it.docType === 'report' ? <ReportIcon size={10} /> : it.docType === 'slides' ? <SlidesIcon size={10} /> : it.docType === 'audio' ? <AudioIcon size={10} /> : <TranscriptIcon />
  return (
    <div className="feed-row" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") { store.openEvent(it.eventId, it.openTab) } }} onClick={() => {
      store.set('readActivity', (r) => (r.includes(it.id) ? r : [...r, it.id]))
      store.openEvent(it.eventId, it.openTab)
    }}>
      <Logo id={it.companyId} size={30} badge={badge} />
      <span className="feed-text">
        <button className="sbw-company-link" onClick={(e) => { e.stopPropagation(); nav(`/company/${it.companyId}`); store.closePanel() }}>{companyById(it.companyId).name}</button>
        <small>{it.label}{it.oneLiner && <> - {it.oneLiner}</>}</small>
      </span>
      <span className="feed-meta">
        {it.docType === 'audio' && ev.hasAudio && (
          <span role="button" tabIndex={0} className="ghost-icon tiny" title="Add to event queue" onClick={(e) => {
            e.stopPropagation()
            if (!store.queue.includes(ev.id)) { store.set('queue', (q) => [...q, ev.id]); store.notify('Added to event queue') }
          }}><ListEnd size={13} /></span>
        )}
        <span className="muted small">{relAge(it.date)}</span>
        {!read && <i className="dot-unread" aria-label="Unread" />}
      </span>
    </div>
  )
}

function ContinueCard({ id, pos }: { id: string; pos: number }) {
  const nav = useNavigate()
  const store = useStore()
  const ev = eventById(id)!
  const player = usePlayer()
  const pct = pos / ev.durationSec
  return (
    <div className="card up-card clickable" onClick={() => player.play(id, pos)}>
      <div className="ev-card-head">
        <Logo id={ev.companyId} size={34} />
        <div className="ev-card-id"><button className="sbw-company-link" onClick={(event) => { event.stopPropagation(); nav(`/company/${ev.companyId}`); store.closePanel() }}>{companyById(ev.companyId).name}</button><small className="trunc">{ev.title}</small></div>
        <svg width="26" height="26" viewBox="0 0 26 26" aria-label={`${Math.round(pct * 100)}% listened`}>
          <circle cx="13" cy="13" r="10" fill="none" stroke="var(--line)" strokeWidth="2.5" />
          <circle cx="13" cy="13" r="10" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray={`${pct * 62.8} 62.8`} transform="rotate(-90 13 13)" />
        </svg>
      </div>
      <span className="muted small">{fmtDur(ev.durationSec - pos)} left</span>
    </div>
  )
}

/** Beat/miss when the numbers are in; otherwise what has been published. */
function ConsensusOrNote({ e }: { e: CompanyEvent }) {
  const m = e.metrics?.filter((x) => x.actual != null) ?? []
  if (e.headline) return <div className="inset">{e.headline}</div>
  if (!m.length) return <div className="inset muted">{e.call ? 'Call transcript available' : 'Earnings release filed with the SEC'}</div>
  return (
    <div className="inset">
      {m.map((x) => {
        const d = ((x.actual! - x.estimate) / Math.abs(x.estimate)) * 100
        return <span key={x.label} className="nowrap" style={{ marginRight: 12 }}>{x.label} {x.unit === 'B' ? `${x.actual!.toFixed(1)}B` : x.actual!.toFixed(2)} <b className={d >= 0 ? 'pos' : 'neg'}>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</b></span>
      })}
      <span className="muted small">vs consensus</span>
    </div>
  )
}
