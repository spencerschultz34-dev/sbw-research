import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ExternalLink, Minus, Plus, Search, X, PanelLeftClose } from 'lucide-react'

type Block = { kind: 'heading' | 'text' | 'table'; text: string; rows?: string[][] }
type Page = Block[]
const clean = (s: string) => s.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()

/** Reflow SEC HTML exhibits into independent letter-size pages. Source remains available unchanged. */
function extract(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html,'text/html')
  doc.querySelectorAll('script,style,noscript,form,iframe,svg,nav,footer').forEach(el=>el.remove())
  const found: Block[] = []
  function visit(el: Element) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('th,td')).map(td=>clean(td.textContent||''))).filter(r=>r.some(Boolean))
      if (rows.length) found.push({kind:'table', text:rows.map(r=>r.join(' | ')).join(' '),rows})
      return
    }
    if (/^h[1-6]$/.test(tag)) {const t=clean(el.textContent||'');if(t)found.push({kind:'heading',text:t});return}
    if (['p','li','blockquote'].includes(tag)) {
      // Some filings nest layout tables; preserve them instead of flattening their financial data.
      if(el.querySelector('table')){Array.from(el.children).forEach(visit);return}
      const t=clean(el.textContent||'')
      if(t)found.push({kind:'text',text:t})
      return
    }
    const kids = Array.from(el.children)
    if(kids.length)kids.forEach(visit)
    else if(tag==='div' || tag==='span'){const t=clean(el.textContent||'');if(t.length>32)found.push({kind:'text',text:t})}
  }
  visit(doc.body)
  const unique: Block[]=[]
  for(const b of found)if(b.text!==unique[unique.length-1]?.text)unique.push(b)
  return unique
}
function paginate(blocks:Block[]):Page[] {
  const pages:Page[]=[]
  let page:Page=[],weight=0
  const push=()=>{if(page.length){pages.push(page);page=[];weight=0}}
  for(const block of blocks) {
    if(block.kind==='table' && block.rows?.length) {
      const rows = block.rows
      const head=rows.slice(0,1)
      let chunk:string[][]=[]
      let cost=0
      for(const row of rows) {
        const rowCost=Math.max(34,Math.ceil(row.join(' ').length / 92)*21+18)
        if(chunk.length && (cost+rowCost>570 || weight+cost+rowCost>680)) {
          if(weight+cost>690)push()
          page.push({kind:'table',text:chunk.flat().join(' '),rows:[...head.filter(()=>chunk[0]!==head[0]),...chunk]})
          weight+=cost;chunk=[];cost=0
          if(weight>560)push()
        }
        chunk.push(row);cost+=rowCost
      }
      if(chunk.length){if(weight+cost>680)push();page.push({kind:'table',text:chunk.flat().join(' '),rows:chunk});weight+=cost}
      continue
    }
    const words=block.text.split(' ')
    const segments:string[]=[]
    // Each long paragraph remains readable and can flow across pages.
    let segment=''
    for(const word of words){if(segment.length+word.length>970 && segment){segments.push(segment);segment=''}segment+=(segment?' ':'')+word}
    if(segment)segments.push(segment)
    for(const txt of segments){
      const b={...block,text:txt}
      const estimated=block.kind==='heading'?60:Math.max(34,Math.ceil(txt.length/85)*20+13)
      if(page.length && weight+estimated>690)push()
      page.push(b);weight+=estimated
    }
  }
  push()
  return pages
}

