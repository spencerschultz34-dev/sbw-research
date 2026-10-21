import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Search, ChevronRight, X } from 'lucide-react'
import { COMPANIES } from '../data'
import { UNIVERSE_IDS, UNIVERSE_SECTORS } from '../data/universe'
import { Logo, FollowButton } from '../components/ui'
import { useStore } from '../store'

/** SBW coverage universe: profiles are seeded now; earnings materials load later. */
export function CompaniesPage() {
  const navigate=useNavigate()
  useStore() // refresh when SEC/Finnhub fields are added
  const [query,setQuery]=useState('')
  const [sector,setSector]=useState('All sectors')
  const allowed=useMemo(()=>new Set(UNIVERSE_IDS),[])
  const companies=useMemo(()=>COMPANIES.filter(c=>allowed.has(c.id))
    .filter(c=>sector==='All sectors'||c.sector===sector)
    .filter(c=>(c.ticker+' '+c.name+' '+c.sector+' '+c.industry+' '+c.description).toLowerCase().includes(query.toLowerCase().trim()))
    .slice().sort((a,b)=>a.name.localeCompare(b.name)),
    [allowed,sector,query])
  return <div className="page sbw-company-universe">
    <div className="page-head">
      <Building2 size={17}/>
      <span className="page-title">Companies</span>
      <span className="crumb-sub">SBW Coverage Universe</span>
      <span className="grow"/>
      <span className="chip">{UNIVERSE_IDS.length} companies</span>
    </div>
    <div className="page-scroll">
      <div className="sbw-universe-content">
        <div className="sbw-universe-heading">
          <div>
            <h1>Coverage universe</h1>
            <p>Your selected companies, available now for research and watchlists. Earnings data and document coverage will be connected separately.</p>
          </div>
        </div>
        <div className="sbw-universe-filters">
          <div className="sbw-universe-search"><Search size={16}/>
            <input aria-label="Find a company" placeholder="Search company, ticker or industry" value={query} onChange={e=>setQuery(e.target.value)}/>
            {query&&<button className="ghost-icon" title="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>}
          </div>
          <label className="sbw-universe-select">Sector
            <select aria-label="Filter by sector" value={sector} onChange={e=>setSector(e.target.value)}>
              <option>All sectors</option>
              {UNIVERSE_SECTORS.map(s=><option key={s}>{s}</option>)}
            </select>
          </label>
          <span className="muted small">{companies.length} of {UNIVERSE_IDS.length} companies</span>
        </div>
        <div className="sbw-universe-grid">
          {companies.map(c=><article className="sbw-universe-card" key={c.id}>
            <button className="sbw-universe-identity" onClick={()=>navigate('/company/'+c.id)} title={'Open '+c.name}>
              <Logo id={c.id} size={38}/>
              <span className="sbw-universe-identity-copy">
                <strong>{c.name}</strong>
                <span><b>{c.ticker}</b><span className="sbw-universe-mid">·</span>{c.sector}</span>
              </span>
              <ChevronRight size={15}/>
            </button>
            <div className="sbw-universe-industry">{c.industry}</div>
            <p>{c.description}</p>
            <div className="sbw-universe-card-footer">
              <span className="muted small">Company profile</span>
              <FollowButton id={c.id} small />
            </div>
          </article>)}
        </div>
        {companies.length===0&&<div className="empty">No coverage companies match the current filters. Clear the search or choose another sector.</div>}
      </div>
    </div>
  </div>
}
