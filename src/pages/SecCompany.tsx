import { useEffect, useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { ExternalLink, FileText, Landmark } from 'lucide-react'
import { loadCompany, secAvailable, titleCase, type SecCompany, type SecFiling, type SecPoint } from '../sec'
import { Empty } from '../components/ui'

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

export function SecCompanyPage() {
  const { cik = '', tab = 'overview' } = useParams()
  const [data, setData] = useState<SecCompany | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  return (
    <div className="page company">
      <div className="company-head">
        <span className="logo" style={{ width: 28, height: 28, background: 'var(--s1)', fontSize: 12 }}>{data.name[0]}</span>
        <span className="company-name">{titleCase(data.name)}</span>
        {ticker && <span className="chip chip-ticker">{data.tickers.join(' · ')}</span>}
        {data.exchanges[0] && <span className="chip hide-narrow">{data.exchanges.join(', ')}</span>}
        <span className="chip hide-narrow">{data.industry}</span>
        <span className="grow" />
        <span className="chip"><Landmark size={12} />SEC EDGAR</span>
      </div>
      <div className="tabs">
        <NavLink to={`/sec/${cik}`} end className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>Overview</NavLink>
        <NavLink to={`/sec/${cik}/filings`} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>Filings<span className="count">{data.filings.length}</span></NavLink>
      </div>
      <div className="page-scroll">
        {tab === 'filings' ? <Filings filings={data.filings} /> : <Overview d={data} cik={cik} />}
      </div>
    </div>
  )
}

function Overview({ d, cik }: { d: SecCompany; cik: string }) {
  const f = d.financials
  const fy = d.fiscalYearEnd ? `${Number(d.fiscalYearEnd.slice(2))} ${MON[Number(d.fiscalYearEnd.slice(0, 2)) - 1]}` : '–'
  const rows: [string, string | null][] = [
    ['Industry', d.industry], ['Fiscal year ends', fy], ['Headquarters', d.city && d.city.split(', ').map((p, i) => (i === 0 ? titleCase(p) : p)).join(', ')], ['Incorporated in', d.state],
    ['Filer category', d.category], ['CIK', String(d.cik)],
  ]
  return (
    <div className="co-overview">
      <div className="co-left">
        <h3 className="sec-title">Profile</h3>
        <div className="card list-card">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="list-row"><span className="muted">{k}</span><span className="right">{v}</span></div>)}
          {d.website && <div className="list-row"><span className="muted">Website</span><a className="accent" href={d.website.startsWith('http') ? d.website : `https://${d.website}`} target="_blank" rel="noreferrer">{d.website.replace(/^https?:\/\//, '')}</a></div>}
        </div>
        <div className="sec-head"><h2>Latest filings</h2><NavLink className="text-btn" to={`/sec/${cik}/filings`}>All filings</NavLink></div>
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
