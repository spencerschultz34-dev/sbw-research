import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, AlertCircle, FileText, Presentation, MessageSquareText, ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import type { CompanyEvent, SummarySection } from '../data/types'
import { companyById } from '../data/companies'
import { ensureTranscript } from '../data'
import { loadIrArticle } from '../ir'
import { useOfficialEventDocuments } from './OfficialEventRelease'
type Summary={headline:string;sections:SummarySection[];sources:string[]}
const memo=new Map<string,Summary>()
export function GeneratedEventOverview({event}:{event:CompanyEvent}) {
  const {openEvent}=useStore()
  const {docs,pending}=useOfficialEventDocuments(event)
  const [overview,setOverview]=useState<Summary|null>(()=>memo.get(event.id)??null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{setOverview(memo.get(event.id)??null);setError('')},[event.id])
  useEffect(()=>{
    if(pending||overview||busy)return
    let active=true
    const generate=async()=>{
      setBusy(true);setError('')
      try {
        if(!event.transcript && event.call)await ensureTranscript(event.id)
        const input:{id:string;type:'transcript'|'report'|'slides';text:string}[]=[]
        const t=event.transcript
        if(t){
          const paragraphs=t.paragraphs.filter(p=>p.text.length>55 && !t.speakers[p.speaker]?.isOperator)
          for(const p of paragraphs.slice(0,62))input.push({id:p.id,type:'transcript',text:`${t.speakers[p.speaker]?.name||'Speaker'}: ${p.text}`.slice(0,1100)})
        }
        const official=docs.find(d=>d.kind==='press-release'&&d.format==='html')
        if(official){
          const article=await loadIrArticle(official.url)
          const parsed=new DOMParser().parseFromString(article.html,'text/html')
          const chunks=Array.from(parsed.querySelectorAll('h1,h2,h3,p,li,tr')).map(e=>(e.textContent||'').replace(/\s+/g,' ').trim()).filter(x=>x.length>35)
          for(let i=0;i<Math.min(35,chunks.length);i++)input.push({id:`report:${i+1}`,type:'report',text:chunks[i].slice(0,1100)})
        }
        const deck=docs.find(d=>d.kind==='slides'&&d.format==='pptx')
        if(deck){
          try{
            const r=await fetch(`/api/slide-text?url=${encodeURIComponent(deck.url)}`)
            if(r.ok){
              const slides=await r.json() as {slides:{number:number;text:string}[]}
              for(const p of slides.slides.slice(0,30))if(p.text.length>25)input.push({id:`slide:${p.number}`,type:'slides',text:p.text.slice(0,1100)})
            }
          }catch{/* deck remains viewable even when extraction fails */}
        }
        if(!input.length)throw Error('No source transcript or official investor-relations materials are available yet.')
        const resp=await fetch('/api/overview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({company:companyById(event.companyId).name,event:event.title,sources:input})})
        const body=await resp.json() as Summary&{error?:string}
        if(!resp.ok)throw Error(body.error||'Could not generate the research overview.')
        if(active){memo.set(event.id,body);setOverview(body)}
      }catch(e){if(active)setError(e instanceof Error?e.message:'Overview generation unavailable')}
      finally{if(active)setBusy(false)}
    }
    void generate()
    return()=>{active=false}
  },[event.id,event.transcript,docs,pending,attempt,overview])
  const sourceLabel=(id:string)=>id==='transcript'?'Call transcript':id==='report'?'Company press release':'Presentation slides'
  return <div className="sbw-generated-overview">
    {busy && !overview && <div className="sbw-ai-overview-status"><Sparkles size={16}/><div><strong>Preparing earnings overview</strong><p>Analyzing management commentary, the original release and published slide deck, with source citations.</p></div></div>}
    {!!error && !overview && <div className="sbw-ai-overview-status sbw-ai-overview-error"><AlertCircle size={16}/><div><strong>AI research overview unavailable</strong><p>{error}</p><button className="text-btn" onClick={()=>{setError('');setAttempt(n=>n+1)}}><RefreshCw size={13}/> Try again</button></div></div>}
    {overview && <>
      <div className="sbw-ai-label"><Sparkles size={13}/> AI-generated earnings analysis <span>·</span> {overview.sources.map(sourceLabel).join(' · ')}</div>
      <h1 className="sbw-ai-headline">{overview.headline}</h1>
      {overview.sections.map((section,i)=><section key={section.heading+'-'+i} className="sbw-ai-section"><h2>{section.heading}</h2><ul>
        {section.bullets.map((b,j)=><li key={j}>{b.text} {b.cites.map((c,k)=><button className="cite" key={k} title={`Open ${sourceLabel(c.tab)} source`} onClick={()=>openEvent(event.id,c.tab,c.ref)}>{k+1}</button>)}</li>)}
      </ul></section>)}
      <div className="sbw-ai-disclosure">AI-generated from the original source materials. Check citations against the call, company release and presentation before relying on specific conclusions.</div>
    </>}
    {!overview && !busy && !error && <p className="muted small">Preparing source documents…</p>}
    <div className="sbw-ai-source-actions">
      {event.call&&<button onClick={()=>openEvent(event.id,'transcript')}><MessageSquareText size={13}/> Transcript <ChevronRight size={13}/></button>}
      <button onClick={()=>openEvent(event.id,'report')}><FileText size={13}/> Release <ChevronRight size={13}/></button>
      <button onClick={()=>openEvent(event.id,'slides')}><Presentation size={13}/> Slides <ChevronRight size={13}/></button>
    </div>
  </div>
}
