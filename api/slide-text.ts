import { inflateRawSync } from 'node:zlib'

/** Extract speaker slide text from the ORIGINAL Microsoft PowerPoint deck.
 * No approximated slide contents: references are indexed to slideN.xml. */
function pptxSlideText(input:Buffer) {
  const slides:{number:number;text:string}[]=[]
  // ZIP local file headers, iterated using local compressed sizes (Office PPTX).
  let at=0,processed=0
  const decode=(v:string)=>v.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  while(at+30<input.length && processed++<3000) {
    if(input.readUInt32LE(at)!==0x04034b50) break
    const flags=input.readUInt16LE(at+6),method=input.readUInt16LE(at+8),size=input.readUInt32LE(at+18),len=input.readUInt16LE(at+26),extra=input.readUInt16LE(at+28)
    const name=input.subarray(at+30,at+30+len).toString('utf8')
    const dataAt=at+30+len+extra
    if(flags&8)break // Office decks generally include sizes; unknown lengths cannot safely be scanned
    if(dataAt+size>input.length)break
    const match=/^ppt\/slides\/slide(\d+)\.xml$/i.exec(name)
    if(match && size<1500000) {
      try {
        const content=method===8?inflateRawSync(input.subarray(dataAt,dataAt+size)):input.subarray(dataAt,dataAt+size)
        const xml=content.toString('utf8')
        const snippets=[...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(x=>decode(x[1]).trim()).filter(Boolean)
        if(snippets.length)slides.push({number:Number(match[1]),text:snippets.join(' ').slice(0,3500)})
      } catch { /* corrupt individual slide, skip */ }
    }
    at=dataAt+size
  }
  return slides.sort((a,b)=>a.number-b.number).slice(0,120)
}
export default async function handler(req:Request) {
  if(req.method!=='GET')return new Response('Method not allowed',{status:405})
  let source:string
  try {
    const requested=new URL(req.url).searchParams.get('url')??''
    const wrapped=new URL(requested)
    const unwrapped=wrapped.hostname==='view.officeapps.live.com' ? wrapped.searchParams.get('src') : requested
    source=unwrapped??''
    const url=new URL(source)
    if(url.protocol!=='https:' || !/^(?:[a-z0-9-]+\.)*(?:microsoft\.com|microsoftcorp\.com)$/.test(url.hostname) && !/^cdn-dynmedia-\d+\.microsoft\.com$/.test(url.hostname))throw Error('Presentation source not permitted')
  } catch{return Response.json({error:'Invalid presentation URL'},{status:400})}
  try {
    const r=await fetch(source,{signal:AbortSignal.timeout(18000)})
    if(!r.ok)throw Error('Company slide deck could not be downloaded')
    const size=Number(r.headers.get('content-length')||0)
    if(size>15000000)return Response.json({error:'Presentation too large to index'},{status:413})
    const bytes=Buffer.from(await r.arrayBuffer())
    if(bytes.length>15000000)return Response.json({error:'Presentation too large to index'},{status:413})
    const slides=pptxSlideText(bytes)
    return Response.json({source,slides},{headers:{'cache-control':'public, s-maxage=86400, stale-while-revalidate=86400'}})
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to read slides'},{status:502})}
}