/** True page navigation for SEC HTML releases instead of a continuous iframe. */
export function PagedSecRelease({url,title}:{url:string;title:string}) {
  const [blocks,setBlocks]=useState<Block[]|null>(null)
  const [error,setError]=useState('')
  const [page,setPage]=useState(0)
  const [zoom,setZoom]=useState(1)
  const [thumbs,setThumbs]=useState(true)
  const [query,setQuery]=useState('')
  const pages=useMemo(()=>paginate(blocks??[]),[blocks])
  useEffect(()=>{
    let active=true
    setBlocks(null);setError('');setPage(0)
    fetch(url).then(async r=>{
      if(!r.ok)throw Error('SEC document could not be retrieved')
      const ct=r.headers.get('content-type')||''
      if(/pdf/i.test(ct))throw Error('This filing is a PDF. Open the original document.')
      return r.text()
    }).then(html=>{if(active){const b=extract(html);if(!b.length)throw Error('No readable document text was found');setBlocks(b)}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not read the release')})
    return()=>{active=false}
  },[url])
  const hitPages=useMemo(()=>query.trim()?pages.map((items,i)=>items.some(b=>b.text.toLowerCase().includes(query.trim().toLowerCase()))?i:-1).filter(i=>i>=0):[],[pages,query])
  const goto=(i:number)=>setPage(Math.min(Math.max(i,0),Math.max(0,pages.length-1)))
  const highlight=(text:string)=>{
    const q=query.trim();if(!q)return text
    const at=text.toLowerCase().indexOf(q.toLowerCase())
    return at<0?text:<>{text.slice(0,at)}<mark>{text.slice(at,at+q.length)}</mark>{text.slice(at+q.length)}</>
  }
  return <div className="sbw-paged-document">
    <div className="doc-toolbar sbw-paged-toolbar">
      <button className={`ghost-icon${thumbs?' on':''}`} onClick={()=>setThumbs(!thumbs)} title="Toggle page thumbnails"><PanelLeftClose size={15}/></button>
      <a className="ghost-icon" href={url} target="_blank" rel="noreferrer" title="Open or download original"><Download size={15}/></a>
      <span className="tb-sep"/>
      <button className="ghost-icon" disabled={page===0} onClick={()=>goto(page-1)} aria-label="Previous page"><ChevronLeft size={15}/></button>
      <span className="mono pager">{pages.length?`${page+1} of ${pages.length}`:'— of —'}</span>
      <button className="ghost-icon" disabled={page>=pages.length-1} onClick={()=>goto(page+1)} aria-label="Next page"><ChevronRight size={15}/></button>
      <span className="tb-sep"/>
      <button className="ghost-icon" onClick={()=>setZoom(z=>Math.max(.75,+(z-.1).toFixed(2)))} title="Zoom out"><Minus size={14}/></button>
      <span className="pager">{zoom===1?'Auto':Math.round(zoom*100)+'%'}</span>
      <button className="ghost-icon" onClick={()=>setZoom(z=>Math.min(1.4,+(z+.1).toFixed(2)))} title="Zoom in"><Plus size={14}/></button>
      <span className="grow"/>
      <div className="sbw-paged-find"><Search size={13}/><input aria-label="Find in document" placeholder="Find" value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value){const q=e.target.value.toLowerCase();const idx=pages.findIndex(p=>p.some(b=>b.text.toLowerCase().includes(q)));if(idx>=0)setPage(idx)}}}/>{query&&<><small>{hitPages.length} pages</small><button onClick={()=>setQuery('')}><X size={13}/></button></>}</div>
      <a className="ghost-icon" href={url} target="_blank" rel="noreferrer" title="Open SEC original"><ExternalLink size={15}/></a>
    </div>
    <div className="sbw-paged-layout">
      {thumbs && <aside className="sbw-paged-thumbnails" aria-label="Release pages">{pages.map((p,i)=><button key={i} className={`sbw-paged-thumb${page===i?' current':''}`} onClick={()=>goto(i)}><div className="sbw-thumb-paper">{p.slice(0,9).map((b,j)=><div key={j} className={b.kind==='heading'?'line hd':'line'} style={{width:`${Math.min(96,Math.max(28,b.text.length/3))}%`}}/>)}</div><span>{i+1}</span></button>)}</aside>}
      <div className="sbw-paged-canvas">
        {error?<div className="sbw-doc-message">{error}. <a href={url} target="_blank" rel="noreferrer">Open the original filing <ExternalLink size={12}/></a></div>:!blocks?<div className="sbw-doc-message">Loading original SEC press release…</div>:pages.length===0?<div className="sbw-doc-message">No content available.</div>:
        <article className="sbw-document-paper" style={{transform:`scale(${zoom})`,transformOrigin:'top center'}} aria-label={`${title} page ${page+1}`}>
          <header className="sbw-document-paper-header"><small>SEC EDGAR · Original filing content</small><span>{page+1} / {pages.length}</span></header>
          {pages[page].map((b,i)=>b.kind==='table'?<div className="sbw-paper-table-scroll" key={i}><table><tbody>{b.rows?.map((row,j)=><tr key={j}>{row.map((v,k)=><td key={k}>{highlight(v)}</td>)}</tr>)}</tbody></table></div>:b.kind==='heading'?<h2 key={i}>{highlight(b.text)}</h2>:<p key={i}>{highlight(b.text)}</p>)}
          <footer className="sbw-document-paper-footer">{title} · Page {page+1}</footer>
        </article>}
      </div>
    </div>
  </div>
}
