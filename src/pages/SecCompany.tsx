import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { ExternalLink, FileText, Headphones, Landmark, Sparkle, ChevronRight } from 'lucide-react'
import { companyById, eventsForCompany, ensureCompany } from '../data'
import { useStore } from '../store'
import { fmtDayMonth } from '../format'
import { ConsensusTable } from '../components/EventPanel'
import { CallView } from './CallView'
import { IrLatest, IrReleases, IrSourceForm } from './IrViews'
import { useIrSource } from '../ir'
import { archiveUrl, callExchange, isEarnings, loadCallEvents, type CallEvent, loadCompany, loadExhibits, secAvailable, titleCase, type SecDoc, type SecCompany, type SecFiling, type SecPoint } from '../sec'
import { Empty, FollowButton, Logo, TimingChips } from '../components/ui'
import { Donut, SERIES } from '../components/visuals'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// SEC dates are plain calendar dates; format them without a timezone shift.
const day = (ymd: string | null) => { if (!ymd) return '–'; const [y, m, d] = ymd.split('-').map(Number); return `${d} ${MON[m - 1]}, ${y}` }
const money = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  return a >= 1e9 ? `${s}${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${s}${(a / 1e6).toFixed(1)}M` : `${s}${a.toLocaleString('en-US')}`
}

const GROUPS: [string, (f: string) => boolean][] = [
  ['All', () => true],
  ['Annual', (f) => /^(10-K|20-F|40-F)/.test(f)],
  ['Quarterly', (f) => /^10-Q/.test(f)],
  ['Current', (f) => /^(8-K|6-K)/.test(f)],
  ['Proxy', (f) => /^(DEF|DEFA|PRE) ?14/.test(f)],
  ['Ownership', (f) => /^(3|4|5|SC 13|SCHEDULE 13|144)/.test(f)],
]

export function SecCompanyPage(props: { cik?: string; base?: string; companyId?: string }) {
  const params = useParams()
  const cik = props.cik ?? params.cik ?? ''
  const tab = params.tab ?? 'overview'
  const base = props.base ?? `/sec/${cik}`
  const nav = useNavigate()
  const [data, setData] = useState<SecCompany | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ir = useIrSource(data?.cik ?? 0, data?.tickers ?? [])

  useEffect(() => {
    setData(null); setError(null)
    if (!secAvailable) { setError('Live SEC data works on the hosted site (sbwresearch.vercel.app), not in this preview.'); return }
    let on = true
    loadCompany(Number(cik)).then((d) => on && setData(d)).catch((e) => on && setError(e.message))
    return () => { on = false }
  }, [cik])

  if (error) return <div className="page"><div className="page-head"><span className="page-title">SEC company</span></div><div className="page-scroll"><Empty>{error}</Empty></div></div>
  if (!data) return <div className="page"><div className="page-head"><span className="page-title">Loading SEC data…</span></div></div>

  const ticker = data.tickers[0]
  const full = tab === 'earnings' || tab === 'events' || tab === 'press-releases'
  const cid = props.companyId ?? ticker?.toLowerCase() ?? ''
  return (
    <div className="page company">
      <div className="company-head">
        {cid ? <Logo id={cid} size={28} /> : <span className="logo" style={{ width: 28, height: 28, background: 'var(--s1)', fontSize: 12 }}>{data.name[0]}</span>}
        <span className="company-name">{titleCase(data.name)}</span>
        {ticker && <span className="chip chip-ticker">{data.tickers.join(' · ')}</span>}
        {data.exchanges[0] && <span className="chip hide-narrow">{data.exchanges.join(', ')}</span>}
        <span className="chip hide-narrow">{data.industry}</span>
        <span className="grow" />
        {cid && companyById(cid).marketCap && <span className="chip hide-narrow">Market cap: {companyById(cid).marketCap}</span>}
        <span className="chip hide-narrow"><Landmark size={12} />SEC EDGAR</span>
        {cid && <button className="ghost-icon" title={`Ask AI about ${titleCase(data.name)}`} onClick={() => nav(`/chat?scope=${cid}`)}><Sparkle size={16} /></button>}
        {cid && <FollowButton id={cid} small />}
      </div>
      <div className="tabs">
        <NavLink to={base} end className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>Overview</NavLink>
        <NavLink to={`${base}/events`} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>Events</NavLink>
        <NavLink to={`${base}/documents`} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>Documents <span className="count">{data.filings.length}</span></NavLink>
        <NavLink to={`${base}/press-releases`} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>Press releases</NavLink>
        <NavLink to={`${base}/mentions`} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>Mentions</NavLink>
      </div>
      <div className={full ? 'earn-wrap' : 'page-scroll'}>
        {(tab === 'filings' || tab === 'documents') ? <Filings filings={data.filings} />
          : tab === 'earnings' ? <Earnings d={data} />
          : tab === 'events' ? <UnifiedEvents d={data} cid={cid} base={base} />
          : tab === 'press-releases' ? (ir ? <IrReleases source={ir} /> : <AddIr ticker={ticker} />)
          : tab === 'mentions' ? <div className="tab-body sbw-coming"><h2>Company mentions</h2><p className="muted">Cross-company transcript and document mentions will appear as they are indexed. No indexed mentions are available yet.</p></div>
          : <Overview d={data} base={base} cid={cid} />}
      </div>
    </div>
  )
}

