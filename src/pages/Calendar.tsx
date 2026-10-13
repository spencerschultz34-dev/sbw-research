import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, CalendarPlus, Ellipsis, ListFilter, X, Copy, Check } from 'lucide-react'
import { COMPANIES, EVENTS, TODAY } from '../data'
import { companyById } from '../data/companies'
import type { CompanyEvent, EventType } from '../data/types'
import { useStore } from '../store'
import { dayKey, MON, MONTHS, fmtTime } from '../format'
import { ContentChips, Logo, Menu, Modal, TimingChips, Segmented } from '../components/ui'

type View = 'Day' | 'Week' | 'Month'
type Filter = { field: 'Watchlists' | 'Company' | 'Event type'; value: string }

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarPage() {
  const store = useStore()
  const [view, setView] = useState<View>('Week')
  const [anchor, setAnchor] = useState(new Date(TODAY))
  const [filters, setFilters] = useState<Filter[]>([{ field: 'Watchlists', value: 'wl-sbw' }])
  const [subscribe, setSubscribe] = useState(false)
  const [showWeekend, setShowWeekend] = useState(false)
  const h12 = store.prefs.timeFormat === '12'

  const days = useMemo(() => {
    if (view === 'Day') return [anchor]
    if (view === 'Week') {
      const mon = addDays(anchor, -((anchor.getDay() + 6) % 7))
      return Array.from({ length: showWeekend ? 7 : 5 }, (_, i) => addDays(mon, i))
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12)
    const start = addDays(first, -((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [view, anchor, showWeekend])

  const evs = useMemo(() => EVENTS.filter((e) => filters.every((f) => {
    if (f.field === 'Watchlists') {
      const ids = f.value === 'followed' ? store.follows : store.watchlists.find((w) => w.id === f.value)?.companyIds ?? []
      return ids.includes(e.companyId)
    }
    if (f.field === 'Company') return e.companyId === f.value
    return e.type === f.value
  })), [filters, store.follows, store.watchlists])

  const byDay = useMemo(() => {
    const m = new Map<string, CompanyEvent[]>()
    evs.forEach((e) => { const k = dayKey(e.date); m.set(k, [...(m.get(k) ?? []), e]) })
    m.forEach((l) => l.sort((a, b) => a.date.localeCompare(b.date)))
    return m
  }, [evs])

  const visibleCount = (view === 'Month' ? days.filter((d) => d.getMonth() === anchor.getMonth()) : days).reduce((n, d) => n + (byDay.get(key(d))?.length ?? 0), 0)
  const step = (dir: number) => setAnchor((a) => (view === 'Day' ? addDays(a, dir) : view === 'Week' ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1, 12)))
  const range = view === 'Day' ? `${WD[anchor.getDay()]}, ${anchor.getDate()} ${MON[anchor.getMonth()]}, ${anchor.getFullYear()}`
    : view === 'Week' ? `${days[0].getDate()}${days[0].getMonth() !== days[days.length - 1].getMonth() ? ' ' + MON[days[0].getMonth()] : ''} - ${days[days.length - 1].getDate()} ${MON[days[days.length - 1].getMonth()]}, ${days[0].getFullYear()}`
    : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
  const todayK = key(TODAY)
  const label = (f: Filter) => f.field === 'Watchlists' ? (f.value === 'followed' ? 'Followed companies' : store.watchlists.find((w) => w.id === f.value)?.name) : f.field === 'Company' ? companyById(f.value).name : f.value

  return (
    <div className="page">
      <div className="page-head">
        <span className="page-title">Calendar</span>
        <span className="muted">{range} - {visibleCount} event{visibleCount === 1 ? '' : 's'}</span>
        <span className="grow" />
        <span className="chip mono hide-narrow">UTC-05:00</span>
        <Menu align="right" width={220} trigger={(_o, t) => <button className="ghost-icon" title="More" onClick={t}><Ellipsis size={16} /></button>}>
          {(close) => (
            <button className="menu-item" onClick={() => { setShowWeekend(!showWeekend); close() }}><span>Show weekends</span>{showWeekend && <Check size={14} />}</button>
          )}
        </Menu>
        <button className="text-btn hide-narrow" onClick={() => setSubscribe(true)}><CalendarPlus size={15} />Subscribe</button>
        <label className="ghost-icon date-jump" title="Go to date">
          <CalendarDays size={15} />
          <input id="cal-date" type="date" value={key(anchor)} onChange={(e) => { if (e.target.value) { const [y, m, d] = e.target.value.split('-').map(Number); setAnchor(new Date(y, m - 1, d, 12)) } }} />
        </label>
        <span className="btn-group">
          <button className="ghost-icon" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft size={15} /></button>
          <button className="text-btn" onClick={() => setAnchor(new Date(TODAY))}>Today</button>
          <button className="ghost-icon" aria-label="Next" onClick={() => step(1)}><ChevronRight size={15} /></button>
        </span>
        <Segmented value={view} onChange={setView} options={(['Day', 'Week', 'Month'] as View[]).map((v) => ({ value: v, label: v }))} />
      </div>
      <div className="filter-bar">
        {filters.map((f, i) => (
          <span key={i} className="token">
            <span>{f.field}</span><span className="op">is</span><span>{label(f)}</span>
            <button aria-label="Remove filter" onClick={() => setFilters(filters.filter((_, j) => j !== i))}><X size={12} /></button>
          </span>
        ))}
        <AddFilter onAdd={(f) => setFilters([...filters.filter((x) => x.field !== f.field), f])} />
        <span className="grow" />
        {filters.length > 0 && <button className="text-btn" onClick={() => setFilters([])}>Clear</button>}
      </div>
      <div className="page-scroll cal-scroll">
        {view === 'Month' ? (
          <div className="month">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="month-wd">{d}</div>)}
            {days.map((d) => {
              const list = byDay.get(key(d)) ?? []
              return (
                <div key={key(d)} className={`month-cell${d.getMonth() !== anchor.getMonth() ? ' out' : ''}${key(d) === todayK ? ' today' : ''}`} onClick={() => { setAnchor(d); setView('Day') }}>
                  <span className="month-n">{d.getDate()}</span>
                  {list.slice(0, 3).map((e) => (
                    <button key={e.id} className="month-ev" onClick={(x) => { x.stopPropagation(); store.openEvent(e.id) }}>
                      <Logo id={e.companyId} size={14} /><span className="trunc">{companyById(e.companyId).ticker} · {e.title}</span>
                    </button>
                  ))}
                  {list.length > 3 && <span className="muted small">+{list.length - 3} more</span>}
                </div>
              )
            })}
          </div>
        ) : (
          <div className={`week${view === 'Day' ? ' day-view' : ''}`}>
            {days.map((d) => {
              const list = byDay.get(key(d)) ?? []
              return (
                <div key={key(d)} className={`day-col${key(d) === todayK ? ' today' : ''}`}>
                  <div className="day-head">{WD[d.getDay()]}, {d.getDate()} {MON[d.getMonth()]}{key(d) === todayK && <span className="chip">Today</span>}</div>
                  {list.map((e) => (
                    <div key={e.id} className="card cal-ev clickable" onClick={() => store.openEvent(e.id)}>
                      <div className="row gap8">
                        <Logo id={e.companyId} size={30} />
                        <div className="grow min0"><b className="trunc block">{companyById(e.companyId).name}</b><small className="trunc block muted">{e.title}</small></div>
                      </div>
                      {e.status !== 'upcoming' && <div onClick={(x) => x.stopPropagation()}><ContentChips ev={e} /></div>}
                      {(e.status === 'upcoming' || view === 'Day') && (
                        <div className="row gap6 wrap">
                          {e.status === 'live' && <span className="live-badge"><i />LIVE</span>}
                          {e.status === 'upcoming' ? <TimingChips ev={e} h12={h12} /> : <span className="muted small mono">{fmtTime(e.date, h12)}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {subscribe && <SubscribeModal onClose={() => setSubscribe(false)} />}
    </div>
  )
}

function AddFilter({ onAdd }: { onAdd: (f: Filter) => void }) {
  const store = useStore()
  const [field, setField] = useState<Filter['field'] | null>(null)
  const types: EventType[] = ['Earnings', 'Conference', 'AGM', 'Update / briefing', 'Monthly sales update', 'Capital markets day']
  return (
    <Menu width={250} trigger={(_o, t) => <button className="ghost-icon" title="Add filter" onClick={() => { setField(null); t() }}><ListFilter size={15} /></button>}>
      {(close) => !field ? (
        <>
          <div className="menu-label">Filter by</div>
          {(['Watchlists', 'Company', 'Event type'] as const).map((f) => <button key={f} className="menu-item" onClick={() => setField(f)}><span>{f}</span><ChevronRight size={14} /></button>)}
        </>
      ) : (
        <div className="menu-scroll">
          <div className="menu-label">{field} is</div>
          {field === 'Watchlists' && [{ id: 'followed', name: 'Followed companies' }, ...store.watchlists].map((w) => <button key={w.id} className="menu-item" onClick={() => { onAdd({ field, value: w.id }); close() }}><span>{w.name}</span></button>)}
          {field === 'Company' && COMPANIES.map((c) => <button key={c.id} className="menu-item" onClick={() => { onAdd({ field, value: c.id }); close() }}><span className="row gap8"><Logo id={c.id} size={16} />{c.name}</span></button>)}
          {field === 'Event type' && types.map((t) => <button key={t} className="menu-item" onClick={() => { onAdd({ field, value: t }); close() }}><span>{t}</span></button>)}
        </div>
      )}
    </Menu>
  )
}

function SubscribeModal({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const [wl, setWl] = useState('followed')
  const url = `webcal://calendar.sbw-research.app/u/spencer/${wl}.ics`
  return (
    <Modal title="Subscribe to your calendar" onClose={onClose} width={500} footer={<button className="btn btn-light" onClick={onClose}>Done</button>}>
      <p className="muted">Add this link to Outlook or Google Calendar as a subscribed calendar. Times and newly announced events update on their own.</p>
      <label className="field-label" htmlFor="sub-wl">Companies</label>
      <div className="row gap6 wrap">
        {[{ id: 'followed', name: 'Followed companies' }, ...store.watchlists].map((w) => <button key={w.id} className={`fchip${wl === w.id ? ' on' : ''}`} onClick={() => setWl(w.id)}>{w.name}</button>)}
      </div>
      <label className="field-label" htmlFor="sub-url">Subscription link</label>
      <div className="row gap8">
        <input id="sub-url" className="input grow mono small" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button className="btn btn-quiet" onClick={() => navigator.clipboard?.writeText(url).then(() => store.notify('Link copied'), () => store.notify('Copy is blocked here. Select the link instead.'))}><Copy size={14} />Copy</button>
      </div>
      <p className="muted small">This link is a placeholder in the prototype. It goes live once the app is connected to a calendar service.</p>
    </Modal>
  )
}
