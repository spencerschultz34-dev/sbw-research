import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, ScanSearch, ChartColumn, ChevronDown, ChevronRight, ListFilter, X, Play, Check } from 'lucide-react'
import { COMPANIES, EVENTS, PRESS_RELEASES, TODAY } from '../data'
import { companyById } from '../data/companies'
import { usePlayer, useStore } from '../store'
import { fmtDate, fmtStamp } from '../format'
import { Avatar, Empty, FollowButton, Logo, Menu, Ticker } from '../components/ui'
import { SlideView, StackedBars } from '../components/visuals'

type Kind = 'Companies' | 'Transcripts' | 'Slides' | 'Reports' | 'Press releases'
const KINDS: Kind[] = ['Companies', 'Transcripts', 'Slides', 'Reports', 'Press releases']
type F = { field: 'Company' | 'Watchlist' | 'Event type' | 'Date' | 'Speaker'; value: string; label: string }

function matcher(q: string) {
  const exact = /^".+"$/.test(q.trim())
  const terms = exact ? [q.trim().slice(1, -1).toLowerCase()] : q.toLowerCase().split(/\s+/).filter((t) => t.length > 1)
  return { terms, test: (text: string) => { const l = text.toLowerCase(); return terms.length > 0 && terms.every((t) => l.includes(t)) } }
}

function Hl({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig')
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}</>
}

