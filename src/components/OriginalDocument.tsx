import { ExternalLink, FileText, Presentation } from 'lucide-react'
import { irPdfUrl, officeViewer } from '../ir'

/** Render an actual publisher-hosted document, never reconstructed slides or press-release pages. */
export function OriginalDocument({url,title,format,kind}:{url:string;title:string;format:string;kind:'press-release'|'slides'}) {
  const wrapped=(()=>{try{const u=new URL(url);return u.hostname==='view.officeapps.live.com'?u.searchParams.get('src')||url:url}catch{return url}})()
  const pdf=format==='pdf'||/\.pdf(?:[?#]|$)/i.test(wrapped)
  const office=format==='pptx'||format==='docx'||/\.(pptx?|docx?)(?:[?#]|$)/i.test(wrapped)
  const publisherBlocksProxy = /^https:\/\/investors\.robinhood\.com\/static-files\//i.test(wrapped)
  const source=pdf?(publisherBlocksProxy?wrapped:irPdfUrl(wrapped)):office?officeViewer(wrapped):wrapped
  return <div className="sbw-original-source">
    <div className="sbw-original-source-toolbar"><span>{kind==='slides'?<Presentation size={15}/>:<FileText size={15}/>}</span>
      <strong>{title}</strong><span className="grow"/><span className="sbw-original-filetype">{pdf?'Original PDF':office?'Original Office presentation':'Original company page'}</span>
      <a href={wrapped} target="_blank" rel="noreferrer">Open source <ExternalLink size={14}/></a>
    </div>
    {pdf||office?<iframe className="sbw-original-source-frame" title={title} src={source} allowFullScreen/>:
      <div className="sbw-original-html"><FileText size={34}/><h3>Company-published earnings release</h3>
        <p>This company provides its official release as a web page rather than a PDF. Open it in its original formatting and layout.</p>
        <a href={wrapped} target="_blank" rel="noreferrer">Read the company’s original release <ExternalLink size={14}/></a>
      </div>}
  </div>
}
