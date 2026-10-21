import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkle, Maximize2, Minimize2, Columns2, X, ChevronDown, Play, Pause, Copy, Download, RefreshCw, Search, ChevronLeft, ChevronRight,
  Minus, Plus, PanelLeftClose, History, Bookmark, Highlighter, ArrowUpRight, ArrowDownRight, Check, Table2, CalendarPlus, Info,
} from 'lucide-react'
import { ensureReports, ensureTranscript, eventById, eventsForCompany, TODAY } from '../data'
import { companyById } from '../data/companies'
import type { CompanyEvent, Paragraph, ReportDoc } from '../data/types'
import { usePlayer, useStore, uid, type PanelTab } from '../store'
import { fmtDate, fmtDur, fmtNum, fmtStamp, pctChange, eventWhen, fmtDayMonth } from '../format'
import { Avatar, Logo, Menu, Modal, ReportIcon, TimingChips, Ticker } from './ui'
import { PaperPage, SlideView } from './visuals'

declare const __ARTIFACT__: boolean

export function EventPanel() {
  const nav = useNavigate()
  const store = useStore()
  const player = usePlayer()
  const { panel, expanded, setExpanded, closePanel, openEvent } = store
  if (panel?.kind !== 'event') return null
  const ev = eventById(panel.eventId)
  if (!ev) return null
  const c = companyById(ev.companyId)
  const tab = panel.tab
  const setTab = (t: PanelTab) => openEvent(ev.id, t)
  const playingThis = player.eventId === ev.id
  const tabs: { id: PanelTab; label: string; has: boolean; count?: number }[] = [
    { id: 'overview', label: 'Overview', has: true },
    { id: 'transcript', label: 'Transcript', has: !!ev.transcript || !!ev.call },
    { id: 'slides', label: 'Slides', has: !!ev.slides },
    { id: 'report', label: 'Report', has: ev.reports.length > 0 || !!ev.filing, count: ev.reports.length > 1 ? ev.reports.length : undefined },
  ]
  const all = eventsForCompany(ev.companyId).slice().sort((a,b)=>b.date.localeCompare(a.date))

  return (
    <div className="event-panel">
      <div className="ep-head">
        <Logo id={c.id} size={24} />
        <button className="crumb sbw-company-link" onClick={() => { nav(`/company/${c.id}`); closePanel() }} title={`Open ${c.name} company overview`}>{c.name}</button>
        <ChevronRight size={14} className="muted" />
        <Menu width={300} trigger={(_o, t) => (
          <button className="crumb-btn" onClick={t}>{ev.title} - {fmtDate(ev.date)}<ChevronDown size={14} /></button>
        )}>
          {(close) => <div className="menu-scroll">{all.map((e) => (
            <button key={e.id} className={`menu-item${e.id === ev.id ? ' cur' : ''}`} onClick={() => { openEvent(e.id, 'overview'); close() }}>
              <span>{e.title}</span><span className="muted">{fmtDate(e.date)}</span>
            </button>
          ))}</div>}
        </Menu>
        {ev.status === 'live' && <span className="live-badge"><i />LIVE</span>}
        <span className="grow" />
        <button className="ghost-icon" title="Ask AI about this event" onClick={() => store.openChatPanel()}><Sparkle size={16} /></button>
        <button className="ghost-icon" title={expanded ? 'Exit full width' : 'Full width'} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
        <button className="ghost-icon hide-mobile" title="Side by side" onClick={() => setExpanded(false)}><Columns2 size={15} /></button>
        <button className="ghost-icon" title="Close" onClick={closePanel}><X size={17} /></button>
      </div>
      <div className="tabs ep-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' on' : ''}${t.has ? '' : ' dim'}`} disabled={!t.has} onClick={() => setTab(t.id)}>
            {t.label}{t.count && <em className="count">{t.count}</em>}
          </button>
        ))}
        {ev.hasAudio && (
          <>
            <span className="tab-sep" />
            <button className="play-audio" onClick={() => (playingThis ? player.toggle() : player.play(ev.id))}>
              <span className="play-btn">{playingThis && player.playing ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}</span>
              {playingThis && player.playing ? 'Pause' : ev.status === 'live' ? 'Listen live' : 'Play audio'}
              <span className="muted mono">{ev.status === 'live' ? fmtDur(player.liveEdge) : fmtDur(ev.durationSec)}</span>
            </button>
          </>
        )}
      </div>
      <div className="ep-body sbw-msft-reader">
        {tab === 'overview' && <Overview ev={ev} />}
        {tab === 'transcript' && (ev.transcript ? <TranscriptView ev={ev} focus={panel.focus} nonce={panel.nonce} /> : <Loading ev={ev} what="transcript" />)}
        {tab === 'report' && (ev.reports.length > 0 ? <ReportView key={ev.reports.length} ev={ev} focus={panel.focus} /> : <Loading ev={ev} what="report" />)}
        {tab === 'slides' && (ev.slides?.length ? <SlidesView ev={ev} focus={panel.focus} /> : <div className="ep-scroll"><div className="empty">No source presentation slides are available for this event.</div></div>)}
      </div>
    </div>
  )
}