export function SearchPage() {
  const store = useStore()
  const player = usePlayer()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const [input, setInput] = useState(params.get('q') ?? '')
  const q = params.get('q') ?? ''
  const [kind, setKind] = useState<Kind | null>(null)
  const [sort, setSort] = useState<'Newest first' | 'Oldest first' | 'Relevance'>('Newest first')
  const [chart, setChart] = useState(false)
  const [filters, setFilters] = useState<F[]>(() => (params.get('company') ? [{ field: 'Company', value: params.get('company')!, label: companyById(params.get('company')!).name }] : []))
  useEffect(() => { setInput(q) }, [q])

  const run = (text: string) => {
    const t = text.trim()
    const next = new URLSearchParams(params)
    if (t) next.set('q', t); else next.delete('q')
    setParams(next)
    if (t) store.set('recentSearches', (r) => [t, ...r.filter((x) => x !== t)].slice(0, 10))
  }

  const evOk = (companyId: string, date: string, type?: string) => filters.every((f) => {
    if (f.field === 'Company') return companyId === f.value
    if (f.field === 'Watchlist') return (f.value === 'followed' ? store.follows : store.watchlists.find((w) => w.id === f.value)?.companyIds ?? []).includes(companyId)
    if (f.field === 'Event type') return type === f.value
    if (f.field === 'Date') return TODAY.getTime() - new Date(date).getTime() <= Number(f.value) * 86400000
    return true
  })
  const speakerOk = (isAnalyst?: boolean) => filters.every((f) => f.field !== 'Speaker' || (f.value === 'analyst' ? !!isAnalyst : !isAnalyst))

  const results = useMemo(() => {
    const m = matcher(q)
    const r = { companies: [] as string[], transcripts: [] as { ev: typeof EVENTS[number]; p: NonNullable<typeof EVENTS[number]['transcript']>['paragraphs'][number] }[], slides: [] as { ev: typeof EVENTS[number]; i: number }[], reports: [] as { ev: typeof EVENTS[number]; rid: string; page: number; title: string; snippet: string; form?: string }[], press: [] as typeof PRESS_RELEASES }
    if (!q) return { ...r, terms: m.terms }
    COMPANIES.forEach((c) => { if (m.test(`${c.name} ${c.ticker} ${c.industry}`) && evOk(c.id, TODAY.toISOString())) r.companies.push(c.id) })
    for (const ev of EVENTS) {
      if (ev.status === 'upcoming' || !evOk(ev.companyId, ev.date, ev.type)) continue
      ev.transcript?.paragraphs.forEach((p) => { if (m.test(p.text) && speakerOk(ev.transcript!.speakers[p.speaker].isAnalyst)) r.transcripts.push({ ev, p }) })
      ev.slides?.forEach((s, i) => { if (m.test([s.title, s.category, s.subtitle, ...(s.bullets ?? []), ...(s.kpis?.map((k) => k.label) ?? [])].join(' '))) r.slides.push({ ev, i }) })
      ev.reports.forEach((rep) => rep.pages.forEach((pg, pi) => {
        const text = pg.blocks.map((b) => (b.t === 'ul' ? b.items.join(' ') : b.t === 'table' ? b.rows.flat().join(' ') : b.text)).join(' ')
        if (m.test(text)) {
          const l = text.toLowerCase(); const at = Math.max(0, l.indexOf(m.terms[0]) - 80)
          r.reports.push({ ev, rid: rep.id, page: pi, title: rep.title, form: rep.form, snippet: (at > 0 ? '…' : '') + text.slice(at, at + 240) + '…' })
        }
      }))
    }
    PRESS_RELEASES.forEach((p) => { if (m.test(`${p.title} ${p.excerpt}`) && evOk(p.companyId, p.date)) r.press.push(p) })
    const ord = (a: string, b: string) => (sort === 'Oldest first' ? a.localeCompare(b) : b.localeCompare(a))
    r.transcripts.sort((a, b) => ord(a.ev.date, b.ev.date)); r.slides.sort((a, b) => ord(a.ev.date, b.ev.date)); r.reports.sort((a, b) => ord(a.ev.date, b.ev.date))
    return { ...r, terms: m.terms }
  }, [q, filters, sort, store.follows, store.watchlists]) // eslint-disable-line

  const counts: Record<Kind, number> = { Companies: results.companies.length, Transcripts: results.transcripts.length, Slides: results.slides.length, Reports: results.reports.length, 'Press releases': results.press.length }
  const show = (k: Kind) => !kind || kind === k
  const quarterly = useMemo(() => {
    const qs = ['Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26']
    const bucket = (iso: string) => { const d = new Date(iso); const y = d.getUTCFullYear() % 100; const qn = Math.floor(d.getUTCMonth() / 3); return qn === 0 ? `Q4 ${y - 1}` : `Q${qn} ${y}` }
    return qs.map((label) => ({
      label,
      reports: results.reports.filter((x) => bucket(x.ev.date) === label).length,
      slides: results.slides.filter((x) => bucket(x.ev.date) === label).length,
      transcripts: results.transcripts.filter((x) => bucket(x.ev.date) === label).length,
    }))
  }, [results])

  return (
    <div className="page">
      <form className="search-head" onSubmit={(e) => { e.preventDefault(); run(input) }}>
        <SearchIcon size={16} />
        <input id="search-input" autoFocus value={input} placeholder='Search for something… Use "quotes" for an exact phrase' onChange={(e) => setInput(e.target.value)} />
        {input && <button type="button" className="ghost-icon" aria-label="Clear" onClick={() => { setInput(''); run('') }}><X size={15} /></button>}
      </form>
      <div className="search-kinds">
        {KINDS.map((k) => <button key={k} className={`fchip${kind === k ? ' on' : ''}`} onClick={() => setKind(kind === k ? null : k)}>{k}{q && <em>{counts[k]}</em>}</button>)}
        <span className="grow" />
        <button className={`ghost-icon boxed${kind === 'Slides' ? ' on' : ''}`} title="Slide search" onClick={() => setKind(kind === 'Slides' ? null : 'Slides')}><ScanSearch size={15} /></button>
        <button className={`ghost-icon boxed${chart ? ' on' : ''}`} title="Mentions over time" onClick={() => setChart(!chart)}><ChartColumn size={15} /></button>
        <Menu align="right" trigger={(_o, t) => <button className="text-btn muted" onClick={t}>{sort}<ChevronDown size={14} /></button>}>
          {(close) => (['Newest first', 'Oldest first', 'Relevance'] as const).map((s) => <button key={s} className="menu-item" onClick={() => { setSort(s); close() }}><span>{s}</span>{s === sort && <Check size={14} />}</button>)}
        </Menu>
      </div>
      <div className="filter-bar">
        <FilterAdd onAdd={(f) => setFilters([...filters.filter((x) => x.field !== f.field), f])} />
        {filters.map((f, i) => (
          <span key={i} className="token"><span>{f.field}</span><span className="op">is</span><span>{f.label}</span><button aria-label="Remove filter" onClick={() => setFilters(filters.filter((_, j) => j !== i))}><X size={12} /></button></span>
        ))}
        <span className="grow" />
        {filters.length > 0 && <button className="text-btn" onClick={() => setFilters([])}>Clear</button>}
      </div>
      <div className="page-scroll">
        {!q ? (
          <div className="search-empty">
            <h3 className="sec-title">Recent searches</h3>
            <div className="row gap6 wrap">{store.recentSearches.map((s) => <button key={s} className="fchip" onClick={() => run(s)}>{s}</button>)}</div>
            <h3 className="sec-title">Recommended companies</h3>
            <div className="grid-3">
              {COMPANIES.filter((c) => !store.follows.includes(c.id)).slice(0, 6).map((c) => (
                <div key={c.id} className="card rec-card">
                  <Logo id={c.id} size={36} />
                  <button className="link-block grow min0" onClick={() => nav(`/company/${c.id}`)}><b className="trunc block">{c.name}</b><Ticker id={c.id} /></button>
                  <FollowButton id={c.id} small />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="results">
            {chart && (
              <div className="card pad chart-card">
                <div className="row between"><b>Mentions of “{q}” by quarter</b><div className="legend-row"><span><i style={{ background: 'var(--s1)' }} />Reports</span><span><i style={{ background: 'var(--s2)' }} />Slides</span><span><i style={{ background: 'var(--s3)' }} />Transcripts</span></div></div>
                <StackedBars data={quarterly} keys={['reports', 'slides', 'transcripts']} colors={['var(--s1)', 'var(--s2)', 'var(--s3)']} height={150} />
              </div>
            )}
            {Object.values(counts).every((n) => n === 0) && <Empty>No results for “{q}”. Try fewer words or remove a filter.</Empty>}
            {show('Companies') && results.companies.length > 0 && (
              <section><h3 className="sec-title">Companies</h3><div className="grid-3">
                {results.companies.map((id) => <div key={id} className="card rec-card"><Logo id={id} size={36} /><button className="link-block grow min0" onClick={() => nav(`/company/${id}`)}><b className="trunc block">{companyById(id).name}</b><Ticker id={id} /></button><FollowButton id={id} small /></div>)}
              </div></section>
            )}
            {show('Transcripts') && results.transcripts.length > 0 && (
              <section><h3 className="sec-title">Transcripts <em className="count">{results.transcripts.length}</em></h3>
                {results.transcripts.slice(0, kind ? 60 : 6).map(({ ev, p }) => {
                  const sp = ev.transcript!.speakers[p.speaker]
                  return (
                    <div key={p.id} className="card pad result clickable" onClick={() => store.openEvent(ev.id, 'transcript', p.id)}>
                      <div className="row gap8 wrap">
                        <Logo id={ev.companyId} size={20} /><b>{companyById(ev.companyId).name}</b><ChevronRight size={13} className="muted" /><span className="trunc">{ev.title}</span>
                        <span className="muted small">{fmtDate(ev.date)}</span><span className="grow" />
                        <button className="play-btn" title="Play from this sentence" onClick={(e) => { e.stopPropagation(); player.play(ev.id, p.start) }}><Play size={11} fill="currentColor" /></button>
                        <span className="mono small muted">{fmtStamp(p.start)}</span>
                      </div>
                      <p><Hl text={p.text} terms={results.terms} /></p>
                      <span className="speaker-chip"><Avatar name={sp.name} size={18} />{sp.name}{sp.role && `, ${sp.role.split(',')[0]}`}</span>
                    </div>
                  )
                })}
                {!kind && results.transcripts.length > 6 && <button className="text-btn" onClick={() => setKind('Transcripts')}>Show all {results.transcripts.length} transcript results<ChevronRight size={14} /></button>}
              </section>
            )}
            {show('Slides') && results.slides.length > 0 && (
              <section><h3 className="sec-title">Slides <em className="count">{results.slides.length}</em></h3>
                <div className="grid-3">
                  {results.slides.slice(0, kind ? 60 : 6).map(({ ev, i }) => (
                    <div key={ev.id + i} className="card slide-card clickable" onClick={() => store.openEvent(ev.id, 'slides', ev.slides![i].key)}>
                      <SlideView slide={ev.slides![i]} companyId={ev.companyId} />
                      <div className="slide-card-foot"><Logo id={ev.companyId} size={16} /><span className="trunc">{companyById(ev.companyId).name} · {ev.title}</span><span className="chip">{ev.slides![i].category}</span></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {show('Reports') && results.reports.length > 0 && (
              <section><h3 className="sec-title">Reports <em className="count">{results.reports.length}</em></h3>
                {results.reports.slice(0, kind ? 60 : 5).map((r) => (
                  <div key={r.rid + r.page} className="card pad result clickable" onClick={() => store.openEvent(r.ev.id, 'report', `${r.rid}:${r.page}`)}>
                    <div className="row gap8 wrap"><Logo id={r.ev.companyId} size={20} /><b>{companyById(r.ev.companyId).name}</b><span>{r.title}</span>{r.form && <span className="form-chip">{r.form}</span>}<span className="muted small">{fmtDate(r.ev.date)} · page {r.page + 1}</span></div>
                    <p><Hl text={r.snippet} terms={results.terms} /></p>
                  </div>
                ))}
              </section>
            )}
            {show('Press releases') && results.press.length > 0 && (
              <section><h3 className="sec-title">Press releases <em className="count">{results.press.length}</em></h3>
                {results.press.slice(0, kind ? 60 : 4).map((p) => (
                  <div key={p.id} className="card pad result">
                    <div className="row gap8"><Logo id={p.companyId} size={20} /><b><Hl text={p.title} terms={results.terms} /></b></div>
                    <p className="clamp3"><Hl text={p.excerpt} terms={results.terms} /></p>
                    <span className="muted small">{fmtDate(p.date)} · {p.language}</span>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterAdd({ onAdd }: { onAdd: (f: F) => void }) {
  const store = useStore()
  const [field, setField] = useState<F['field'] | null>(null)
  return (
    <Menu width={250} trigger={(_o, t) => <button className="text-btn" onClick={() => { setField(null); t() }}><ListFilter size={14} />Filter</button>}>
      {(close) => !field ? (
        <>
          <div className="menu-label">Filter by</div>
          {(['Company', 'Watchlist', 'Event type', 'Date', 'Speaker'] as const).map((f) => <button key={f} className="menu-item" onClick={() => setField(f)}><span>{f === 'Speaker' ? 'Speaker role' : f === 'Date' ? 'Date range' : f}</span><ChevronRight size={14} /></button>)}
        </>
      ) : (
        <div className="menu-scroll">
          <div className="menu-label">{field} is</div>
          {field === 'Company' && COMPANIES.map((c) => <button key={c.id} className="menu-item" onClick={() => { onAdd({ field, value: c.id, label: c.name }); close() }}><span className="row gap8"><Logo id={c.id} size={16} />{c.name}</span></button>)}
          {field === 'Watchlist' && [{ id: 'followed', name: 'Followed companies' }, ...store.watchlists].map((w) => <button key={w.id} className="menu-item" onClick={() => { onAdd({ field, value: w.id, label: w.name }); close() }}><span>{w.name}</span></button>)}
          {field === 'Event type' && ['Earnings', 'Conference', 'AGM', 'Update / briefing', 'Monthly sales update'].map((t) => <button key={t} className="menu-item" onClick={() => { onAdd({ field, value: t, label: t }); close() }}><span>{t}</span></button>)}
          {field === 'Date' && [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last 12 months']].map(([v, l]) => <button key={v} className="menu-item" onClick={() => { onAdd({ field, value: v, label: l }); close() }}><span>{l}</span></button>)}
          {field === 'Speaker' && [['exec', 'Management'], ['analyst', 'Analysts']].map(([v, l]) => <button key={v} className="menu-item" onClick={() => { onAdd({ field, value: v, label: l }); close() }}><span>{l}</span></button>)}
        </div>
      )}
    </Menu>
  )
}