/** Company events are shown even without a configured investor relations website. */
function UnifiedEvents({ d, cid, base }: { d: SecCompany; cid: string; base: string }) {
  const store = useStore()
  const [category, setCategory] = useState<'all' | 'upcoming' | 'past'>('all')
  useEffect(() => { if (cid) void ensureCompany(cid) }, [cid])
  const items = eventsForCompany(cid).filter(e => category === 'all' || (category === 'upcoming' ? e.status === 'upcoming' : e.status !== 'upcoming')).sort((a,b) => b.date.localeCompare(a.date))
  const now = Date.now()
  const next = items.filter(e=>Date.parse(e.date)>now).sort((a,b)=>a.date.localeCompare(b.date))
  const earlier = items.filter(e=>Date.parse(e.date)<=now)
  const render = (e: typeof items[number]) => <button key={e.id} className="sbw-event-row" onClick={() => store.openEvent(e.id, e.status === 'upcoming' ? 'overview' : e.call ? 'transcript' : 'overview') }>
    <span className="sbw-event-name">{e.title}<small>{e.type} · {day(e.date.slice(0,10))}</small></span>
    <span className="sbw-event-actions">{e.call && <span className="chip"><Headphones size={12} /> Transcript</span>}{e.filing && <span className="chip"><FileText size={12} /> Filing</span>}{e.status === 'upcoming' && <span className="chip">Upcoming</span>}<ChevronRight size={15} /></span>
  </button>
  return <div className="sbw-event-directory">
    <div className="sbw-event-directory-head"><h2>Events</h2><span className="muted small">{items.length} events · {d.name}</span></div>
    <div className="sbw-event-filters">{([['all','All events'],['upcoming','Upcoming'],['past','Earlier events']] as const).map(([v,label])=><button className={`fchip${category===v?' on':''}`} key={v} onClick={()=>setCategory(v)}>{label}</button>)}</div>
    {next.length>0 && <><h3 className="sec-title">Upcoming events</h3><div className="sbw-event-table">{next.map(render)}</div></>}
    {earlier.length>0 && <><h3 className="sec-title">Earlier events</h3><div className="sbw-event-table">{earlier.map(render)}</div></>}
    {!items.length && <div className="card pad"><p>We haven't indexed an earnings event for {d.name} yet.</p><p className="muted small">You can still read SEC earnings releases and reports on the Documents tab.</p><NavLink className="btn btn-light" to={`${base}/earnings`}>View earnings filings <ChevronRight size={14}/></NavLink></div>}
    <div className="sbw-event-foot"><NavLink className="text-btn" to={`${base}/earnings`}>Earnings releases and filings <ChevronRight size={13}/></NavLink></div>
  </div>
}

function Overview({ d, base, cid }: { d: SecCompany; base: string; cid: string }) {
  const store = useStore()
  const ir = useIrSource(d.cik, d.tickers)
  const next = cid ? eventsForCompany(cid).filter((e) => e.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date))[0] : undefined
  const historical = cid ? eventsForCompany(cid).filter(e => e.status !== 'upcoming').sort((a,b)=>b.date.localeCompare(a.date)) : []
  const latestEvent = historical[0]
  const latestCall = historical.find(e => e.call)
  const f = d.financials
  const fy = d.fiscalYearEnd ? `${Number(d.fiscalYearEnd.slice(2))} ${MON[Number(d.fiscalYearEnd.slice(0, 2)) - 1]}` : '–'
  const rows: [string, string | null][] = [
    ['Industry', d.industry], ['Fiscal year ends', fy], ['Headquarters', d.city && d.city.split(', ').map((p, i) => (i === 0 ? titleCase(p) : p)).join(', ')], ['Incorporated in', d.state],
    ['Filer category', d.category], ['CIK', String(d.cik)],
  ]
  return (
    <div className="co-overview">
      <div className="co-left">
        <div className="sbw-co-section-title"><h3>Upcoming event</h3><NavLink to={`${base}/events`} className="text-btn">All events <ChevronRight size={14}/></NavLink></div>
        {next ? (
          <button className="card sbw-overview-event" onClick={() => store.openEvent(next.id)}>
            <div className="sbw-overview-event-heading"><strong>{next.title}</strong><span className="chip">{next.estimated ? 'Estimated' : 'Upcoming'}</span></div>
            <span className="muted small">{fmtDayMonth(next.date)}</span>
            <TimingChips ev={next} h12={store.prefs.timeFormat === '12'} />
            {next.metrics && <div className="sbw-overview-metrics"><ConsensusTable ev={next} compact /></div>}
            <span className="sbw-overview-action">View event <ChevronRight size={14}/></span>
          </button>
        ) : <div className="card pad"><span className="muted small">No upcoming earnings date has been confirmed by our current data sources.</span></div>}
        <div className="sbw-co-section-title"><h3>Latest event</h3><NavLink to={`${base}/events`} className="text-btn">Earlier events <ChevronRight size={14}/></NavLink></div>
        {latestEvent ? (
          <div className="card sbw-overview-event">
            <button className="sbw-event-card-main" onClick={() => store.openEvent(latestEvent.id)}>
              <strong>{latestEvent.title}</strong>
              <span className="muted small">{fmtDayMonth(latestEvent.date)}</span>
              {latestEvent.headline && <span className="sbw-event-headline">{latestEvent.headline}</span>}
              {latestEvent.metrics?.length ? <ConsensusTable ev={latestEvent} compact /> : null}
            </button>
            <div className="sbw-overview-event-quick">
              {(latestEvent.call || latestCall) && <button onClick={() => store.openEvent((latestEvent.call ? latestEvent : latestCall!).id, 'transcript')}><Headphones size={14}/> Transcript and audio</button>}
              {latestEvent.filing && <button onClick={() => store.openEvent(latestEvent.id,'report')}><FileText size={14}/> Report</button>}
              <NavLink to={`${base}/earnings`}>Earnings documents <ChevronRight size={14}/></NavLink>
            </div>
          </div>
        ) : (d.filings.find(isEarnings) ? <NavLink to={`${base}/earnings`} className="card pad clickable block"><strong>Latest earnings release</strong><small className="muted block">Filed {day(d.filings.find(isEarnings)!.filed)} · View SEC release and supporting documents</small></NavLink> : <div className="card pad muted small">No prior earnings events indexed.</div>)}
        {ir && <IrLatest source={ir} cik={String(d.cik)} />}
        <h3 className="sec-title">Profile</h3>
        <div className="card list-card">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="list-row"><span className="muted">{k}</span><span className="right">{v}</span></div>)}
          {d.website && <div className="list-row"><span className="muted">Website</span><a className="accent" href={d.website.startsWith('http') ? d.website : `https://${d.website}`} target="_blank" rel="noreferrer">{d.website.replace(/^https?:\/\//, '')}</a></div>}
        </div>
        <div className="sec-head"><h2>Latest filings</h2><NavLink className="text-btn" to={`${base}/filings`}>All filings</NavLink></div>
        <div className="card list-card">
          {d.filings.slice(0, 6).map((x) => (
            <a key={x.url} className="list-row clickable" href={x.url} target="_blank" rel="noreferrer">
              <div className="min0"><b className="trunc">{x.title === x.form ? describe(x.form) : x.title}</b><small>{x.form} · filed {day(x.filed)}</small></div>
              <ExternalLink size={14} className="muted" />
            </a>
          ))}
        </div>
      </div>
      <div className="co-right">
        <h3 className="sec-title">Quarterly results</h3>
        {!f || !f.revenue.length ? <div className="card pad"><span className="muted">No quarterly figures in this company's XBRL data.</span></div> : <Financials f={f} />}
        {d.tickers[0] && <Consensus ticker={d.tickers[0]} />}
        {d.tickers[0] && <Segments ticker={d.tickers[0]} />}
      </div>
    </div>
  )
}

function Financials({ f }: { f: NonNullable<SecCompany['financials']> }) {
  const ends = f.revenue.map((p) => p.end)
  const at = (s: SecPoint[], end: string) => s.find((p) => p.end === end)
  const anyDerived = Object.values(f).some((s) => s.some((p) => p.derived))
  const lines: [string, SecPoint[], (v: number) => string][] = [
    ['Revenue', f.revenue, money], ['Operating income', f.operatingIncome, money], ['Net income', f.netIncome, money], ['Diluted EPS', f.eps, (v) => v.toFixed(2)],
  ]
  return (
    <div className="card pad">
      <RevenueBars points={f.revenue} />
      <div className="table-wrap">
        <table className="num-table">
          <thead><tr><th>USD</th>{ends.map((e) => <th key={e}>{f.revenue.find((p) => p.end === e)!.label}</th>)}</tr></thead>
          <tbody>
            {lines.map(([label, s, fmt]) => (
              <tr key={label}><td>{label}</td>{ends.map((e) => { const p = at(s, e); return <td key={e}>{p ? fmt(p.value) : '–'}{p?.derived ? '*' : ''}</td> })}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">As reported to the SEC in 10-Q and 10-K filings. Quarters are the company's fiscal quarters.{anyDerived ? ' * Fourth quarter worked out as the full year minus the first three quarters.' : ''}</p>
    </div>
  )
}

function RevenueBars({ points }: { points: SecPoint[] }) {
  const W = 560, H = 170, padB = 22, padT = 18
  const max = Math.max(...points.map((p) => p.value), 1)
  const bw = W / points.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Quarterly revenue">
      {points.map((p, i) => {
        const h = Math.max(0, (p.value / max) * (H - padB - padT))
        const x = i * bw + bw * 0.2
        return (
          <g key={p.end}>
            <rect x={x} y={H - padB - h} width={bw * 0.6} height={h} rx={3} fill="var(--s1)" opacity={p.derived ? 0.6 : 1} />
            <text x={x + bw * 0.3} y={H - padB - h - 5} textAnchor="middle" className="axis">{money(p.value)}</text>
            <text x={x + bw * 0.3} y={H - 6} textAnchor="middle" className="axis">{p.label.replace(' FY', " '").replace(/'(\d\d)(\d\d)$/, "'$2")}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Filings({ filings }: { filings: SecFiling[] }) {
  const [group, setGroup] = useState('All')
  const counts = useMemo(() => Object.fromEntries(GROUPS.map(([g, t]) => [g, filings.filter((f) => t(f.form)).length])), [filings])
  const test = GROUPS.find(([g]) => g === group)![1]
  const list = filings.filter((f) => test(f.form))
  return (
    <div className="tab-body">
      <div className="filter-row">
        {GROUPS.map(([g]) => <button key={g} className={`fchip${group === g ? ' on' : ''}`} onClick={() => setGroup(g)}>{g}<em>{counts[g]}</em></button>)}
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="data-table">
          <thead><tr><th>Document</th><th className="hide-narrow">Form</th><th className="hide-narrow">Period</th><th>Filed</th><th /></tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.url} className="clickable" onClick={() => window.open(x.url, '_blank', 'noopener')}>
                <td><span className="cell-title"><FileText size={15} className="muted" /><span className="min0"><b className="trunc block">{x.title === x.form ? describe(x.form) : x.title}</b>{x.items && <small className="muted">Items {x.items}</small>}</span></span></td>
                <td className="hide-narrow"><span className="form-chip">{x.form}</span></td>
                <td className="hide-narrow nowrap">{day(x.period)}</td>
                <td className="nowrap">{day(x.filed)}</td>
                <td className="right"><a href={x.index} target="_blank" rel="noreferrer" className="ghost-icon" aria-label="All files in this filing" onClick={(e) => e.stopPropagation()}><ExternalLink size={14} /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty>No filings of this type in the latest 200.</Empty>}
      </div>
    </div>
  )
}

const FORM_NAMES: Record<string, string> = {
  '10-K': 'Annual report', '10-Q': 'Quarterly report', '8-K': 'Current report', 'DEF 14A': 'Proxy statement', '4': 'Insider transaction',
  '3': 'Initial insider holdings', 'S-8': 'Employee stock plan registration', 'SC 13G': 'Large holder disclosure', 'SC 13G/A': 'Large holder disclosure (amended)',
  '144': 'Proposed sale of restricted stock', '20-F': 'Annual report (foreign issuer)', '6-K': 'Current report (foreign issuer)', '11-K': 'Employee plan annual report',
}
const describe = (form: string) => FORM_NAMES[form] ?? form

/* ---------- Earnings: press release and slides from 8-K Item 2.02 filings ---------- */

type DocKind = 'release' | 'slides' | 'other'
function kindOf(d: SecDoc): DocKind {
  const t = `${d.type} ${d.description}`.toLowerCase()
  if (/presentation|slides|supplement|investor/.test(t) || (d.type === 'EX-99.2' && /\.pdf$/i.test(d.name))) return 'slides'
  if (/press release|earnings release|news release|results/.test(t) || d.type === 'EX-99.1') return 'release'
  return 'other'
}

function Earnings({ d }: { d: SecCompany }) {
  const list = d.filings.filter(isEarnings)
  const symbol = d.tickers[0] ?? ''
  const exchange = callExchange(d.exchanges[0])
  const [acc, setAcc] = useState(list[0]?.acc)
  const [docs, setDocs] = useState<SecDoc[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [cur, setCur] = useState<string | null>(null) // 'call' or a document path
  const [calls, setCalls] = useState<CallEvent[]>([])

  useEffect(() => {
    if (!symbol || !exchange) return
    let on = true
    loadCallEvents(symbol, exchange, d.fiscalYearEnd || '1231').then((x) => on && setCalls(x)).catch(() => {})
    return () => { on = false }
  }, [symbol, exchange, d.fiscalYearEnd])

  // An earnings call usually happens the day the 8-K is filed; allow a few days either way.
  const callFor = (filed: string) => calls.find((c) => c.date && c.published && Math.abs(Date.parse(c.date) - Date.parse(filed + 'T12:00:00Z')) < 4 * 864e5)

  useEffect(() => {
    if (!acc) return
    setDocs(null); setErr(null); setCur(null)
    let on = true
    loadExhibits(d.cik, acc).then((x) => {
      if (!on) return
      const useful = x.filter((y) => /^EX-99/.test(y.type) || /\.pdf$/i.test(y.name))
      setDocs(useful)
      setCur((c) => c ?? (useful.find((y) => kindOf(y) === 'release') ?? useful[0])?.path ?? null)
    }).catch((e) => on && setErr(e.message))
    return () => { on = false }
  }, [acc, d.cik])

  const filing = list.find((f) => f.acc === acc)
  const call = filing ? callFor(filing.filed) : undefined
  // Open the call first when there is one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (call) setCur('call') }, [call?.year, call?.quarter, acc])

  if (!list.length || !filing) return <Empty>No earnings filings (8-K Item 2.02) in this company's recent filings.</Empty>
  const label = (k: DocKind) => (k === 'release' ? 'Press release' : k === 'slides' ? 'Presentation' : 'Exhibit')
  const current = docs?.find((x) => x.path === cur)
  return (
    <div className="earn">
      <aside className="earn-list">
        {list.map((f) => {
          const c = callFor(f.filed)
          return (
            <button key={f.acc} className={`sub-item${f.acc === acc ? ' active' : ''}`} onClick={() => { setAcc(f.acc); setCur(null) }}>
              <span className="min0">
                <b className="block">{c ? `Q${c.quarter} FY${c.year}` : `Results · ${MON[Number(f.filed.slice(5, 7)) - 1]} ${f.filed.slice(0, 4)}`}</b>
                <small className="muted">{day(f.filed)}{c ? ' · call' : ''}</small>
                {c?.eps?.actual != null && c.eps.estimate != null && (
                  <small className={`block ${c.eps.actual >= c.eps.estimate ? 'pos' : 'neg'}`}>EPS {c.eps.actual.toFixed(2)} vs {c.eps.estimate.toFixed(2)} est.</small>
                )}
              </span>
            </button>
          )
        })}
      </aside>
      <section className="earn-main">
        <div className="doc-toolbar">
          {call && <button className={`fchip${cur === 'call' ? ' on' : ''}`} onClick={() => setCur('call')}><Headphones size={13} />Call &amp; transcript</button>}
          {docs?.map((x) => (
            <button key={x.path} className={`fchip${x.path === cur ? ' on' : ''}`} onClick={() => setCur(x.path)} title={x.description}>
              {label(kindOf(x))}<em>{x.type.replace('EX-', 'Ex ')}</em>
            </button>
          ))}
          <span className="grow" />
          {current && <a className="text-btn" href={archiveUrl(current.path)} target="_blank" rel="noreferrer">Open<ExternalLink size={13} /></a>}
          <a className="text-btn hide-narrow" href={filing.index} target="_blank" rel="noreferrer">Filing on sec.gov<ExternalLink size={13} /></a>
        </div>
        {cur === 'call' && call ? <CallView symbol={symbol} exchange={exchange} year={call.year} quarter={call.quarter} /> : <>
          {err && <Empty>{err}</Empty>}
          {!err && !docs && <Empty>Loading documents…</Empty>}
          {docs && !docs.length && <Empty>This filing has no attached release or slides. <a className="accent" href={filing.url} target="_blank" rel="noreferrer">Open the 8-K</a></Empty>}
          {current && <iframe key={current.path} className="earn-frame" title={current.description || current.name} src={archiveUrl(current.path)} />}
        </>}
      </section>
    </div>
  )
}

/* ---------- Business Quant: consensus estimates and segments ---------- */

interface BqVal { estimate: number | null; reported: number | null; high: number | null; low: number | null }
interface BqRow { period: string; end: string; reported: boolean; revenue: BqVal | null; eps: BqVal | null }
interface BqSegGroup { name: string; period: string | null; items: { name: string; value: number }[] }

function useBq<T>(type: string, ticker: string) {
  const [data, setData] = useState<T | null>(null)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    setData(null); setNote(null)
    let on = true
    fetch(`/api/bq?type=${type}&ticker=${encodeURIComponent(ticker)}`)
      .then(async (r) => {
        const body = r.headers.get('content-type')?.includes('json') ? await r.json() : null
        if (!on) return
        if (r.ok && body) setData(body)
        else if (r.status === 403) setNote(body?.error ?? null) // company not in the plan: say so once
      })
      .catch(() => {})
    return () => { on = false }
  }, [type, ticker])
  return { data, note }
}

const pct = (a: number, b: number) => ((a - b) / Math.abs(b)) * 100
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

function Consensus({ ticker }: { ticker: string }) {
  const { data, note } = useBq<{ quarters: BqRow[] }>('estimates', ticker)
  if (note) return <><h3 className="sec-title">Consensus estimates</h3><div className="card pad"><span className="muted small">{note}</span></div></>
  if (!data?.quarters.length) return null
  const next = data.quarters.find((q) => !q.reported)
  const past = data.quarters.filter((q) => q.reported && q.revenue?.reported != null).slice(-4).reverse()
  const cell = (v: number | null | undefined, eps: boolean) => (v == null ? '–' : eps ? v.toFixed(2) : money(v))
  return (
    <>
      <h3 className="sec-title">Consensus estimates</h3>
      <div className="card pad">
        {next && (
          <>
            <b>Next quarter · {next.period} <span className="muted small">(period ends {day(next.end)})</span></b>
            <div className="table-wrap">
              <table className="num-table">
                <thead><tr><th>USD</th><th>Consensus</th><th>Low</th><th>High</th></tr></thead>
                <tbody>
                  <tr><td>Revenue</td><td>{cell(next.revenue?.estimate, false)}</td><td>{cell(next.revenue?.low, false)}</td><td>{cell(next.revenue?.high, false)}</td></tr>
                  <tr><td>EPS</td><td>{cell(next.eps?.estimate, true)}</td><td>{cell(next.eps?.low, true)}</td><td>{cell(next.eps?.high, true)}</td></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        {past.length > 0 && (
          <>
            <b>Beat / miss, last {past.length} quarters</b>
            <div className="table-wrap">
              <table className="num-table">
                <thead><tr><th>Quarter</th><th>Revenue</th><th>vs est.</th><th>EPS</th><th>vs est.</th></tr></thead>
                <tbody>
                  {past.map((q) => {
                    const rv = q.revenue?.reported != null && q.revenue.estimate ? pct(q.revenue.reported, q.revenue.estimate) : null
                    const ev = q.eps?.reported != null && q.eps.estimate ? pct(q.eps.reported, q.eps.estimate) : null
                    return (
                      <tr key={q.end}>
                        <td>{q.period}</td>
                        <td>{cell(q.revenue?.reported, false)}</td><td className={rv == null ? '' : rv >= 0 ? 'pos' : 'neg'}>{rv == null ? '–' : signed(rv)}</td>
                        <td>{cell(q.eps?.reported, true)}</td><td className={ev == null ? '' : ev >= 0 ? 'pos' : 'neg'}>{ev == null ? '–' : signed(ev)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="muted small">Analyst consensus from Business Quant.</p>
      </div>
    </>
  )
}

function Segments({ ticker }: { ticker: string }) {
  const { data } = useBq<{ groups: BqSegGroup[] }>('segments', ticker)
  if (!data?.groups.length) return null
  return (
    <>
      <h3 className="sec-title">Revenue by segment{data.groups[0].period ? <span className="muted small"> · fiscal year ended {day(data.groups[0].period)}</span> : null}</h3>
      <div className="seg-grid">
        {data.groups.map((g) => {
          const total = g.items.reduce((a, x) => a + x.value, 0)
          // Keep the chart readable: the largest four, everything else as "Other".
          const top = g.items.slice(0, 4)
          const rest = g.items.slice(4).reduce((a, x) => a + x.value, 0)
          const items = [...top, ...(rest > 0 ? [{ name: 'Other', value: rest }] : [])].map((x) => ({ name: x.name, value: x.value, pct: (x.value / total) * 100 }))
          return (
            <div key={g.name} className="card seg-card">
              <div className="seg-title"><b>{g.name}</b><small>Total {money(total)}</small></div>
              <div className="seg-body">
                <Donut items={items} size={96} />
                <ul className="legend">
                  {items.map((x, i) => <li key={x.name}><i style={{ background: SERIES[i % SERIES.length] }} /><span>{x.name}</span><b>{Math.round(x.pct)}%</b></li>)}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function AddIr({ ticker }: { ticker?: string }) {
  if (!ticker) return <Empty>This company has no ticker to link an investor relations page to.</Empty>
  return <div className="page-scroll"><div className="narrow-col pad-top">
    <h2 className="col-title">Add {ticker}'s investor relations page</h2>
    <p className="muted">Add this company's investor relations website to view its events, releases and presentations.</p>
    <IrSourceForm presetTicker={ticker} />
  </div></div>
}