/** Transcripts and filings load the first time an event is opened. */
function Loading({ ev, what }: { ev: CompanyEvent; what: 'transcript' | 'report' }) {
  useEffect(() => { void (what === 'transcript' ? ensureTranscript(ev.id) : ensureReports(ev.id)) }, [ev.id, what])
  const err = what === 'transcript' ? ev.transcriptError : undefined
  return <div className="ep-scroll"><div className="empty">{err ?? `Loading the ${what}…`}</div></div>
}

/* ---------- Overview ---------- */

function Overview({ ev }: { ev: CompanyEvent }) {
  const { openEvent } = useStore()
  const player = usePlayer()
  if (ev.status === 'upcoming') return <UpcomingOverview ev={ev} />
  return (
    <div className="ep-scroll">
      <article className="summary">
        {ev.status === 'live' && (
          <div className="live-banner"><span className="live-badge"><i />LIVE</span>The call is in progress. The summary updates when the transcript is final.
            <button className="btn btn-light btn-sm" onClick={() => { player.play(ev.id); openEvent(ev.id, 'transcript') }}>Listen live</button></div>
        )}
        <div className="sbw-summary-kicker">Earnings call · {fmtDate(ev.date)}</div>
        <h1>{ev.headline ?? `${companyById(ev.companyId).name} ${ev.title} earnings`}</h1>
        {ev.metrics?.some((m) => m.actual) && (
          <>
            <div className="bm-label">Beat/miss vs estimates in USD <Info size={13} /> <span className="muted">Reported {fmtDate(ev.date)}</span></div>
            <div className="bm-chips">
              {ev.metrics!.filter((m) => m.actual != null).map((m) => {
                const d = pctChange(m.actual!, m.estimate)
                return <span key={m.label} className="chip chip-lg">{m.label}: {fmtNum(m.actual!, m.unit)} <b className={d >= 0 ? 'pos' : 'neg'}>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</b></span>
              })}
            </div>
          </>
        )}
        {ev.summary?.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            <ul>
              {s.bullets.map((b, i) => (
                <li key={i}>{b.text} {b.cites.map((ct) => (
                  <button key={ct.n} className="cite" title={`Open source (${ct.tab})`} onClick={() => openEvent(ev.id, ct.tab, ct.ref)}>{ct.n}</button>
                ))}</li>
              ))}
            </ul>
          </section>
        ))}
        {!ev.summary && (
          <div className="sbw-summary-empty">
            <h2>Source materials</h2>
            <p className="muted">An editorial earnings summary has not been generated for this event. Use the original call and SEC documents below for primary-source research.</p>
            <div className="row gap8 wrap">
            {ev.call && <button className="btn btn-light btn-sm" onClick={() => openEvent(ev.id, 'transcript')}>Read the transcript</button>}
            {ev.filing && <button className="btn btn-light btn-sm" onClick={() => openEvent(ev.id, 'report')}>Earnings release</button>}
            {!ev.call && !ev.filing && <p className="muted">Nothing has been published for this event yet.</p>}
            </div>
          </div>
        )}
      </article>
    </div>
  )
}

