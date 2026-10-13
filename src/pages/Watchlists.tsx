import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Search, Menu as MenuIcon, FileDown, EllipsisVertical, Sparkle, Calendar } from 'lucide-react'
import { COMPANIES, EVENTS } from '../data'
import { companyById } from '../data/companies'
import { uid, useStore } from '../store'
import { eventWhen } from '../format'
import { Logo, Menu, Modal, Ticker, Flag } from '../components/ui'

export function WatchlistsPage() {
  const { id = 'followed' } = useParams()
  const [params, setParams] = useSearchParams()
  const store = useStore()
  const nav = useNavigate()
  const [side, setSide] = useState(true)
  const [find, setFind] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [naming, setNaming] = useState<null | { id?: string; name: string }>(null)
  useEffect(() => { if (params.get('new')) { setNaming({ name: '' }); setParams({}, { replace: true }) } }, []) // eslint-disable-line
  const wl = id === 'followed' ? { id: 'followed', name: 'Followed companies', companyIds: store.follows } : store.watchlists.find((w) => w.id === id)
  if (!wl) return null
  const ids = [...wl.companyIds].sort((a, b) => companyById(a).name.localeCompare(companyById(b).name))
  const setIds = (fn: (x: string[]) => string[]) => {
    if (wl.id === 'followed') store.set('follows', fn)
    else store.set('watchlists', (ws) => ws.map((w) => (w.id === wl.id ? { ...w, companyIds: fn(w.companyIds) } : w)))
  }
  const nextEvent = (cid: string) => EVENTS.filter((e) => e.companyId === cid && e.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date))[0]
  const exportCsv = () => {
    const csv = ['Company,Ticker,Country,Industry', ...ids.map((c) => { const x = companyById(c); return `"${x.name}",${x.ticker},${x.country},"${x.industry}"` })].join('\n')
    navigator.clipboard?.writeText(csv).then(() => store.notify('Copied as CSV'), () => store.notify('Copy is blocked here'))
  }
  return (
    <div className="page">
      <div className="page-head">
        <button className="ghost-icon" aria-label="Toggle list" onClick={() => setSide(!side)}><MenuIcon size={16} /></button>
        <span className="page-title">Watchlists</span><span className="crumb-sub">{wl.name}</span>
      </div>
      <div className={`with-side${side ? '' : ' side-hidden'}`}>
        <aside className="subside">
          <button className="sub-item" onClick={() => setNaming({ name: '' })}><Plus size={15} />New watchlist</button>
          <div className="sub-sep" />
          <div className="find"><Search size={14} /><input id="find-wl" placeholder="Find watchlists" value={find} onChange={(e) => setFind(e.target.value)} /></div>
          <NavLink to="/watchlists" end className="sub-chat"><span className="trunc">Followed companies</span><em className="count">{store.follows.length}</em></NavLink>
          {store.watchlists.filter((w) => w.name.toLowerCase().includes(find.toLowerCase())).map((w) => (
            <NavLink key={w.id} to={`/watchlists/${w.id}`} className="sub-chat"><span className="trunc">{w.name}</span><em className="count">{w.companyIds.length}</em></NavLink>
          ))}
        </aside>
        <div className="with-side-main scroll">
          <div className="narrow-col wide">
            <div className="row between">
              <h2 className="col-title">{wl.name}</h2>
              <span className="row gap6">
                <button className="btn btn-light" onClick={() => setAdding(true)}>Add companies</button>
                <button className="ghost-icon boxed" title="Export as CSV" onClick={exportCsv}><FileDown size={15} /></button>
                <Menu align="right" width={220} trigger={(_o, t) => <button className="ghost-icon boxed" aria-label="More" onClick={t}><EllipsisVertical size={15} /></button>}>
                  {(close) => (
                    <>
                      <button className="menu-item" onClick={() => { nav(`/chat`); close() }}><span><Sparkle size={14} /> Ask AI about this list</span></button>
                      <button className="menu-item" onClick={() => { nav('/calendar'); close() }}><span><Calendar size={14} /> Open in calendar</span></button>
                      {wl.id !== 'followed' && <button className="menu-item" onClick={() => { setNaming({ id: wl.id, name: wl.name }); close() }}><span>Rename</span></button>}
                      {wl.id !== 'followed' && <button className="menu-item danger" onClick={() => { store.set('watchlists', (ws) => ws.filter((w) => w.id !== wl.id)); nav('/watchlists'); close() }}><span>Delete watchlist</span></button>}
                    </>
                  )}
                </Menu>
              </span>
            </div>
            <div className="row between list-meta">
              <span className="muted small">{ids.length} compan{ids.length === 1 ? 'y' : 'ies'}</span>
              {sel.length > 0 && <button className="text-btn small" onClick={() => { setIds((x) => x.filter((c) => !sel.includes(c))); store.notify(`Removed ${sel.length}`); setSel([]) }}>Remove {sel.length} selected</button>}
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th><span className="cell-title"><input type="checkbox" aria-label="Select all" checked={sel.length === ids.length && ids.length > 0} onChange={() => setSel(sel.length === ids.length ? [] : ids)} />Company</span></th>
                  <th>Ticker</th><th className="hide-narrow">Industry</th><th className="hide-narrow">Next event</th>
                </tr></thead>
                <tbody>
                  {ids.map((cid) => {
                    const c = companyById(cid); const n = nextEvent(cid)
                    return (
                      <tr key={cid} className="clickable" onClick={() => nav(`/company/${cid}`)}>
                        <td><span className="cell-title"><input type="checkbox" aria-label={`Select ${c.name}`} checked={sel.includes(cid)} onClick={(e) => e.stopPropagation()} onChange={() => setSel((s) => (s.includes(cid) ? s.filter((x) => x !== cid) : [...s, cid]))} /><Logo id={cid} size={22} />{c.name}</span></td>
                        <td><span className="row gap6"><Flag country={c.country} />{c.ticker}</span></td>
                        <td className="hide-narrow muted">{c.industry}</td>
                        <td className="hide-narrow nowrap">{n ? <>{n.title} · {eventWhen(n.date)}{n.estimated && <i className="dot-est" title="Estimated" />}</> : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {adding && (
        <Modal title={`Add companies to ${wl.name}`} width={520} onClose={() => setAdding(false)} footer={<button className="btn btn-light" onClick={() => setAdding(false)}>Done</button>}>
          <AddCompanies ids={wl.companyIds} onToggle={(cid) => setIds((x) => (x.includes(cid) ? x.filter((c) => c !== cid) : [...x, cid]))} />
        </Modal>
      )}
      {naming && (
        <Modal title={naming.id ? 'Rename watchlist' : 'New watchlist'} onClose={() => setNaming(null)} footer={<>
          <button className="btn btn-quiet" onClick={() => setNaming(null)}>Cancel</button>
          <button className="btn btn-light" disabled={!naming.name.trim()} onClick={() => {
            if (naming.id) store.set('watchlists', (ws) => ws.map((w) => (w.id === naming.id ? { ...w, name: naming.name.trim() } : w)))
            else { const nid = uid('wl'); store.set('watchlists', (ws) => [...ws, { id: nid, name: naming.name.trim(), companyIds: [] }]); nav(`/watchlists/${nid}`) }
            setNaming(null)
          }}>{naming.id ? 'Rename' : 'Create watchlist'}</button>
        </>}>
          <label className="field-label" htmlFor="wl-name">Name</label>
          <input id="wl-name" className="input" autoFocus value={naming.name} placeholder="e.g. Holdings, Semis peers" onChange={(e) => setNaming({ ...naming, name: e.target.value })} />
        </Modal>
      )}
    </div>
  )
}

function AddCompanies({ ids, onToggle }: { ids: string[]; onToggle: (id: string) => void }) {
  const [q, setQ] = useState('')
  const list = COMPANIES.filter((c) => `${c.name} ${c.ticker}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="find big"><Search size={15} /><input id="add-co" autoFocus placeholder="Search by name or ticker" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="pick-list">
        {list.map((c) => (
          <label key={c.id} className="pick-row">
            <input type="checkbox" checked={ids.includes(c.id)} onChange={() => onToggle(c.id)} />
            <Logo id={c.id} size={22} /><span className="grow">{c.name}</span><Ticker id={c.id} />
          </label>
        ))}
      </div>
    </>
  )
}
