import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ExternalLink, Minus, Plus, PanelLeftClose, Presentation, RefreshCw } from 'lucide-react'
import type { CompanyEvent } from '../data/types'
import { useIrSource, loadIrSite, irPdfUrl, officeViewer, type IrDoc } from '../ir'
import { companyById } from '../data/companies'

type Source = { title: string; url: string; format: string; provenance: string }
function dateNear(a: string|null,b:string){return !!a && Number.isFinite(Date.parse(a)) && Math.abs(Date.parse(a)-Date.parse(b)) < 10*86400000}

/** Display the real presentation documents, never generated placeholder slides. */
export function SourceSlidesView({ev}:{ev:CompanyEvent}) {
  const c=companyById(ev.companyId)
  const configuredIr=useIrSource(c.cik??0,[c.ticker])
  const irUrl=configuredIr?.url ?? (c.ticker.toUpperCase()==='MSFT'?'https://www.microsoft.com/en-us/investor/events/default':undefined)
  const [irSlides,setIrSlides]=useState<Source[]>([])
  const [loading,setLoading]=useState(false)
  const [irError,setIrError]=useState('')
  const secSlides=useMemo(()=>ev.reports.filter(r=>r.kind==='Slides' && !!r.url).map(r=>({title:r.title,url:r.url!,format:/\.pdf(?:[?#]|$)/i.test(r.url!)?'pdf':/\.pptx?(?:[?#]|$)/i.test(r.url!)?'pptx':'html',provenance:'SEC exhibit'})),[ev.reports])
  useEffect(()=>{
    if(!irUrl){setIrSlides([]);setLoading(false);return}
    let active=true
    setLoading(true);setIrError('')
    loadIrSite(irUrl).then(site=>{
      if(!active)return
      const related=site.events.filter(item=>dateNear(item.date,ev.date)||(!item.date&&item.title.toLowerCase().includes(ev.title.toLowerCase())))
      const docs=related.flatMap(item=>item.documents).filter((d:IrDoc)=>d.kind==='slides'||(d.format==='pdf' && /presentation|slide|supplemental/i.test(d.title)))
      const dedup=new Map<string,Source>()
      for(const d of docs)dedup.set(d.url,{title:d.title,url:d.url,format:d.format,provenance:'Investor relations'})
      setIrSlides([...dedup.values()])
    }).catch(err=>{if(active)setIrError(err instanceof Error?err.message:'IR presentations unavailable')}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[irUrl,ev.date,ev.title])
  const sources=useMemo(()=>{const all=new Map<string,Source>();for(const item of [...secSlides,...irSlides])all.set(item.url,item);return [...all.values()]},[secSlides,irSlides])
  const [index,setIndex]=useState(0)
  const [page,setPage]=useState(1)
  const [zoom,setZoom]=useState(1)
  const [rail,setRail]=useState(true)
  useEffect(()=>{setIndex(0);setPage(1)},[ev.id])
  const source=sources[Math.min(index,Math.max(0,sources.length-1))]
  const original = source?.url ?? ''
  const officeSource = original.match(/[?&]src=([^&]+)/i)?.[1]
  const pptUrl = officeSource ? decodeURIComponent(officeSource) : original
  const viewUrl=source ? source.format==='pdf'?(source.provenance==='Investor relations'?irPdfUrl(source.url):source.url)+`#page=${page}&zoom=${Math.round(zoom*100)}`:source.format==='pptx'?officeViewer(pptUrl):source.url : ''
  const [reload,setReload]=useState(0)
  return <div className="doc-view sbw-source-slide-reader">
    <div className="doc-toolbar">
      <button className={`ghost-icon${rail?' on':''}`} onClick={()=>setRail(x=>!x)} title="Toggle presentation list"><PanelLeftClose size={15}/></button>
      <button className="ghost-icon" disabled={!source} onClick={()=>source&&window.open(source.url,'_blank','noopener,noreferrer')} title="Open original presentation"><Download size={15}/></button>
      <span className="tb-sep"/>
      <button className="ghost-icon" disabled={!source || page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} title="Previous PDF page"><ChevronLeft size={15}/></button>
      <span className="mono pager">{source?.format==='pdf'?`Page ${page}`:'Presentation'}</span>
      <button className="ghost-icon" disabled={!source || source.format!=='pdf'} onClick={()=>setPage(p=>p+1)} title="Next PDF page"><ChevronRight size={15}/></button>
      <span className="tb-sep"/>
      <button className="ghost-icon" disabled={!source || source.format!=='pdf'} onClick={()=>setZoom(z=>Math.max(.6,+(z-.1).toFixed(2)))}><Minus size={14}/></button>
      <span className="pager">{zoom===1?'Auto':Math.round(zoom*100)+'%'}</span>
      <button className="ghost-icon" disabled={!source || source.format!=='pdf'} onClick={()=>setZoom(z=>Math.min(1.8,+(z+.1).toFixed(2)))}><Plus size={14}/></button>
      <span className="grow"/>
      {source&&<a className="text-btn" href={source.url} target="_blank" rel="noreferrer">Open original <ExternalLink size={13}/></a>}
    </div>
    <div className="sbw-source-slide-layout">
      {rail && <aside className="sbw-slide-source-rail">
        <div className="sbw-original-doc-list-title">Presentations</div>
        {sources.map((src,i)=><button key={src.url} className={`sbw-slide-source-item${index===i?' on':''}`} onClick={()=>{setIndex(i);setPage(1);setReload(r=>r+1)}}>
          <span className="sbw-slide-source-icon"><Presentation size={24}/><small>{i+1}</small></span>
          <span className="sbw-slide-source-caption">{src.title}<small>{src.provenance}</small></span>
        </button>)}
      </aside>}
      <main className="sbw-source-slide-main">
        {source?<iframe key={viewUrl+reload} title={source.title} className="sbw-slide-original-frame" src={viewUrl} allowFullScreen/>:<div className="sbw-slide-not-available">
          <Presentation size={34}/>
          <h3>No published presentation found</h3>
          <p>{loading?'Checking Microsoft investor relations for this call…':'There is no presentation attached to this event in the indexed SEC exhibits or matching investor-relations materials.'}</p>
          {irError&&<p className="muted small">Investor-relations retrieval: {irError}</p>}
          <p className="muted small">The Transcript and Report tabs contain the source materials currently available.</p>
        </div>}
      </main>
    </div>
  </div>
}
