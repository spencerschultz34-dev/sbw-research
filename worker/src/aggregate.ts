/**
 * Persistent, idempotent SBW earnings indexer.
 * Usage: node worker/src/aggregate.ts [--bootstrap] [--max 25] [--symbol MSFT]
 * Built for GitHub Actions; does NOT record audio or overwrite historical versions.
 * Supabase service-role credentials are server-only.
 */
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import irHandler, { periodOf, type IrSite, type IrEvent } from '../../api/ir.ts'

const DB = (process.env.SUPABASE_URL ?? '').replace(/\/$/,'')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const options = process.argv.slice(2)
const flag = (name:string) => options.includes('--'+name)
const arg = (name:string, fallback:string) => {const i=options.indexOf('--'+name);return i>=0?options[i+1]??fallback:fallback}
const SYMBOL = arg('symbol','').toUpperCase()
const MAX = Math.min(100,Math.max(1,Number(arg('max','25'))||25))
const hash = (data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex')
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms))
type Row = Record<string,unknown>
interface Company {id:string;ticker:string;name:string;cik?:number}
interface Target {id:string;company_id:string;source_url:string;consecutive_failures:number;poll_interval_minutes:number}
interface FeedCompany {symbol:string;name:string;ir:string;exchange?:string}
let processed=0,failures=0,eventsSeen=0,documentsSeen=0

