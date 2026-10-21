import { useEffect, useState } from 'react'
import { FileText, ExternalLink } from 'lucide-react'
import { discoverIrUrl, loadIrSite, useIrSource, type IrDoc } from '../ir'
import { companyById } from '../data/companies'
import type { CompanyEvent } from '../data/types'
import { OriginalDocument } from './OriginalDocument'

export type OfficialEventDoc = {title:string;url:string;format:string}
export const matchingEvent = (event:CompanyEvent, date:string|null, title:string) => {
  if(date && Number.isFinite(Date.parse(date)) && Math.abs(Date.parse(date)-Date.parse(event.date))<10*86400000) return true
  const q=event.call
  return !!q && new RegExp(`(?:fy|year)[^\\d]*${q.year}[^\\d]*q${q.quarter}|(?:q|quarter)[^\\d]*${q.quarter}[^\\d]*${q.year}`,'i').test(title.replace(/fourth/ig,'q4').replace(/third/ig,'q3'))
}
export function useOfficialEventDocuments(event:CompanyEvent) {
  const co=companyById(event.companyId)
  const source=useIrSource(co.cik??0,[co.ticker])
  const configuredUrl=source?.url ?? (co.ticker.toUpperCase()==='MSFT'?'https://www.microsoft.com/en-us/investor/events/default':'')
  const website=co.website
  const [docs,setDocs]=useState<IrDoc[]>([])
  const [pending,setPending]=useState(Boolean(configuredUrl || website))
  const [error,setError]=useState('')
  useEffect(()=>{
    if(!configuredUrl && !website){setDocs([]);setPending(false);return}
    let alive=true
    setDocs([])
    setPending(true);setError('')
    const resolved = configuredUrl ? Promise.resolve(configuredUrl) : discoverIrUrl(website!).then(x=>x.url)
    resolved.then(url=>{
      if(!url)throw Error('Company investor-relations documents are not indexed yet')
      return loadIrSite(url)
    }).then(site=>{
      if(!alive)return
      const found=site.events.filter(e=>e.type==='earnings'&&matchingEvent(event,e.date,e.title))
      const unique=new Map<string,IrDoc>()
      for(const item of found)for(const doc of item.documents)unique.set(doc.url,doc)
      setDocs([...unique.values()])
    }).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Investor relations source unavailable')}).finally(()=>{if(alive)setPending(false)})
    return()=>{alive=false}
  },[configuredUrl,website,event.id,event.date,event.call?.year,event.call?.quarter])
  return {docs,pending,error}
}
export function OfficialEventRelease({event,fallback}:{event:CompanyEvent;fallback:React.ReactNode}) {
  const {docs,pending,error}=useOfficialEventDocuments(event)
  const release=docs.find(d=>d.kind==='press-release'&&d.format==='pdf') ?? docs.find(d=>d.kind==='press-release')
  if(release)return <OriginalDocument url={release.url} title={release.title||event.title} format={release.format} kind="press-release" />
  if(pending)return <div className="ep-scroll"><div className="empty">Locating the company’s original earnings release…</div></div>
  return <div className="sbw-official-report">{error&&<div className="sbw-report-fallback">Company investor-relations release unavailable. Showing the SEC filing.</div>}{fallback}</div>
}
