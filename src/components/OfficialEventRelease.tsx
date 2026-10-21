import { useEffect, useState } from 'react'
import { FileText, ExternalLink } from 'lucide-react'
import { loadIrSite, useIrSource, type IrDoc } from '../ir'
import { companyById } from '../data/companies'
import type { CompanyEvent } from '../data/types'
import { PagedSecRelease } from './PagedSecRelease'

export type OfficialEventDoc = {title:string;url:string;format:string}
export const matchingEvent = (event:CompanyEvent, date:string|null, title:string) => {
  if(date && Number.isFinite(Date.parse(date)) && Math.abs(Date.parse(date)-Date.parse(event.date))<10*86400000) return true
  const q=event.call
  return !!q && new RegExp(`(?:fy|year)[^\\d]*${q.year}[^\\d]*q${q.quarter}|(?:q|quarter)[^\\d]*${q.quarter}[^\\d]*${q.year}`,'i').test(title.replace(/fourth/ig,'q4').replace(/third/ig,'q3'))
}
export function useOfficialEventDocuments(event:CompanyEvent) {
  const co=companyById(event.companyId)
  const source=useIrSource(co.cik??0,[co.ticker])
  const url=source?.url ?? (co.ticker.toUpperCase()==='MSFT'?'https://www.microsoft.com/en-us/investor/events/default':'')
  const [docs,setDocs]=useState<IrDoc[]>([])
  const [pending,setPending]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{
    if(!url){setDocs([]);setPending(false);return}
    let alive=true
    setPending(true);setError('')
    loadIrSite(url).then(site=>{
      if(!alive)return
      const found=site.events.filter(e=>e.type==='earnings'&&matchingEvent(event,e.date,e.title))
      const unique=new Map<string,IrDoc>()
      for(const item of found)for(const doc of item.documents)unique.set(doc.url,doc)
      setDocs([...unique.values()])
    }).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Investor relations source unavailable')}).finally(()=>{if(alive)setPending(false)})
    return()=>{alive=false}
  },[url,event.id,event.date,event.call?.year,event.call?.quarter])
  return {docs,pending,error}
}
export function OfficialEventRelease({event,fallback}:{event:CompanyEvent;fallback:React.ReactNode}) {
  const {docs,pending,error}=useOfficialEventDocuments(event)
  const release=docs.find(d=>d.kind==='press-release'&&d.format==='html')
  if(release)return <div className="sbw-official-report">
    <div className="sbw-official-report-bar"><FileText size={13}/><span>Original company earnings release</span><span className="grow"/><a href={release.url} target="_blank" rel="noreferrer">Company source <ExternalLink size={12}/></a></div>
    <PagedSecRelease key={release.url} url={release.url} title={release.title||event.title} official/>
  </div>
  if(pending)return <div className="ep-scroll"><div className="empty">Locating the company’s original earnings release…</div></div>
  return <div className="sbw-official-report">{error&&<div className="sbw-report-fallback">Company investor-relations release unavailable. Showing the SEC filing.</div>}{fallback}</div>
}
