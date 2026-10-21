import { useMemo, useState } from 'react'
import { Presentation, ExternalLink } from 'lucide-react'
import type { CompanyEvent } from '../data/types'
import { OriginalDocument } from './OriginalDocument'
import { useOfficialEventDocuments } from './OfficialEventRelease'

/** One source-document view across the company universe.  No synthetic slide
 * thumbnails: native PDF/Office rendering keeps the publisher's actual design. */
export function SourceSlidesView({ev}:{ev:CompanyEvent}) {
  const {docs,pending,error}=useOfficialEventDocuments(ev)
  const sources=useMemo(()=>{
    const found=new Map<string,{url:string;title:string;format:string;provenance:string}>()
    for(const d of docs.filter(x=>x.kind==='slides'||(x.format==='pdf'&&/slide|presentation|supplement/i.test(x.title))))
      found.set(d.url,{url:d.url,title:d.title,format:d.format,provenance:'Investor relations'})
    for(const d of ev.reports.filter(x=>x.kind==='Slides'&&x.url))
      if(!found.has(d.url!))found.set(d.url!,{url:d.url!,title:d.title,format:/\.pdf(?:[?#]|$)/i.test(d.url!)?'pdf':/\.pptx?(?:[?#]|$)/i.test(d.url!)?'pptx':'html',provenance:'SEC exhibit'})
    return [...found.values()]
  },[docs,ev.reports])
  const [chosen,setChosen]=useState<string|null>(null)
  const source=sources.find(s=>s.url===chosen)??sources[0]
  if(pending&&!sources.length)return <div className="ep-scroll"><div className="empty">Looking up official presentation documents…</div></div>
  if(!source)return <div className="ep-scroll"><div className="empty"><Presentation size={24}/><p>No original presentation document has been indexed for this earnings event.</p>{error&&<small>{error}</small>}</div></div>
  return <div className="sbw-publisher-document-layout">
    {sources.length>1&&<nav className="sbw-publisher-source-tabs" aria-label="Presentation sources">
      {sources.map((item,i)=><button key={item.url} className={source.url===item.url?'active':''} onClick={()=>setChosen(item.url)}>
        <Presentation size={14}/><span>{item.title||`Presentation ${i+1}`}</span><small>{item.provenance}</small></button>)}
    </nav>}
    <OriginalDocument key={source.url} url={source.url} title={source.title||'Original company presentation'} format={source.format} kind="slides"/>
  </div>
}
