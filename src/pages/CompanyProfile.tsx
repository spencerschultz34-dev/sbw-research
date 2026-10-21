import { NavLink, useParams, useNavigate } from 'react-router-dom'
import { Building2, ArrowUpRight, ChevronRight, FileText, Presentation, Headphones, CalendarDays } from 'lucide-react'
import { companyById, companyStatus, eventsForCompany } from '../data'
import { FollowButton, Logo, Ticker } from '../components/ui'
import { useStore } from '../store'
import { fmtDayMonth } from '../format'

const COUNTRY:Record<string,string>={US:'United States',CA:'Canada',GB:'United Kingdom',CH:'Switzerland',IE:'Ireland',LU:'Luxembourg'}

/** A real, browseable profile even when the issuer has no SEC/market/IR feed yet.
 * Sources are visibly marked as unconnected; no dummy financial statements or events. */
export function CompanyProfileFallback({id}:{id:string}) {
  useStore()
  const {tab='overview'}=useParams()
  const navigate=useNavigate()
  const c=companyById(id)
  const state=companyStatus(id)
  const events=eventsForCompany(id).slice().sort((a,b)=>b.date.localeCompare(a.date))
  const base='/company/'+encodeURIComponent(id)
  const sections:[string,string][]=[['overview','Overview'],['events','Events'],['documents','Documents'],['press-releases','Press releases'],['mentions','Mentions']]
  return <div className="page company sbw-profile-fallback">
    <div className="company-head">
      <Logo id={id} size={30}/>
      <span className="company-name">{c.name}</span>
      <Ticker id={id}/>
      <span className="chip hide-narrow">{c.industry}</span>
      <span className="grow"/>
      <FollowButton id={id} small/>
    </div>
    <nav className="tabs">
      {sections.map(([key,label])=><NavLink key={key} to={key==='overview'?base:base+'/'+key} end={key==='overview'} className={({isActive})=>'tab'+(isActive?' on':'')}>{label}</NavLink>)}
    </nav>
    <div className="page-scroll">
      {tab==='overview'?<div className="sbw-profile-overview">
        <div className="sbw-profile-main">
          <div className="sbw-profile-kicker"><Building2 size={15}/> COMPANY PROFILE</div>
          <h1>{c.name}</h1>
          <div className="sbw-profile-tags"><span>{c.ticker}</span><span>{c.sector||'Sector not classified'}</span><span>{c.industry}</span></div>
          <p className="sbw-profile-description">{c.description||'Company description is not yet available.'}</p>
          <h2>Company details</h2>
          <div className="sbw-profile-details">
            <div><small>Ticker</small><strong>{c.ticker}</strong></div>
            <div><small>Sector</small><strong>{c.sector||'—'}</strong></div>
            <div><small>Industry</small><strong>{c.industry||'—'}</strong></div>
            <div><small>Country</small><strong>{COUNTRY[c.country]||c.country}</strong></div>
            <div><small>Exchange</small><strong>{c.exchange||'Not connected'}</strong></div>
            <div><small>Market cap</small><strong>{c.marketCap||'Not connected'}</strong></div>
          </div>
          {c.website&&<a className="sbw-profile-web" href={c.website} target="_blank" rel="noreferrer">Company website <ArrowUpRight size={14}/></a>}
          <div className="sbw-profile-data-status">{state==='loading'?'Looking for available issuer information…':'Company profile ready. Earnings, documents and market-data feeds will be connected in a later phase.'}</div>
        </div>
        <aside className="sbw-profile-right">
          <h2>Earnings research</h2>
          {events.length?<div className="sbw-profile-event-list">{events.slice(0,4).map(e=><button key={e.id} onClick={()=>navigate(base+'/events')}>
            <span>{e.title}<small>{fmtDayMonth(e.date)}</small></span><ChevronRight size={15}/></button>)}</div>:
          <div className="sbw-profile-no-events"><CalendarDays size={24}/><strong>No connected earnings events yet</strong><p>Historical calls and earnings releases will appear here after the data feed is linked.</p></div>}
          <div className="sbw-profile-source-links">
            <button onClick={()=>navigate(base+'/events')}><CalendarDays size={15}/> Events <ChevronRight size={13}/></button>
            <button onClick={()=>navigate(base+'/documents')}><FileText size={15}/> Documents <ChevronRight size={13}/></button>
            <button onClick={()=>navigate(base+'/press-releases')}><Presentation size={15}/> Press releases <ChevronRight size={13}/></button>
          </div>
        </aside>
      </div>:tab==='events'&&events.length?<div className="sbw-profile-tab">
        <h2>Events</h2>{events.map(e=><div key={e.id} className="sbw-profile-event-list"><span>{e.title} · {fmtDayMonth(e.date)}</span></div>)}
      </div>:<div className="sbw-profile-tab sbw-profile-tab-empty">
        {tab==='events'?<CalendarDays size={27}/>:tab==='documents'?<FileText size={27}/>:tab==='press-releases'?<Presentation size={27}/>:<Headphones size={27}/>}
        <h2>{sections.find(([key])=>key===tab)?.[1]||'Research'}</h2>
        <p>Not connected yet for {c.ticker}. The company profile is available now; original company earnings and research documents will be added through the aggregator.</p>
        <button className="text-btn" onClick={()=>navigate(base)}>Back to company overview <ChevronRight size={13}/></button>
      </div>}
    </div>
  </div>
}
