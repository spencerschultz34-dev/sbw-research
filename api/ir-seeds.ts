// Verified publisher-owned source documents for IR sites that block automated HTML discovery.
// This is a narrowly scoped, auditable fallback, not a substitute for ongoing indexing.
// Sources: https://investors.robinhood.com/financials/quarterly-results (checked 2026-10-21).
import type { IrSite, IrEvent, IrRelease } from './ir'

export function verifiedIrFallback(u: URL): Omit<IrSite,'url'|'host'|'fetchedAt'> | null {
  if (!/(^|\.)robinhood\.com$/i.test(u.hostname) && !/(^|\.)gcs-web\.com$/i.test(u.hostname)) return null
  if (!/^(investors\.robinhood\.com|robinhood\.gcs-web\.com)$/i.test(u.hostname)) return null
  const source = 'https://investors.robinhood.com'
  const quarter = (q:1|2,date:string,links:{release:string;slides:string;transcript:string}):IrEvent => ({
    id:`verified-hood-2026-q${q}`,
    title:`Robinhood Q${q} 2026 Earnings`,
    date:`${date}T21:00:00Z`,
    type:'earnings',
    page:`${source}/financials/quarterly-results`,
    summary:null,
    documents:[
      {kind:'press-release',title:'Earnings press release',url:`${source}/static-files/${links.release}`,format:'pdf'},
      {kind:'slides',title:'Earnings presentation',url:`${source}/static-files/${links.slides}`,format:'pdf'},
      {kind:'transcript',title:'Earnings transcript',url:`${source}/static-files/${links.transcript}`,format:'pdf'}
    ]
  })
  const events:IrEvent[]=[
    quarter(2,'2026-07-29',{
      release:'2f42ce10-59b7-4880-8371-7d52ede7c22e',
      slides:'f5aa8c24-cd37-4a94-9169-cd04759e02a1',
      transcript:'f44ea493-9c52-4744-9671-7720e1ac7b2f'
    }),
    quarter(1,'2026-04-28',{
      release:'15576d76-2d02-4aea-a40d-48e694c04a4b',
      slides:'6840cc36-4a2d-46d8-a9c3-0b334da724f8',
      transcript:'c2119020-41a1-4008-b9ae-db1b9fd6fb5e'
    })
  ]
  const releases:IrRelease[]=events.map(e=>({
    id:e.id+'-release',title:e.title+' Results',date:e.date,
    url:e.documents.find(d=>d.kind==='press-release')!.url,summary:null
  }))
  return {platform:'verified-publisher-fallback',events,releases,
    notes:['Verified Robinhood IR PDF links, checked October 21, 2026.','Partial historical coverage: Q1–Q2 FY2026 only. Live IR crawling was refused with HTTP 403; newer documents require another retrieval or indexing source.']}
}