function UpcomingOverview({ ev }: { ev: CompanyEvent }) {
  const { notify, prefs } = useStore()
  return (
    <div className="ep-scroll">
      <article className="summary">
        <div className="upcoming-head">
          <span className="chip">{ev.estimated ? 'Estimated date' : 'Confirmed'}</span>
          <h1>{ev.title} on {eventWhen(ev.date)}</h1>
          <TimingChips ev={ev} h12={prefs.timeFormat === '12'} />
          <p className="muted">Audio, live transcript, slides and reports appear here as soon as the company publishes them. No registration needed.</p>
          <div className="row gap8">
            <button className="btn btn-light" onClick={() => notify('Added to your calendar subscription')}><CalendarPlus size={14} />Add to calendar</button>
          </div>
        </div>
        {ev.metrics && <ConsensusTable ev={ev} />}
      </article>
    </div>
  )
}

export function ConsensusTable({ ev, compact }: { ev: CompanyEvent; compact?: boolean }) {
  const past = ev.metrics!.some((m) => m.actual !== undefined)
  const prevLabel = ev.title.replace(/Q(\d) (\d{4})/, (_m, q, y) => `Q${q} '${String(+y - 1).slice(2)}`)
  return (
    <div className={`consensus${compact ? ' compact' : ''}`}>
      <table className="num-table">
        <thead><tr><th>in USD</th>{past ? <><th>Actual</th><th>Estimate</th><th>Beat/miss</th></> : <><th>Estimate</th><th>{prevLabel}</th><th>Change</th></>}</tr></thead>
        <tbody>
          {ev.metrics!.filter((m) => !past || m.actual != null).map((m) => {
            const base = past ? m.actual : m.prior
            const d = base == null ? null : past ? pctChange(m.actual!, m.estimate) : pctChange(m.estimate, m.prior!)
            const cls = d == null || Math.abs(d) < 1 ? '' : d > 0 ? 'pos' : 'neg'
            return (
              <tr key={m.label}>
                <td>{m.label}</td>
                {past ? <><td>{fmtNum(m.actual!, m.unit)}</td><td>{fmtNum(m.estimate, m.unit)}</td></> : <><td>{fmtNum(m.estimate, m.unit)}</td><td>{m.prior != null ? fmtNum(m.prior, m.unit) : '–'}</td></>}
                <td className={cls}>{d == null ? '–' : <>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</>}{cls === 'pos' && <ArrowUpRight size={13} />}{cls === 'neg' && <ArrowDownRight size={13} />}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!past && <div className="consensus-foot"><span className="muted">Analyst consensus from Finnhub</span><Info size={14} className="muted" /></div>}
    </div>
  )
}

/* ---------- Transcript ---------- */

/** Split long speaking turns into short FactSet-style reading paragraphs, preserving per-sentence seek targets. */
function transcriptGroups(lines: string[]): number[][] {
  const groups: number[][] = []
  let group: number[] = []
  let chars = 0
  lines.forEach((line, i) => {
    if (group.length && (chars + line.length > 390 || (group.length >= 3 && chars > 155))) {
      groups.push(group); group = []; chars = 0
    }
    group.push(i)
    chars += line.length
  })
  if (group.length) groups.push(group)
  return groups
}

function sentences(text: string) {
  return text.match(/[^.!?]+[.!?]+["”]?\s*|[^.!?]+$/g) ?? [text]
}

function TranscriptView({ ev, focus, nonce }: { ev: CompanyEvent; focus?: string; nonce?: number }) {
  const t = ev.transcript!
  const timed = t.timed !== false
  const store = useStore()
  const player = usePlayer()
  const [sync, setSync] = useState(true)
  const [find, setFind] = useState<string | null>(null)
  const [hit, setHit] = useState(0)
  const [sel, setSel] = useState<{ x: number; y: number; text: string; pid: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isPlaying = player.eventId === ev.id
  const live = ev.status === 'live'
  const visible = live ? t.paragraphs.filter((p) => p.start <= player.liveEdge) : t.paragraphs
  const end = live ? player.liveEdge : ev.durationSec

  const curPid = isPlaying ? [...visible].reverse().find((p) => p.start <= player.pos)?.id : undefined

  // follow audio
  useEffect(() => {
    if (!sync || !curPid || !player.playing) return
    document.getElementById(`para-${curPid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [curPid, sync, player.playing])

  // focus from citation / search / saved
  useEffect(() => {
    if (!focus) return
    const el = document.getElementById(`para-${focus}`)
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600) }
  }, [focus, nonce])

  const matches = useMemo(() => {
    if (!find) return [] as string[]
    const q = find.toLowerCase()
    return visible.filter((p) => p.text.toLowerCase().includes(q)).map((p) => p.id)
  }, [find, visible])
  useEffect(() => { setHit(0) }, [find])
  useEffect(() => { if (matches[hit]) document.getElementById(`para-${matches[hit]}`)?.scrollIntoView({ block: 'center' }) }, [hit, matches])

  const savedHere = store.saved.filter((s) => s.type === 'transcript' && s.eventId === ev.id)
  const savePara = (p: Paragraph, highlight?: string) => {
    store.set('saved', (s) => [{ id: uid('s'), type: 'transcript', eventId: ev.id, ref: p.id, highlight, savedAt: TODAY.toISOString() }, ...s])
    store.notify(highlight ? 'Highlight saved' : 'Paragraph saved')
  }

  const onMouseUp = () => {
    const s = window.getSelection()
    const text = s?.toString().trim()
    if (!s || !text || s.rangeCount === 0) { setSel(null); return }
    const node = s.anchorNode?.parentElement?.closest('[data-pid]') as HTMLElement | null
    if (!node) { setSel(null); return }
    const r = s.getRangeAt(0).getBoundingClientRect()
    const box = scrollRef.current!.getBoundingClientRect()
    setSel({ x: r.left - box.left + r.width / 2, y: r.top - box.top + scrollRef.current!.scrollTop - 8, text, pid: node.dataset.pid! })
  }

  const copyAll = () => {
    const txt = t.paragraphs.map((p) => `${t.speakers[p.speaker].name} (${fmtStamp(p.start)}): ${p.text}`).join('\n\n')
    navigator.clipboard?.writeText(txt).then(() => store.notify('Transcript copied'), () => store.notify('Copy is blocked here. Select the text instead.'))
  }

  const download = () => {
    if (__ARTIFACT__) { store.notify('Downloads work in the hosted version of the app'); return }
    const txt = t.paragraphs.map((p) => `${t.speakers[p.speaker].name} (${fmtStamp(p.start)})\n${p.text}`).join('\n\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }))
    a.download = `${companyById(ev.companyId).ticker}-${ev.title.replace(/\s+/g, '-')}-transcript.txt`
    a.click()
  }

  const jump = (sec: number) => {
    const p = [...visible].reverse().find((x) => x.start <= sec) ?? visible[0]
    document.getElementById(`para-${p.id}`)?.scrollIntoView({ block: 'start' })
    if (isPlaying) player.seek(sec)
  }

  return (
    <div className="doc-view">
      <div className="doc-toolbar">
        <button className="ghost-icon" title="Copy transcript" onClick={copyAll}><Copy size={15} /></button>
        <button className="ghost-icon" title="Download transcript" onClick={download}><Download size={15} /></button>
        <button className={`ghost-icon${sync ? ' on' : ''}`} title={sync ? 'Following audio' : 'Follow audio'} onClick={() => setSync(!sync)}><RefreshCw size={15} /></button>
        <span className="tb-sep" />
        <Menu width={260} trigger={(_o, tg) => <button className="text-btn" onClick={tg}>Chapters<ChevronDown size={14} /></button>}>
          {(close) => t.chapters.map((ch) => (
            <button key={ch.title} className="menu-item" onClick={() => { jump(ch.start); close() }}><span>{ch.title}</span><span className="muted mono">{fmtStamp(ch.start)}</span></button>
          ))}
        </Menu>
        <button className="text-btn chip-btn" disabled={!t.qnaStart && t.qnaStart !== 0} title={t.qnaStart || t.qnaStart === 0 ? "Jump to questions and answers" : "Q&A start not identified"} onClick={() => jump(t.qnaStart)}>Q&amp;A</button>
        <span className="grow" />
        {find === null
          ? <button className="text-btn" onClick={() => setFind('')}><Search size={14} />Find</button>
          : (
            <div className="find-box">
              <Search size={14} />
              <input id="find-transcript" autoFocus value={find} placeholder="Find in transcript" onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setHit((h) => (matches.length ? (h + 1) % matches.length : 0)); if (e.key === 'Escape') setFind(null) }} />
              <span className="muted mono">{matches.length ? `${hit + 1}/${matches.length}` : '0/0'}</span>
              <button className="ghost-icon" onClick={() => setHit((h) => (h - 1 + matches.length) % Math.max(1, matches.length))}><ChevronLeft size={14} /></button>
              <button className="ghost-icon" onClick={() => setHit((h) => (h + 1) % Math.max(1, matches.length))}><ChevronRight size={14} /></button>
              <button className="ghost-icon" onClick={() => setFind(null)}><X size={14} /></button>
            </div>
          )}
      </div>
      <div className="ep-scroll transcript" ref={scrollRef} onMouseUp={onMouseUp}>
        {visible.map((p) => {
          const sp = t.speakers[p.speaker]
          const cur = p.id === curPid
          const hls = savedHere.filter((s) => s.ref === p.id && s.highlight).map((s) => s.highlight!)
          const isSaved = savedHere.some((s) => s.ref === p.id && !s.highlight)
          const next = visible[visible.indexOf(p) + 1]?.start ?? end
          // Real transcripts carry a start time per sentence; otherwise spread the paragraph evenly.
          const sents = p.sents?.map((x) => x.text + ' ') ?? sentences(p.text)
          const per = (next - p.start) / sents.length
          const startOf = (i: number) => p.sents?.[i]?.t ?? p.start + i * per
          const groups = transcriptGroups(sents)
          const curSent = !cur ? -1 : p.sents ? p.sents.reduce((k, x, i) => (x.t != null && x.t <= player.pos ? i : k), 0) : Math.floor((player.pos - p.start) / per)
          return (
            <div key={p.id} id={`para-${p.id}`} className={`para${cur ? ' cur' : ''}${sp.isAnalyst ? ' analyst' : ''}${matches[hit] === p.id ? ' found' : ''}`}>
              <div className="para-head">
                {sp.isOperator ? <span className="avatar op"><PhoneGlyph /></span> : <Avatar name={sp.name} size={30} />}
                <div><b>{sp.name}</b>{sp.role && <small>{sp.role}</small>}</div>
                <span className="grow" />
                <button className={`ghost-icon para-save${isSaved ? ' on' : ''}`} title={isSaved ? 'Saved' : 'Save paragraph'} onClick={() => !isSaved && savePara(p)}><Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} /></button>
                {timed && <button className="stamp mono" title="Play from here" onClick={() => ev.hasAudio && player.play(ev.id, p.start)}>{fmtStamp(p.start)}</button>}
              </div>
              <div data-pid={p.id} className="sbw-transcript-paragraphs">
                {groups.map((group, j) => <p key={j} className="sbw-transcript-reading-paragraph">
                  {group.map((i) => (
                    <span key={i} className={`sent${i === curSent ? ' now' : ''}`} onClick={() => { if (window.getSelection()?.toString()) return; if (timed && ev.hasAudio) player.play(ev.id, startOf(i)) }}>
                      <Marked text={sents[i]} highlights={hls} find={find ?? ''} />
                    </span>
                  ))}
                </p>)}
              </div>
            </div>
          )
        })}
        {live && <div className="live-tail"><span className="live-badge"><i />LIVE</span>Transcribing as the call happens…</div>}
        {sel && (
          <div className="sel-pop" style={{ left: sel.x, top: sel.y }} onMouseUp={(e) => e.stopPropagation()}>
            <button onClick={() => { savePara(t.paragraphs.find((p) => p.id === sel.pid)!, sel.text); window.getSelection()?.removeAllRanges(); setSel(null) }}><Highlighter size={14} />Highlight</button>
            <button onClick={() => { navigator.clipboard?.writeText(sel.text).then(() => store.notify('Copied'), () => store.notify('Copy is blocked here')); setSel(null) }}><Copy size={14} />Copy</button>
            <button onClick={() => { store.openChatPanel(); setSel(null) }}><Sparkle size={14} />Ask AI</button>
          </div>
        )}
      </div>
    </div>
  )
}

const PhoneGlyph = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" /></svg>

function Marked({ text, highlights, find }: { text: string; highlights: string[]; find: string }) {
  // mark saved highlights (teal) and find matches
  const terms = [...highlights.map((h) => ({ t: h, cls: 'hl' })), ...(find ? [{ t: find, cls: 'find' }] : [])]
  if (!terms.length) return <>{text}</>
  const ranges: { s: number; e: number; cls: string }[] = []
  for (const { t, cls } of terms) {
    if (cls === 'hl') {
      // a highlight may span several sentences: mark the overlap
      for (let k = Math.min(t.length, text.length); k >= 12; k--) {
        const piece = text.slice(0, k)
        if (t.endsWith(piece.trim()) && piece.trim().length > 10) { ranges.push({ s: 0, e: k, cls }); break }
      }
      const i = text.indexOf(t)
      if (i >= 0) ranges.push({ s: i, e: i + t.length, cls })
      else {
        const j = t.indexOf(text.trim())
        if (j >= 0) ranges.push({ s: 0, e: text.length, cls })
        else {
          for (let k = text.length; k > 12; k--) { const tail = text.slice(-k); if (t.startsWith(tail.trim())) { ranges.push({ s: text.length - k, e: text.length, cls }); break } }
        }
      }
    } else {
      const lower = text.toLowerCase(); let i = lower.indexOf(t.toLowerCase())
      while (i >= 0 && t) { ranges.push({ s: i, e: i + t.length, cls }); i = lower.indexOf(t.toLowerCase(), i + t.length) }
    }
  }
  ranges.sort((a, b) => a.s - b.s)
  const out: React.ReactNode[] = []
  let pos = 0
  ranges.forEach((r, i) => {
    if (r.s < pos) return
    out.push(text.slice(pos, r.s))
    out.push(<mark key={i} className={r.cls}>{text.slice(r.s, r.e)}</mark>)
    pos = r.e
  })
  out.push(text.slice(pos))
  return <>{out}</>
}

/* ---------- Report viewer ---------- */

function ReportView({ ev, focus }: { ev: CompanyEvent; focus?: string }) {
  const store = useStore()
  const [docId, page0] = focus && focus.includes(':') ? focus.split(':') : [ev.reports[0].id, '0']
  const [doc, setDoc] = useState<ReportDoc>(ev.reports.find((r) => r.id === docId) ?? ev.reports[0])
  const [page, setPage] = useState(Number(page0) || 0)
  const [zoom, setZoom] = useState(1)
  const [thumbs, setThumbs] = useState(true)
  const [find, setFind] = useState<string | null>(null)
  useEffect(() => {
    const d = ev.reports.find((r) => r.id === docId)
    if (d) { setDoc(d); setPage(Number(page0) || 0) }
  }, [focus]) // eslint-disable-line
  const pages = doc.pages
  const saved = store.saved.some((s) => s.type === 'report' && s.ref === `${doc.id}:${page}`)
  if (doc.url) return (
    <div className="doc-view">
      <div className="doc-toolbar">
        <Menu width={280} trigger={(_o, t) => <button className="text-btn" onClick={t}>{doc.title}{doc.form && <span className="form-chip">{doc.form}</span>}<ChevronDown size={14} /></button>}>
          {(close) => ev.reports.map((r) => (
            <button key={r.id} className={`menu-item${r.id === doc.id ? ' cur' : ''}`} onClick={() => { setDoc(r); close() }}>
              <span>{r.title}</span>{r.form && <span className="form-chip">{r.form}</span>}
            </button>
          ))}
        </Menu>
        <button className={`ghost-icon${saved ? ' on' : ''}`} title="Save document" onClick={() => { if (!saved) { store.set('saved', (s) => [{ id: uid('s'), type: 'report', eventId: ev.id, ref: `${doc.id}:0`, savedAt: TODAY.toISOString() }, ...s]); store.notify('Document saved') } }}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /></button>
        <span className="grow" />
        <a className="text-btn" href={doc.url} target="_blank" rel="noreferrer">Open<ArrowUpRight size={13} /></a>
      </div>
      <iframe key={doc.url} className="earn-frame" title={doc.title} src={doc.url} />
    </div>
  )
  return (
    <div className="doc-view">
      <div className="doc-toolbar">
        <button className={`ghost-icon${thumbs ? ' on' : ''}`} title="Thumbnails" onClick={() => setThumbs(!thumbs)}><PanelLeftClose size={15} /></button>
        <button className="ghost-icon" title="Download" onClick={() => store.notify(__ARTIFACT__ ? 'Downloads work in the hosted version of the app' : 'Download started')}><Download size={15} /></button>
        <button className={`ghost-icon${saved ? ' on' : ''}`} title="Save page" onClick={() => { if (!saved) { store.set('saved', (s) => [{ id: uid('s'), type: 'report', eventId: ev.id, ref: `${doc.id}:${page}`, savedAt: TODAY.toISOString() }, ...s]); store.notify('Page saved') } }}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /></button>
        <span className="tb-sep" />
        <button className="ghost-icon" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /></button>
        <span className="mono pager">{page + 1} of {pages.length}</span>
        <button className="ghost-icon" disabled={page === pages.length - 1} onClick={() => setPage(page + 1)}><ChevronRight size={15} /></button>
        <span className="tb-sep" />
        <button className="ghost-icon" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}><Minus size={14} /></button>
        <span className="pager">{zoom === 1 ? 'Auto' : `${Math.round(zoom * 100)}%`}</span>
        <button className="ghost-icon" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}><Plus size={14} /></button>
        <span className="tb-sep" />
        <Menu width={280} trigger={(_o, t) => <button className="text-btn" onClick={t}>{doc.title}{doc.form && <span className="form-chip">{doc.form}</span>}<ChevronDown size={14} /></button>}>
          {(close) => ev.reports.map((r) => (
            <button key={r.id} className={`menu-item${r.id === doc.id ? ' cur' : ''}`} onClick={() => { setDoc(r); setPage(0); close() }}>
              <span>{r.title}</span>{r.form && <span className="form-chip">{r.form}</span>}
            </button>
          ))}
        </Menu>
        <span className="grow" />
        {find === null ? <button className="text-btn" onClick={() => setFind('')}><Search size={14} />Find</button> : (
          <div className="find-box"><Search size={14} /><input id="find-report" autoFocus value={find} placeholder="Find in document" onChange={(e) => setFind(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setFind(null)} /><button className="ghost-icon" onClick={() => setFind(null)}><X size={14} /></button></div>
        )}
      </div>
      <div className="viewer">
        {thumbs && (
          <div className="thumbs">
            {pages.map((p, i) => (
              <button key={i} className={`thumb${i === page ? ' on' : ''}`} onClick={() => setPage(i)}>
                <div className="thumb-scale"><PaperPage page={p} companyId={ev.companyId} exhibit={i === 0 && doc.kind === 'Earnings release'} /></div>
                <span className="thumb-n">{i + 1}</span>
              </button>
            ))}
          </div>
        )}
        <div className="viewer-main">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
            <PaperPage page={pages[page]} companyId={ev.companyId} findTerm={find ?? undefined} exhibit={page === 0 && doc.kind === 'Earnings release'} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Slides viewer ---------- */

function SlidesView({ ev, focus }: { ev: CompanyEvent; focus?: string }) {
  const store = useStore()
  const slides = ev.slides!
  const [i, setI] = useState(Math.max(0, slides.findIndex((s) => s.key === focus)))
  const [thumbs, setThumbs] = useState(true)
  const [history, setHistory] = useState(false)
  const [extract, setExtract] = useState(false)
  useEffect(() => { const k = slides.findIndex((s) => s.key === focus); if (k >= 0) setI(k) }, [focus]) // eslint-disable-line
  const s = slides[i]
  const earlier = eventsForCompany(ev.companyId)
    .filter((e) => e.slides && e.date < ev.date && e.id !== ev.id)
    .map((e) => ({ e, slide: e.slides!.find((x) => x.key === s.key) }))
    .filter((x) => x.slide)
  const saved = store.saved.some((x) => x.type === 'slide' && x.eventId === ev.id && x.ref === s.key)
  const save = () => { if (!saved) { store.set('saved', (sv) => [{ id: uid('s'), type: 'slide', eventId: ev.id, ref: s.key, savedAt: TODAY.toISOString() }, ...sv]); store.notify('Slide saved') } }
  const table = s.bars ? [['Period', 'Value'], ...s.bars.map((b) => [b.label, String(b.value)])] : s.kpis ? [['Metric', 'Value'], ...s.kpis.map((k) => [k.label, k.value])] : null
  return (
    <div className="doc-view">
      <div className="doc-toolbar">
        <button className={`ghost-icon${thumbs ? ' on' : ''}`} title="Thumbnails" onClick={() => setThumbs(!thumbs)}><PanelLeftClose size={15} /></button>
        <button className={`ghost-icon${history ? ' on' : ''}`} title="Slide history" onClick={() => setHistory(!history)}><History size={15} /></button>
        <button className="ghost-icon" title="Download" onClick={() => store.notify(__ARTIFACT__ ? 'Downloads work in the hosted version of the app' : 'Download started')}><Download size={15} /></button>
        <span className="tb-sep" />
        <button className="ghost-icon" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={15} /></button>
        <span className="mono pager">{i + 1} of {slides.length}</span>
        <button className="ghost-icon" disabled={i === slides.length - 1} onClick={() => setI(i + 1)}><ChevronRight size={15} /></button>
        <span className="grow" />
        <Menu align="right" width={220} trigger={(_o, t) => <button className="text-btn" onClick={t}>Slide actions<ChevronDown size={14} /></button>}>
          {(close) => (
            <>
              <button className="menu-item" disabled={!table} onClick={() => { setExtract(true); close() }}><span><Table2 size={14} /> Extract data to Excel</span></button>
              <button className="menu-item" onClick={() => { save(); close() }}><span><Bookmark size={14} /> {saved ? 'Saved' : 'Save slide'}</span></button>
              <button className="menu-item" onClick={() => { setHistory(true); close() }}><span><History size={14} /> Show slide history</span></button>
              {ev.transcript && <button className="menu-item" onClick={() => { store.openEvent(ev.id, 'transcript'); close() }}><span>Open transcript</span></button>}
              <button className="menu-item" onClick={() => { store.openChatPanel(); close() }}><span><Sparkle size={14} /> Ask AI about this slide</span></button>
            </>
          )}
        </Menu>
      </div>
      <div className="viewer">
        {thumbs && (
          <div className="thumbs">
            {slides.map((sl, k) => (
              <button key={k} className={`thumb slide-thumb${k === i ? ' on' : ''}`} onClick={() => setI(k)}>
                <SlideView slide={sl} companyId={ev.companyId} mini />
                <span className="thumb-n">{k + 1}</span>
              </button>
            ))}
          </div>
        )}
        <div className="viewer-main">
          <div className="slide-stage">
            <SlideView slide={s} companyId={ev.companyId} />
            <div className="slide-meta"><span className="chip">{s.category}</span><span className="muted">{ev.title} · {fmtDate(ev.date)}</span></div>
          </div>
          {history && (
            <div className="history">
              <div className="history-head"><History size={14} />Earlier versions of this slide</div>
              {earlier.length === 0 && <div className="empty">No earlier versions of this slide.</div>}
              {earlier.map(({ e, slide }) => (
                <div key={e.id} className="slide-stage">
                  <SlideView slide={slide!} companyId={ev.companyId} />
                  <div className="slide-meta"><span className="chip">{e.title}</span><span className="muted">{fmtDate(e.date)}</span>
                    <button className="text-btn" onClick={() => store.openEvent(e.id, 'slides', s.key)}>Open event</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {extract && table && (
        <Modal title="Extracted data" onClose={() => setExtract(false)} width={460} footer={
          <>
            <button className="btn btn-quiet" onClick={() => setExtract(false)}>Close</button>
            <button className="btn btn-light" onClick={() => {
              navigator.clipboard?.writeText(table.map((r) => r.join('\t')).join('\n')).then(() => store.notify('Copied. Paste into Excel.'), () => store.notify('Copy is blocked here. Select the table instead.'))
            }}><Copy size={14} />Copy for Excel</button>
          </>
        }>
          <p className="muted">{s.title} · {companyById(ev.companyId).name} {ev.title}</p>
          <table className="num-table"><tbody>{table.map((r, k) => <tr key={k}>{r.map((c, j) => (k === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody></table>
          <p className="muted small"><Check size={12} /> Linked to slide {i + 1} of the {ev.title} presentation.</p>
        </Modal>
      )}
    </div>
  )
}

export { ReportIcon, Ticker }
