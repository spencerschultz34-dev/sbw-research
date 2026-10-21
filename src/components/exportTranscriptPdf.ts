import type { CompanyEvent, Paragraph, Transcript } from '../data/types'
import { companyById } from '../data/companies'
import { fmtStamp } from '../format'

/** In-browser, direct PDF download. The source transcript remains unchanged.
 * A self-contained PDF writer avoids print dialogs, remote services and blank app pages.
 * Letter-size pages, running SBW masthead, legible speech, running page numbers.
 */
const W=612,H=792, LEFT=57, RIGHT=555, TOP=102, BOTTOM=62
type Line={text:string;x:number;y:number;font:'F1'|'F2';size:number;color:string}
type Page={commands:string[];y:number}
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')
const ascii=(s:string)=>s.normalize('NFKD').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\u2026/g,'...').replace(/[^\x20-\x7e]/g,'?')
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v.toFixed(3)).join(' ')
function wrap(text:string,maxWidth:number,size:number,font:'F1'|'F2'='F1'){
  const words=ascii(text).split(/\s+/).filter(Boolean)
  const lines:string[]=[];let line=''
  const measure=(s:string)=>s.split('').reduce((n,c)=>n+(c===' '?0.28:'il.,:;!|\'\`'.includes(c)?0.26:'MW@#%'.includes(c)?0.85:font==='F2'?0.59:0.52),0)*size
  for(const word of words){
    const candidate=line?line+' '+word:word
    if(measure(candidate)>maxWidth && line){lines.push(line);line=word}
    else line=candidate
  }
  if(line)lines.push(line)
  return lines.length?lines:['']
}
function textCmd(s:string,x:number,y:number,size:number,font:'F1'|'F2',color:string){
  return `BT /${font} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(ascii(s))}) Tj ET`
}
function lineCmd(x1:number,y1:number,x2:number,y2:number,color:string,weight=1){
  return `${rgb(color)} RG ${weight} w ${x1} ${y1} m ${x2} ${y2} l S`
}
function rectCmd(x:number,y:number,w:number,h:number,color:string){
  return `${rgb(color)} rg ${x} ${y} ${w} ${h} re f`
}
function buildPages(ev:CompanyEvent,t:Transcript):Page[]{
  const company=companyById(ev.companyId)
  const pages:Page[]=[]
  const newPage=()=>{
    const p:Page={commands:[],y:H-TOP}
    p.commands.push(textCmd('SBW',LEFT,H-45,17,'F2','#a39456'))
    p.commands.push(textCmd('RESEARCH',LEFT+47,H-44,10,'F2','#22282c'))
    p.commands.push(textCmd('SCHAPER, BENZ & WISE  /  INVESTMENT RESEARCH',LEFT,H-60,7.5,'F1','#657076'))
    p.commands.push(lineCmd(LEFT,H-72,RIGHT,H-72,'#b5aaa0',.75))
    pages.push(p);return p
  }
  let p=newPage()
  const ensure=(height:number)=>{if(p.y-height<BOTTOM)p=newPage()}
  const write=(value:string,opts:{size?:number;bold?:boolean;color?:string;indent?:number;leading?:number;before?:number;after?:number}={})=>{
    const size=opts.size??10.2,font=opts.bold?'F2':'F1',leading=opts.leading??15.1,indent=opts.indent??0,before=opts.before??0,after=opts.after??0
    const lines=wrap(value,RIGHT-LEFT-indent,size,font)
    ensure(before+lines.length*leading+after)
    p.y-=before
    for(const ln of lines){p.commands.push(textCmd(ln,LEFT+indent,p.y,size,font,opts.color??'#2a2f33'));p.y-=leading}
    p.y-=after
  }
  write(company.name+'  |  '+company.ticker,{size:18,bold:true,color:'#18232a',leading:24,before:17,after:1})
  write(ev.title+'  /  EARNINGS CALL TRANSCRIPT',{size:10.4,bold:true,color:'#515b61',leading:17,after:4})
  write(new Date(ev.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})+'   -   '+(t.source||'Source audio transcript'),{size:9,color:'#697279',after:16})
  p.commands.push(lineCmd(LEFT,p.y,RIGHT,p.y,'#d8dddf',.6));p.y-=19
  write('TRANSCRIPT',{size:11.2,bold:true,color:'#263037',after:14})
  let prevSpeaker=-1
  for(let ix=0;ix<t.paragraphs.length;ix++){
    const turn=t.paragraphs[ix],sp=t.speakers[turn.speaker]??{name:'Unidentified speaker',role:''}
    if(turn.id===t.paragraphs.find(x=>x.start===t.qnaStart)?.id && t.qnaStart>0)write('QUESTIONS & ANSWERS',{size:11,bold:true,before:17,after:11,color:'#273a46'})
    const chunks=splitThoughts(turn)
    for(let i=0;i<chunks.length;i++){
      const chunk=chunks[i]
      const showHeading=i===0 || turn.speaker!==prevSpeaker
      // Keep a speaker heading with a minimum of the following paragraph.
      ensure(showHeading?63:40)
      if(showHeading){
        p.commands.push(rectCmd(LEFT,p.y-3,3,18,'#ab9b57'))
        write(sp.name+'  /  '+fmtStamp(chunk.start),{size:10.4,bold:true,color:'#202a31',indent:12,leading:15,after:sp.role?0:8})
        if(sp.role)write(sp.role,{size:8.3,color:'#6b757c',indent:12,leading:12,after:8})
      }else p.y-=6
      write(chunk.text,{size:10.3,leading:15.1,after:12})
      prevSpeaker=turn.speaker
    }
  }
  pages.forEach((page,i)=>{
    page.commands.push(lineCmd(LEFT,45,RIGHT,45,'#d3d8da',.6))
    page.commands.push(textCmd('SBW RESEARCH  /  For investment research use',LEFT,31,7.6,'F1','#71797e'))
    page.commands.push(textCmd('Page '+(i+1)+' of '+pages.length,RIGHT-76,31,8,'F1','#71797e'))
  })
  return pages
}
function splitThoughts(p:Paragraph):{start:number;text:string}[]{
  // PDF uses the same natural thought division as the live reader.
  const list=p.sents?.length?p.sents:[{t:p.start,text:p.text}]
  const result:{start:number;text:string}[]=[]
  let buf:typeof list=[],chars=0
  const transition=/^(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|next|finally|turning (?:to|back)|moving (?:to|on)|on the (?:other|second|product|commercial|consumer)|as for|in terms of|with regard to|another (?:point|thing|area|way)|let me (?:start|talk|shift)|the (?:second|third|next) (?:thing|piece|point)|now,? (?:on|if|turning|let's)|to your (?:first|second|question)|from a (?:financial|product|customer)|so,? (?:first|second|third))\b/i
  const flush=()=>{if(buf.length){result.push({start:buf[0].t??p.start,text:buf.map(s=>s.text.trim()).join(' ')});buf=[];chars=0}}
  for(const sentence of list){
    const clean=sentence.text.trim()
    const newIdea=transition.test(clean)
    if(buf.length && ((newIdea&&chars>=160)|| (chars>1200&&/[.!?]$/.test(buf[buf.length-1].text.trim()))))flush()
    buf.push(sentence);chars+=clean.length+1
  }
  flush();return result.length?result:[{start:p.start,text:p.text}]
}
function makePdf(pages:Page[]):Uint8Array{
  // Helvetica fonts are universally available PDF base-14 fonts.
  const objects:string[]=[]
  const put=(v:string)=>{objects.push(v);return objects.length}
  const root=put(''),tree=put(''),regular=put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),bold=put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
  const ids:number[]=[]
  for(const page of pages){
    const cmds=page.commands.join('\n')+'\n'
    const stream=put(`<< /Length ${new TextEncoder().encode(cmds).length} >>\nstream\n${cmds}endstream`)
    ids.push(put(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R >>`))
  }
  objects[root-1]=`<< /Type /Catalog /Pages ${tree} 0 R >>`
  objects[tree-1]=`<< /Type /Pages /Kids [${ids.map(id=>id+' 0 R').join(' ')}] /Count ${ids.length} >>`
  const enc=new TextEncoder()
  const chunks:Uint8Array[]=[]
  let offset=0
  const add=(s:string)=>{const bytes=enc.encode(s);chunks.push(bytes);offset+=bytes.length}
  add('%PDF-1.4\n%SBW Research\n')
  const offsets=[0]
  objects.forEach((obj,i)=>{offsets.push(offset);add(`${i+1} 0 obj\n${obj}\nendobj\n`)})
  const xref=offset
  add(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`)
  offsets.slice(1).forEach(n=>add(String(n).padStart(10,'0')+' 00000 n \n'))
  add(`trailer\n<< /Size ${objects.length+1} /Root ${root} 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  const bytes=new Uint8Array(offset);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length}
  return bytes
}
export function downloadTranscriptPdf(ev:CompanyEvent,t:Transcript){
  const pages=buildPages(ev,t)
  const bytes=makePdf(pages)
  const blob=new Blob([bytes as BlobPart],{type:'application/pdf'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url;a.download=`SBW_Research_${companyById(ev.companyId).ticker}_${ev.title.replace(/[^a-z0-9]+/gi,'_')}_Transcript.pdf`
  document.body.appendChild(a);a.click();a.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),30000)
}
