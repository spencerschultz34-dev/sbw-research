// On-demand, source-grounded earnings overview through Vercel AI Gateway.
// Generates only after the user opens an eligible historical event; cached at the edge.
export const config={runtime:'edge'}
type Source={id:string;type:'transcript'|'report'|'slides';text:string}
type Section={heading:string;bullets:{text:string;cites:{tab:'transcript'|'report'|'slides';ref:string}[]}[]}
const cache=new Map<string,{value:{headline:string;sections:Section[];sources:string[]};until:number}>()
const rate=new Map<string,number>()
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})
export default async function handler(req:Request):Promise<Response>{
  if(req.method!=='POST')return json({error:'POST required'},405)
  const secret=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN
  if(!secret)return json({error:'AI overview generation is not configured. Configure Vercel AI Gateway authentication.'},503)
  let payload:{company?:string;event?:string;sources?:Source[]}
  try{payload=await req.json()}catch{return json({error:'Invalid request'},400)}
  const items=Array.isArray(payload.sources)?payload.sources:[]
  if(!items.length||items.length>145)return json({error:'Source materials required'},400)
  const valid=items.filter(x=>x && ['transcript','report','slides'].includes(x.type)&&typeof x.id==='string'&&/^[\w:.\-]+$/.test(x.id)&&typeof x.text==='string'&&x.text.trim().length>25).slice(0,110).map(x=>({...x,text:x.text.slice(0,1250)}))
  if(valid.length<3)return json({error:'Not enough valid source material for a reliable AI overview'},422)
  const company=String(payload.company||'').slice(0,90),event=String(payload.event||'').slice(0,90)
  const cacheKey=`${company}:${event}:${valid.length}:${valid.map(x=>x.id).join('|').slice(0,450)}`
  const hit=cache.get(cacheKey)
  if(hit&&Date.now()<hit.until)return json({...hit.value,cached:true})
  const ip=(req.headers.get('x-forwarded-for')??'unknown').split(',')[0].trim().slice(0,70)
  const last=rate.get(ip)??0
  if(Date.now()-last<15000)return json({error:'An overview was just requested. Try again shortly.'},429)
  rate.set(ip,Date.now())
  const text=valid.map(x=>`[${x.type}:${x.id}] ${x.text}`).join('\n\n').slice(0,61000)
  const system=`You are an institutional equity research editor drafting an original, analytical earnings event overview in the style of a source-linked investor research platform. Do not quote Quartr or imitate proprietary prose. Use ONLY the supplied source evidence. Distinguish company-reported results from management commentary and analyst questions. Summarize precisely and synthetically, not by copying sentences. If a metric is absent do not invent it. Prefer material financial results, catalysts, guidance, risks and operational drivers over conference call introductions. Cite each factual bullet with one or two supplied IDs. Return STRICT JSON: {"headline":"specific factual takeaway under 120 chars","sections":[{"heading":"Executive summary","bullets":[{"text":"...", "cites":[{"tab":"transcript","ref":"original ID"}]}]},{"heading":"Financial highlights","bullets":[...]},{"heading":"Business drivers and outlook","bullets":[...]},{"heading":"Questions and answers","bullets":[...]}]}. Headline and bullets must be grounded. For report evidence tab is report, for slide evidence tab is slides and use the EXACT citation ref ID from input. Bullet prose should be 1-2 compact sentences. Section can have 0 bullets if not supported. 3-5 bullets per populated section. No markdown fencing.`
  try{
    const response=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{
      method:'POST',
      headers:{'authorization':`Bearer ${secret}`,'content-type':'application/json'},
      body:JSON.stringify({model:'openai/gpt-4.1-mini',temperature:0.2,max_tokens:2400,messages:[{role:'system',content:system},{role:'user',content:`Company: ${company}\nEvent: ${event}\nSources:\n${text}`}] }),
      signal:AbortSignal.timeout(45000)
    })
    if(!response.ok)return json({error:`AI Gateway returned ${response.status}. Check Gateway authorization and project credits.`},502)
    const body=await response.json() as {choices?:{message?:{content?:string}}[]}
    const content=body.choices?.[0]?.message?.content||''
    const parsed=JSON.parse(content.replace(/^\s*```(?:json)?|\s*```\s*$/g,'')) as {headline?:string;sections?:Section[]}
    const ids=new Map(valid.map(x=>[x.id,x.type]))
    const sections=(Array.isArray(parsed.sections)?parsed.sections:[]).slice(0,5).map(s=>({
      heading:String(s.heading||'').slice(0,90),
      bullets:(Array.isArray(s.bullets)?s.bullets:[]).slice(0,6).map(b=>({
        text:String(b.text||'').slice(0,650),
        cites:(Array.isArray(b.cites)?b.cites:[]).filter(c=>c && ids.get(c.ref)===c.tab).slice(0,3)
      })).filter(b=>b.text.length>15&&b.cites.length>0)
    })).filter(s=>s.bullets.length>0)
    if(!sections.length)return json({error:'The generated overview contained no verifiable source citations'},502)
    const value={headline:String(parsed.headline||`${company} ${event} results`).slice(0,125),sections,sources:[...new Set(valid.map(x=>x.type))]}
    if(cache.size>120)cache.clear()
    cache.set(cacheKey,{value,until:Date.now()+3600000})
    return json(value)
  }catch(e){return json({error:e instanceof Error?e.message:'Unable to generate AI overview'},502)}
}
