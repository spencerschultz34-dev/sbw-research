// Investor relations content on real company pages: events with their press release, slides, transcript and webcast,
// the press release list, and the form for adding a company's IR website. Data comes from /api/ir.
import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ArrowLeft, ExternalLink, FileText, Globe, Headphones, MessageSquareText, Presentation, Radio, RefreshCw, Sheet, Trash2 } from 'lucide-react'
import { CallView } from './CallView'
import { KIND_LABEL, irPdfUrl, loadIrArticle, loadIrSite, officeViewer, type DocKind, type IrArticle, type IrDoc, type IrEvent, type IrSite } from '../ir'
import { loadCallEvents, loadTickers, secAvailable, titleCase, type CallEvent } from '../sec'
import { uid, useStore, type IrSource } from '../store'
import { Empty } from '../components/ui'

const when = (iso: string | null, withTime = false) => {
  if (!iso) return ''
  const d = new Date(/T/.test(iso) ? iso : `${iso}T12:00:00`)
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) })
}
const isPast = (e: IrEvent) => !e.date || Date.parse(e.date) <= Date.now()

const ICON: Partial<Record<DocKind, typeof FileText>> = { 'press-release': FileText, slides: Presentation, transcript: MessageSquareText, webcast: Radio, financials: Sheet }

/** Loads one IR site; `reload` asks the server for a fresh read. */
export function useIrSite(url: string | undefined) {
  const [site, setSite] = useState<IrSite | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!url) return
    setSite(null); setErr(null)
    if (!secAvailable) { setErr('Investor relations pages are read on the hosted site (sbwresearch.vercel.app), not in this preview.'); return }
    let on = true
    loadIrSite(url, n > 0).then((s) => on && setSite(s)).catch((e) => on && setErr(e.message))
    return () => { on = false }
  }, [url, n])
  return { site, err, reload: () => setN((x) => x + 1) }
}

/* ---------- Events: one row per event, its documents open in the viewer ---------- */