async function db<T=Row[]>(table:string,query:string,opts:{method?:string;body?:unknown;prefer?:string}={}):Promise<T> {
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(DB)||!KEY)throw Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  const uri=DB+'/rest/v1/'+table+(query?'?'+query:'')
  for(let attempt=0;attempt<4;attempt++){
    const r=await fetch(uri,{method:opts.method??'GET',headers:{apikey:KEY,authorization:'Bearer '+KEY,'content-type':'application/json',...(opts.prefer?{prefer:opts.prefer}:{})},body:opts.body===undefined?undefined:JSON.stringify(opts.body),signal:AbortSignal.timeout(20000)})
    if(r.status===429||r.status>=500){if(attempt<3){await sleep(650*2**attempt);continue}}
    if(!r.ok)throw Error('Supabase '+table+' '+r.status+': '+(await r.text()).slice(0,220))
    return (r.status===204?[]:await r.json()) as T
  }
  throw Error('Supabase retry exhausted')
}
async function upsert<T extends Row>(table:string,conflict:string,payload:Row):Promise<T>{
  const rows=await db<T[]>(table,'on_conflict='+encodeURIComponent(conflict),{method:'POST',body:payload,prefer:'resolution=merge-duplicates,return=representation'})
  if(!rows.length)throw Error('No '+table+' row returned')
  return rows[0]
}
async function logItem(runId:string,companyId:string,url:string,status:'success'|'partial'|'error',ev:number,docs:number,error=''){
  await upsert('ingestion_run_items','run_id,company_id',{run_id:runId,company_id:companyId,source_url:url,status,events_seen:ev,documents_seen:docs,error_message:error||null,checked_at:new Date().toISOString()})
}
async function site(url:string):Promise<IrSite>{
  const r=await irHandler(new Request('https://worker.local/api/ir?type=site&url='+encodeURIComponent(url)))
  const body=await r.json() as IrSite & {error?:string}
  if(!r.ok)throw Error(body.error||'IR reader returned '+r.status)
  return body
}
function eventKey(e:IrEvent){
  const period=periodOf(e.title)
  if(period && e.type==='earnings')return {key:'FY'+period.y+'-Q'+period.q,year:period.y,quarter:period.q}
  // Unknown quarters get a stable source-event key, never an inferred fiscal quarter.
  const id=e.id.replace(/[^a-zA-Z0-9-]/g,'').slice(0,80)
  return {key:e.type+':'+id+(e.date?':'+e.date.slice(0,10):''),year:null,quarter:null}
}
function iso(date:string|null):string|null {
  if(!date||!Number.isFinite(Date.parse(date)))return null
  return new Date(date).toISOString()
}
async function ingest(company:Company,target:Target){
  const feed=await site(target.source_url)
  const events=feed.events.filter(e=>e.type==='earnings')
  let docs=0
  for(const e of events){
    const k=eventKey(e)
    const ev=await upsert<{id:string}>('research_events','company_id,event_key',{
      company_id:company.id,event_key:k.key,fiscal_year:k.year,fiscal_quarter:k.quarter,event_type:e.type,title:e.title,event_date:iso(e.date),
      event_page_url:e.page,updated_at:new Date().toISOString(),last_seen_at:new Date().toISOString()
    })
    const snapshot={title:e.title,date:e.date,type:e.type,page:e.page,documents:e.documents.map(d=>({kind:d.kind,title:d.title,url:d.url,format:d.format}))}
    await db('research_event_versions','on_conflict=event_id,source,fingerprint',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{
      event_id:ev.id,source:feed.platform,source_event_id:e.id,fingerprint:hash(snapshot),snapshot
    }})
    for(const d of e.documents){
      // Keep publisher links exactly as published; no fake PDF conversions.
      const doc=await upsert<{id:string}>('research_documents','event_id,kind,source_url',{
        event_id:ev.id,company_id:company.id,kind:d.kind,title:d.title,format:d.format,
        source_url:d.url,source_provider:feed.platform,last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()
      })
      // Source metadata is versioned. PDF bytes are NOT archived until permitted downloads are implemented.
      const fingerprint=hash({url:d.url,title:d.title,format:d.format})
      await db('research_document_versions','on_conflict=document_id,fingerprint',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{
        document_id:doc.id,fingerprint,source_url:d.url,metadata:{title:d.title,format:d.format,source:feed.platform}
      }})
      docs++
    }
  }
  return {events:events.length,docs}
}
async function bootstrap(){
  const configs=JSON.parse(await readFile(new URL('../companies.json',import.meta.url),'utf8')) as FeedCompany[]
  // HOOD is used as a second proof case; its IR endpoint uses a verified publisher-link fallback.
  if(!configs.some(c=>c.symbol==='HOOD'))configs.push({symbol:'HOOD',name:'Robinhood Markets',ir:'https://investors.robinhood.com/financials/quarterly-results'})
  for(const c of configs){
    if(SYMBOL&&c.symbol!==SYMBOL)continue
    const company=await upsert<{id:string}>('companies','ticker',{ticker:c.symbol,name:c.name,updated_at:new Date().toISOString()})
    await upsert('ingestion_targets','company_id,source_url',{
      company_id:company.id,source_url:c.ir,source_type:'investor_relations',enabled:true,
      poll_interval_minutes:360,priority:10
    })
    console.log('Target registered:',c.symbol,c.ir)
  }
}
async function main(){
  if(flag('bootstrap'))await bootstrap()
  const q='select=id,company_id,source_url,consecutive_failures,poll_interval_minutes&enabled=eq.true&next_check_at=lte.'+encodeURIComponent(new Date().toISOString())+'&order=priority.desc,next_check_at.asc&limit='+MAX
  let targets=await db<Target[]>('ingestion_targets',q)
  if(SYMBOL){const cs=await db<Company[]>('companies','ticker=eq.'+encodeURIComponent(SYMBOL)+'&select=id,ticker,name');targets=targets.filter(t=>cs.some(c=>c.id===t.company_id))}
  if(!targets.length){console.log('No ingestion targets due');return}
  const run=(await db<{id:string}[]>('ingestion_runs','',{method:'POST',prefer:'return=representation',body:{source:'company_ir',status:'started',details:{max:MAX,symbol:SYMBOL||null}}}))[0]
  if(!run?.id)throw Error('Could not start ingestion run')
  try{
    for(const t of targets){
      const now=new Date().toISOString()
      let company:Company|undefined
      try{
        company=(await db<Company[]>('companies','id=eq.'+t.company_id+'&select=id,ticker,name'))[0]
        if(!company)throw Error('Target company is missing')
        const r=await ingest(company,t)
        processed++;eventsSeen+=r.events;documentsSeen+=r.docs
        await logItem(run.id,company.id,t.source_url,'success',r.events,r.docs)
        // Frequent checks around expected announcements; fall back to 6 hours when quiet.
        const interval=Math.max(30,Math.min(360,t.poll_interval_minutes||360))
        await db('ingestion_targets','id=eq.'+t.id,{method:'PATCH',prefer:'return=minimal',body:{
          last_checked_at:now,last_success_at:now,last_error:null,consecutive_failures:0,
          next_check_at:new Date(Date.now()+interval*60000).toISOString(),updated_at:now
        }})
        console.log(company.ticker+': '+r.events+' events / '+r.docs+' source documents')
      }catch(error){
        failures++
        const message=error instanceof Error?error.message:String(error)
        console.error((company?.ticker??t.company_id)+': '+message)
        if(company)await logItem(run.id,company.id,t.source_url,'error',0,0,message.slice(0,500))
        const delay=Math.min(1440,30*2**Math.min(6,t.consecutive_failures||0))
        await db('ingestion_targets','id=eq.'+t.id,{method:'PATCH',prefer:'return=minimal',body:{
          last_checked_at:now,last_error:message.slice(0,500),consecutive_failures:(t.consecutive_failures||0)+1,
          next_check_at:new Date(Date.now()+delay*60000).toISOString(),updated_at:now
        }})
      }
    }
  }finally{
    await db('ingestion_runs','id=eq.'+run.id,{method:'PATCH',prefer:'return=minimal',body:{
      status:failures?'error':'success',finished_at:new Date().toISOString(),records_processed:eventsSeen,
      error_message:failures?failures+' target(s) failed':null,details:{targets_succeeded:processed,targets_failed:failures,events_seen:eventsSeen,documents_seen:documentsSeen}
    }})
  }
  if(failures)process.exitCode=1
  console.log('Completed: '+processed+' targets, '+eventsSeen+' events, '+documentsSeen+' docs, '+failures+' errors')
}
main().catch(e=>{console.error(e);process.exitCode=1})
