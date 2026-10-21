import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronRight, FileText, Headphones } from 'lucide-react'
import { companyById, ensureCompany, eventsForCompany } from '../data'
import { useStore, usePlayer } from '../store'
import { Logo, FollowButton, TimingChips } from './ui'
import { fmtDate, fmtNum, pctChange } from '../format'
import type { CompanyEvent } from '../data/types'

/** Persistent company context for the Quartr-style side-by-side event reader. */
export function EventCompanyContext({ companyId, selectedEventId }: { companyId: string; selectedEventId: string }) {
  const nav = useNavigate()
  const store = useStore()
  const player = usePlayer()
  useEffect(() => { void ensureCompany(companyId) }, [companyId])
  const company = companyById(companyId)
  const events = eventsForCompany(companyId).slice().sort((a, b) => b.date.localeCompare(a.date))
  const future = events.filter(e => e.status === 'upcoming').sort((a,b)=>a.date.localeCompare(b.date))
  const past = events.filter(e => e.status !== 'upcoming')
  const prior = past.filter(e => e.id !== past[0]?.id).slice(0,5)
  const latest = past[0]
  const selected = events.find(e => e.id === selectedEventId)
  const navigateCompany = (tab = '') => { store.closePanel(); nav(`/company/${companyId}${tab ? `/${tab}` : ''}`) }
  const open = (e: CompanyEvent, tab: 'overview' | 'transcript' | 'report' | 'slides' = 'overview') => store.openEvent(e.id, tab)
  const stats = (ev: CompanyEvent) => {
    if (!ev.metrics?.length) return null
    const pastEvent = ev.status !== 'upcoming'
    return <div className="sbw-context-metrics">
      <table><thead><tr><th>in USD</th><th>{pastEvent ? 'Actual' : 'Estimate'}</th><th>{pastEvent ? 'Estimate' : 'Prior'}</th><th>{pastEvent ? 'Beat/miss' : 'Change'}</th></tr></thead>
      <tbody>{ev.metrics.map(m => {
        const actual = m.actual
        const comparison = pastEvent ? m.estimate : m.prior
        const base = pastEvent ? actual : m.estimate
        const change = base != null && comparison != null && comparison !== 0 ? pctChange(base, comparison) : null
        return <tr key={m.label}><td>{m.label}</td><td>{base == null ? '—' : fmtNum(base, m.unit)}</td><td>{comparison == null ? '—' : fmtNum(comparison,m.unit)}</td><td className={change == null ? '' : change >= 0 ? 'pos':'neg'}>{change == null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}</td></tr>
      })}</tbody></table>
    </div>
  }
  const eventCard = (e: CompanyEvent, compact = false) => <article className={`sbw-context-card${selectedEventId===e.id?' is-selected':''}`} key={e.id}>
    <div className="sbw-context-card-heading"><button onClick={() => open(e)}><b>{e.title}</b><small>{fmtDate(e.date)}</small></button><div className="sbw-context-card-actions">
      {e.call && <button title="Open transcript" aria-label="Open transcript" onClick={()=>open(e,'transcript')}><Headphones size={14}/></button>}
      {(e.filing || e.reports.length>0) && <button title="Open report" aria-label="Open report" onClick={()=>open(e,'report')}><FileText size={14}/></button>}
      {e.hasAudio && <button title="Play audio" aria-label="Play audio" onClick={()=>player.play(e.id)}><Headphones size={14}/></button>}
      <button title="Open event" aria-label="Open event" onClick={()=>open(e)}><ChevronRight size={15}/></button>
    </div></div>
    {e.status==='upcoming' && <div className="sbw-context-timing"><TimingChips ev={e} h12={store.prefs.timeFormat==='12'}/></div>}
    {!compact && e.headline && <button className="sbw-context-headline" onClick={()=>open(e)}>{e.headline}</button>}
    {!compact && stats(e)}
    {e.call && !compact && <button className="sbw-context-audio" onClick={()=>{open(e,'transcript');if(e.hasAudio)player.play(e.id)}}><Headphones size={13}/> {e.hasAudio?'Listen and read transcript':'Read transcript'} <ArrowUpRight size={13}/></button>}
  </article>
  return <div className="sbw-company-context" aria-label={`${company.name} research overview`}>
    <div className="sbw-context-head">
      <Logo id={companyId} size={25}/>
      <button className="sbw-context-company-name" onClick={() => navigateCompany()}>{company.name}</button>
      <span className="sbw-context-ticker">{company.country === 'US' ? '🇺🇸 ' : ''}{company.ticker}</span>
      <span className="grow"/>
      <FollowButton id={companyId} small/>
    </div>
    <nav className="sbw-context-tabs" aria-label="Company tabs">
      <button className="on" onClick={() => navigateCompany()}>Overview</button>
      <button onClick={() => navigateCompany('events')}>Events</button>
      <button onClick={() => navigateCompany('documents')}>Documents</button>
      <button onClick={() => navigateCompany('press-releases')}>Press releases</button>
      <button onClick={() => navigateCompany('mentions')}>Mentions</button>
    </nav>
    <div className="sbw-context-scroll">
      {future.length > 0 && <section><h3>Upcoming event</h3>{eventCard(future[0])}</section>}
      {latest ? <section><h3>Latest event</h3>{eventCard(latest)}</section> : <section><h3>Latest event</h3><div className="sbw-context-card"><p className="sbw-context-empty">No earnings call indexed yet.</p></div></section>}
      {prior.length > 0 && <section>
        <div className="sbw-context-section-head"><h3>Earlier events</h3><button onClick={() => navigateCompany('events')}>See all <ChevronRight size={12}/></button></div>
        <div className="sbw-context-event-list">{prior.map(e=>eventCard(e,true))}</div>
      </section>}
      <section>
        <div className="sbw-context-section-head"><h3>Documents</h3><button onClick={() => navigateCompany('documents')}>See all <ChevronRight size={12}/></button></div>
        <button className="sbw-context-explore" onClick={() => navigateCompany('documents')}><FileText size={14}/> SEC filings, earnings releases and reports <ChevronRight size={14}/></button>
      </section>
      {selected?.call && <p className="sbw-context-footnote">Audio and transcripts are available for this event. Documents and slides depend on the original company disclosures.</p>}
    </div>
  </div>
}