export function IrEvents({ source, symbol, exchange, fye }: { source: IrSource; symbol: string; exchange: string; fye: string }) {
  const { site, err, reload } = useIrSite(source.url)
  const [id, setId] = useState<string | null>(null)
  const [cur, setCur] = useState<string | null>(null) // a document url, or 'call'
  const [calls, setCalls] = useState<CallEvent[]>([])

  useEffect(() => {
    if (!symbol || !exchange) return
    let on = true
    loadCallEvents(symbol, exchange, fye).then((x) => on && setCalls(x)).catch(() => {})
    return () => { on = false }
  }, [symbol, exchange, fye])

  const events = site?.events ?? []
  // Start on the latest results event that already happened and has documents, else any past event with documents.
  const hasDocs = (e: IrEvent) => isPast(e) && e.documents.some((d) => d.kind !== 'webcast')
  const first = events.find((e) => e.type === 'earnings' && hasDocs(e)) ?? events.find(hasDocs) ?? events[0]
  const ev = events.find((e) => e.id === id) ?? first
  // EarningsCall's in-app audio and transcript, when it has a call within a few days of this event.
  const callFor = (e: IrEvent | undefined) => e?.type === 'earnings' && e.date ? calls.find((c) => c.date && c.published && Math.abs(Date.parse(c.date) - Date.parse(e.date!)) < 4 * 864e5) : undefined
  const call = callFor(ev)
  const docs = ev?.documents ?? []
  const viewable = docs.filter((d) => d.kind !== 'webcast')
  const current = cur === 'call' ? null : docs.find((d) => d.url === cur) ?? viewable.find((d) => d.kind === 'press-release') ?? viewable[0]
  const showCall = cur === 'call' || (!cur && !current && !!call)

  if (err) return <Empty>{err}</Empty>
  if (!site) return <Empty>Reading {source.url.replace(/^https:\/\//, '').split('/')[0]}…</Empty>
  if (!events.length) return <Empty>No events found on this IR site. {site.notes.join(' ')}</Empty>
  return (
    <div className="earn">
      <aside className="earn-list">
        {events.map((e) => {
          const kinds = [...new Set(e.documents.map((d) => d.kind))].filter((k) => ICON[k])
          return (
            <button key={e.id} className={`sub-item${e.id === ev?.id ? ' active' : ''}`} onClick={() => { setId(e.id); setCur(null) }}>
              <span className="min0">
                <b className="block ir-ev-title">{e.title}</b>
                <small className="muted">{when(e.date)}{isPast(e) ? '' : ' · upcoming'}</small>
                {(kinds.length > 0 || callFor(e)) && (
                  <span className="ir-kinds">
                    {kinds.map((k) => { const I = ICON[k]!; return <I key={k} size={12} aria-label={KIND_LABEL[k]} /> })}
                    {callFor(e) && <Headphones size={12} aria-label="Call audio" />}
                  </span>
                )}
              </span>
            </button>
          )
        })}
        <div className="ir-src muted small">
          <span>{site.platform === 'q4' ? 'Q4 Inc. site' : site.platform === 'microsoft' ? 'microsoft.com' : 'Read from page links'}</span>
          <button className="text-btn" onClick={reload} title="Read the site again"><RefreshCw size={12} />Refresh</button>
        </div>
      </aside>
      <section className="earn-main">
        <div className="doc-toolbar">
          {call && <button className={`fchip${showCall ? ' on' : ''}`} onClick={() => setCur('call')}><Headphones size={13} />Call &amp; transcript</button>}
          {viewable.map((d) => (
            <button key={d.url} className={`fchip${!showCall && d.url === current?.url ? ' on' : ''}`} onClick={() => setCur(d.url)} title={d.title}>
              {KIND_LABEL[d.kind] === d.title || d.kind === 'other' ? d.title : KIND_LABEL[d.kind]}{d.format !== 'html' && <em>{d.format.toUpperCase()}</em>}
            </button>
          ))}
          {docs.filter((d) => d.kind === 'webcast').slice(0, 1).map((d) => <a key={d.url} className="fchip" href={d.url} target="_blank" rel="noreferrer"><Radio size={13} />Webcast<ExternalLink size={12} /></a>)}
          <span className="grow" />
          {!showCall && current && <a className="text-btn" href={current.url} target="_blank" rel="noreferrer">Open<ExternalLink size={13} /></a>}
          {ev?.page && <a className="text-btn hide-narrow" href={ev.page} target="_blank" rel="noreferrer">Event page<ExternalLink size={13} /></a>}
        </div>
        {showCall && call ? <CallView symbol={symbol} exchange={exchange} year={call.year} quarter={call.quarter} />
          : current ? <DocView key={current.url} doc={current} />
          : <EventInfo ev={ev!} />}
      </section>
    </div>
  )
}

function EventInfo({ ev }: { ev: IrEvent }) {
  const cast = ev.documents.find((d) => d.kind === 'webcast')
  return (
    <div className="page-scroll">
      <div className="narrow-col pad-top">
        <h2 className="ir-h">{ev.title}</h2>
        <p className="muted">{when(ev.date, true)}{isPast(ev) ? '' : ' · upcoming'}</p>
        {ev.summary && <p>{ev.summary}</p>}
        {cast ? <a className="btn btn-light" href={cast.url} target="_blank" rel="noreferrer"><Radio size={14} />{isPast(ev) ? 'Watch the webcast' : 'Webcast link'}</a>
          : <p className="muted small">No documents posted for this event yet.</p>}
      </div>
    </div>
  )
}

/** Picks the right viewer: in-app reader for web pages, our PDF route, or Microsoft's viewer for Office files. */
export function DocView({ doc }: { doc: IrDoc }) {
  const [office, setOffice] = useState(false)
  if (doc.format === 'pdf') return <iframe className="earn-frame" title={doc.title} src={irPdfUrl(doc.url)} />
  if (office || doc.format === 'pptx' || doc.format === 'docx' || doc.format === 'xlsx') return <iframe className="earn-frame office" title={doc.title} src={officeViewer(doc.url)} allowFullScreen />
  return <Reader url={doc.url} onNotHtml={() => setOffice(true)} />
}

/** A press release or transcript web page, cleaned up and shown in the app's own reading layout. */
export function Reader({ url, onNotHtml }: { url: string; onNotHtml?: () => void }) {
  const [a, setA] = useState<IrArticle | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    setA(null); setErr(null)
    let on = true
    loadIrArticle(url).then((x) => on && setA(x)).catch((e) => {
      if (!on) return
      if (e.status === 415 && onNotHtml) onNotHtml()
      else setErr(e.message)
    })
    return () => { on = false }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <Empty>{err} <a className="accent" href={url} target="_blank" rel="noreferrer">Open on the company's site</a></Empty>
  if (!a) return <Empty>Loading…</Empty>
  return (
    <div className="page-scroll ir-read-wrap">
      <article className="ir-read">
        <div className="ir-read-meta muted small">
          <Globe size={12} />{new URL(a.url).hostname.replace(/^www\./, '')}{a.date && <> · {when(a.date)}</>} · {Math.max(1, Math.round(a.words / 230))} min read
        </div>
        <h1>{a.title}</h1>
        {/* Sanitized on the server: only text structure, links and images are kept. */}
        <div className="ir-read-body" dangerouslySetInnerHTML={{ __html: a.html }} />
      </article>
    </div>
  )
}

/* ---------- Press releases ---------- */

export function IrReleases({ source }: { source: IrSource }) {
  const { site, err } = useIrSite(source.url)
  const [open, setOpen] = useState<string | null>(null)
  if (err) return <Empty>{err}</Empty>
  if (!site) return <Empty>Reading press releases…</Empty>
  const list = site.releases
  if (open) {
    const r = list.find((x) => x.url === open)
    return (
      <div className="ir-pr-open">
        <div className="doc-toolbar">
          <button className="text-btn" onClick={() => setOpen(null)}><ArrowLeft size={14} />Press releases</button>
          <span className="grow" />
          <a className="text-btn" href={open} target="_blank" rel="noreferrer">Open original<ExternalLink size={13} /></a>
        </div>
        {r && /\.pdf($|\?)/i.test(r.url) ? <iframe className="earn-frame" title={r.title} src={irPdfUrl(r.url)} /> : <Reader url={open} />}
      </div>
    )
  }
  return (
    <div className="narrow-col wide pad-top">
      <div className="sec-head"><h2>Press releases</h2><span className="muted small">{list.length} from {site.host.replace(/^www\./, '')}</span></div>
      {!list.length && <Empty>{site.notes.join(' ')}</Empty>}
      {list.map((r) => (
        <button key={r.id} className="card ir-pr clickable" onClick={() => setOpen(r.url)}>
          <b>{r.title}</b>
          {r.summary && <span className="ir-pr-sum">{r.summary}</span>}
          <span className="muted small">{when(r.date, /T\d\d:\d\d/.test(r.date ?? '') && !/T00:00/.test(r.date ?? ''))}</span>
        </button>
      ))}
    </div>
  )
}

/** Overview card: the latest event that already happened, with its documents. */
export function IrLatest({ source, cik }: { source: IrSource; cik: string }) {
  const { site } = useIrSite(source.url)
  const ev = site?.events.find((e) => isPast(e) && e.type === 'earnings' && e.documents.length) ?? site?.events.find((e) => isPast(e) && e.documents.length)
  const next = site?.events.filter((e) => !isPast(e)).pop()
  if (!ev && !next) return null
  return (
    <>
      <h3 className="sec-title">Latest event</h3>
      {ev && (
        <NavLink to={`/sec/${cik}/events`} className="card pad clickable block">
          <div className="row between"><b>{ev.title}</b><span className="muted small">{when(ev.date)}</span></div>
          <div className="row gap8 wrap">{[...new Set(ev.documents.map((d) => d.kind))].map((k) => <span key={k} className="chip">{KIND_LABEL[k]}</span>)}</div>
        </NavLink>
      )}
      {next && <p className="muted small">Next: {next.title}, {when(next.date, true)}</p>}
    </>
  )
}

/* ---------- Adding IR websites ---------- */

/** Paste a company's IR page; the ticker links it to the company's SEC page. */
export function IrSourceForm({ presetTicker, onDone }: { presetTicker?: string; onDone?: (s: IrSource) => void }) {
  const { irSources, set, notify } = useStore()
  const [url, setUrl] = useState('')
  const [ticker, setTicker] = useState(presetTicker ?? '')
  const [state, setState] = useState<{ busy?: boolean; err?: string; found?: string }>({})
  const [unchecked, setUnchecked] = useState(false)

  const save = async (skipCheck = false) => {
    let u: URL
    try { u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`); u.protocol = 'https:' } catch { setState({ err: 'Enter the address of the investor relations page.' }); return }
    const tk = ticker.trim().toUpperCase()
    if (!/^[A-Z0-9.\-]{1,10}$/.test(tk)) { setState({ err: 'Enter the company\'s ticker, for example AAPL.' }); return }
    setState({ busy: true })
    const match = (await loadTickers()).find((t) => t[1] === tk)
    if (!skipCheck) {
      try {
        const site = await loadIrSite(u.href, true)
        setState({ found: `Found ${site.events.length} events and ${site.releases.length} press releases.` })
      } catch (e) {
        setState({ err: (e as Error).message }); setUnchecked(true); return
      }
    }
    const src: IrSource = { id: uid('ir'), ticker: tk, cik: match?.[0] ?? null, name: match ? titleCase(match[2]) : tk, url: u.href, addedAt: new Date().toISOString() }
    set('irSources', (l) => [...l.filter((x) => x.ticker !== tk), src])
    notify(`${src.name} IR page added`)
    setUrl(''); setUnchecked(false)
    if (!presetTicker) setTicker('')
    onDone?.(src)
  }

  return (
    <form className="card pad ir-form" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="ir-form-row">
        <input className="input" placeholder="https://investor.company.com" value={url} onChange={(e) => { setUrl(e.target.value); setUnchecked(false) }} aria-label="Investor relations page address" />
        {!presetTicker && <input className="input sm" placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} aria-label="Ticker" />}
        <button className="btn btn-light" disabled={state.busy || !url.trim()}>{state.busy ? 'Checking…' : 'Add'}</button>
      </div>
      {state.err && <p className="small neg">{state.err}{unchecked && <> <button type="button" className="text-btn" onClick={() => save(true)}>Add anyway</button></>}</p>}
      {state.found && <p className="small pos">{state.found}</p>}
      {irSources.length === 0 && <p className="muted small">Paste the page where the company lists its results, events or presentations.</p>}
    </form>
  )
}

export function IrSourcesSettings() {
  const { irSources, set } = useStore()
  const sorted = useMemo(() => [...irSources].sort((a, b) => a.name.localeCompare(b.name)), [irSources])
  return (
    <>
      <h2 className="col-title">Investor relations pages</h2>
      <p className="muted small">Each company's IR website supplies its events, press releases, slides and transcripts. Sites built on Q4 Inc. and Microsoft's pages are read in full; other sites are read from the links on the page.</p>
      <IrSourceForm />
      <div className="card set-card">
        {!sorted.length && <div className="set-row muted">No IR pages yet.</div>}
        {sorted.map((s) => (
          <div key={s.id} className="set-row">
            <span className="min0">
              {s.cik ? <NavLink className="block" to={`/sec/${s.cik}/events`}><b>{s.name}</b> <span className="chip chip-ticker">{s.ticker}</span></NavLink> : <b className="block">{s.name}</b>}
              <a className="muted small trunc block" href={s.url} target="_blank" rel="noreferrer">{s.url.replace(/^https:\/\//, '')}</a>
            </span>
            <button className="ghost-icon" aria-label={`Remove ${s.name}`} onClick={() => set('irSources', (l) => l.filter((x) => x.id !== s.id))}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </>
  )
}
