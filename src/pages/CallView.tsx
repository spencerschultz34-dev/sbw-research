import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, RotateCw, MessageCircleQuestion, LocateFixed, Printer, FileDown } from 'lucide-react'
import { audioUrl, loadTranscript, type CallTranscript } from '../sec'
import { Avatar, Empty } from '../components/ui'

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]
const clock = (s: number) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(x).padStart(2, '0')}` }

/** Group spoken sentences into naturally readable blocks without losing their audio timestamps. */
function readingBlocks(sentences: { text: string; t: number | null }[]) {
  const blocks: { text: string; t: number | null; index: number }[][] = []
  let block: { text: string; t: number | null; index: number }[] = []
  let chars = 0
  sentences.forEach((sentence, index) => {
    const next = sentence.text.trim()
    if (block.length && (chars + next.length > 380 || (block.length >= 3 && chars > 140))) {
      blocks.push(block); block = []; chars = 0
    }
    block.push({ ...sentence, index }); chars += next.length + 1
  })
  if (block.length) blocks.push(block)
  return blocks
}

/** A real earnings call: transcript that follows the audio, click any sentence to jump there. */
export function CallView({ symbol, exchange, year, quarter }: { symbol: string; exchange: string; year: number; quarter: number }) {
  const [tr, setTr] = useState<CallTranscript | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [dur, setDur] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [follow, setFollow] = useState(true)
  const [audioErr, setAudioErr] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTr(null); setErr(null); setPos(0); setPlaying(false); setAudioErr(false)
    let on = true
    loadTranscript(symbol, exchange, year, quarter).then((t) => on && setTr(t)).catch((e) => on && setErr(e.message))
    return () => { on = false }
  }, [symbol, exchange, year, quarter])

  // Flatten sentences once so the current one can be found quickly while playing.
  const timeline = useMemo(() => tr?.paragraphs.flatMap((p) => p.sentences.map((s, i) => ({ key: `${p.id}-${i}`, t: s.t ?? -1 }))).filter((x) => x.t >= 0) ?? [], [tr])
  const current = useMemo(() => {
    let lo = 0, hi = timeline.length - 1, hit = ''
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (timeline[mid].t <= pos) { hit = timeline[mid].key; lo = mid + 1 } else hi = mid - 1 }
    return hit
  }, [timeline, pos])

  useEffect(() => {
    if (!follow || !playing || !current) return
    scroller.current?.querySelector(`[data-k="${current}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current, follow, playing])

  const seek = (t: number, play = true) => {
    const a = audio.current
    if (!a) return
    a.currentTime = Math.max(0, t)
    setPos(a.currentTime)
    if (play) a.play().catch(() => setAudioErr(true))
  }
  const toggle = () => { const a = audio.current; if (!a) return; if (a.paused) a.play().catch(() => setAudioErr(true)); else a.pause() }

  if (err) return <Empty>{err}</Empty>
  if (!tr) return <Empty>Loading transcript…</Empty>
  const qna = tr.paragraphs.find((p) => p.id === tr.qnaStart)
  const pdfName = `${symbol.toUpperCase()}_FY${year}_Q${quarter}_SBW_Transcript.pdf`
  // Print in a fresh document, not inside the app's nested fixed-height scrolling panels.
  // This prevents invisible panels from consuming paper and creating trailing blank pages.
  // Page count is determined solely by the length of the current transcript.
  const printTranscript = () => {
    const source = printRef.current
    if (!source) return
    const win = window.open('', '_blank')
    if (!win) { window.alert('Please allow pop-ups for SBW Research to print the transcript.'); return }
    const doc = win.document
    doc.title = pdfName.replace(/\.pdf$/, '')
    const meta = doc.createElement('meta')
    meta.setAttribute('charset', 'utf-8')
    doc.head.appendChild(meta)
    const stylesheetLoads: Promise<void>[] = []
    for (const original of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
      const link = doc.createElement('link')
      link.rel = 'stylesheet'
      link.href = original.href
      stylesheetLoads.push(new Promise<void>((resolve) => { link.onload = () => resolve(); link.onerror = () => resolve() }))
      doc.head.appendChild(link)
    }
    const standalone = doc.createElement('style')
    standalone.textContent = [
      'html, body { height:auto!important; min-height:0!important; overflow:visible!important; margin:0; background:white; }',
      '.sbw-print-document { display:block!important; width:100%; margin:0 auto; }',
      '@media print { body * { visibility:visible!important; } .sbw-print-document { position:static!important; } }'
    ].join('\n')
    doc.head.appendChild(standalone)
    const copy = source.cloneNode(true) as HTMLDivElement
    copy.removeAttribute('aria-hidden')
    doc.body.appendChild(copy)
    // Wait for the compiled stylesheet before opening the native print / Save as PDF dialog.
    void Promise.all(stylesheetLoads).then(() => doc.fonts.ready).then(() => {
      win.focus()
      win.print()
    })
  }

  return (
    <div className="call">
      {tr.audio && <audio ref={audio} src={audioUrl(symbol, exchange, year, quarter)} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)} onError={() => setAudioErr(true)} />}
      {!tr.audio && <p className="call-note">Transcript from {tr.source}. Audio and follow-along appear once our call recorder has this call.</p>}
      <div className="sbw-transcript-tools"><span>Transcript <span className="sbw-transcript-source">{tr.source} · FY{year} Q{quarter}</span></span><button className="sbw-print-button" onClick={printTranscript} title="Print or choose Save as PDF in the print dialog"><FileDown size={15}/> Export PDF <Printer size={13}/></button></div>
      {tr.audio && <div className="call-bar">
        <button className="ghost-icon" aria-label="Back 15 seconds" disabled={audioErr} onClick={() => seek(pos - 15, playing)}><RotateCcw size={16} /></button>
        <button className="play-btn call-play" aria-label={playing ? 'Pause' : 'Play'} disabled={audioErr} onClick={toggle}>{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
        <button className="ghost-icon" aria-label="Forward 15 seconds" disabled={audioErr} onClick={() => seek(pos + 15, playing)}><RotateCw size={16} /></button>
        <span className="mono small muted nowrap">{clock(pos)}</span>
        <input className="call-track" type="range" min={0} max={dur || 1} step={1} value={pos} disabled={audioErr || !dur} aria-label="Position" onChange={(e) => seek(Number(e.target.value), playing)} />
        <span className="mono small muted nowrap">{dur ? clock(dur) : '–:––'}</span>
        <select className="call-speed" aria-label="Speed" value={speed} onChange={(e) => { const v = Number(e.target.value); setSpeed(v); if (audio.current) audio.current.playbackRate = v }}>
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
        {qna && qna.start != null && <button className="text-btn hide-narrow" onClick={() => seek(qna.start!)}><MessageCircleQuestion size={14} />Q&amp;A</button>}
        <button className={`ghost-icon${follow ? ' on' : ''}`} title={follow ? 'Following the audio' : 'Follow the audio'} onClick={() => setFollow(!follow)}><LocateFixed size={15} /></button>
      </div>}
      {tr.audio && audioErr && <p className="call-note">Audio isn't available for this call. The transcript still works.</p>}
      <div className="call-scroll" ref={scroller}>
        <div className="transcript">
          {tr.paragraphs.map((p) => {
            const sp = tr.speakers[p.speaker] ?? { name: 'Speaker', title: '' }
            const operator = /operator/i.test(sp.name)
            return (
              <article key={p.id} className={`para${p.id === tr.qnaStart ? ' qna-start' : ''}`}>
                {p.id === tr.qnaStart && <div className="qna-label">Questions and answers</div>}
                <div className="para-head">
                  {operator ? <span className="avatar op" /> : <Avatar name={sp.name} size={30} />}
                  <div><b>{sp.name}</b>{sp.title && <small>{sp.title}</small>}</div>
                  <span className="grow" />
                  {p.start != null && <button className="stamp mono" onClick={() => seek(p.start!)}>{clock(p.start)}</button>}
                </div>
                <div className="sbw-speech-blocks">
                  {readingBlocks(p.sentences).map((group, j) => (
                    <p key={j} className="sbw-speech-paragraph">
                      {group.map((s) => {
                        const k = `${p.id}-${s.index}`
                        return <span key={k} data-k={k} className={`sent${k === current && (playing || pos > 0) ? ' now' : ''}`} onClick={() => s.t != null && seek(s.t)}>{s.text} </span>
                      })}
                    </p>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <div className="sbw-print-document" ref={printRef} aria-hidden="true">
        <section className="sbw-print-cover">
          <div className="sbw-print-masthead"><span className="sbw-print-mark">SBW</span><span>Schaper, Benz &amp; Wise<br/><small>INVESTMENT COUNSEL · RESEARCH</small></span></div>
          <div className="sbw-print-cover-title"><div className="sbw-print-eyebrow">EARNINGS CALL TRANSCRIPT</div><h1>{tr.company || symbol} ({symbol.toUpperCase()})</h1><h2>Fiscal Year {year} · Quarter {quarter}</h2>{tr.date && <p>{new Date(tr.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</p>}</div>
          <div className="sbw-print-cover-footer"><strong>SBW RESEARCH</strong><span>Prepared for internal investment research</span></div>
        </section>
        <section className="sbw-print-body">
          <header className="sbw-print-header"><strong>SBW RESEARCH</strong><span>{symbol.toUpperCase()} · FY{year} Q{quarter} Earnings Call</span></header>
          <h2>Participants</h2>
          <div className="sbw-print-participants">{Object.entries(tr.speakers).map(([key, speaker]) => <div key={key}><strong>{speaker.name}</strong>{speaker.title && <span>{speaker.title}</span>}</div>)}</div>
          <h2>Transcript</h2>
          <p className="sbw-print-disclaimer">Machine-generated transcript for research reference. Speaker names, words, and financial figures may contain transcription errors. Confirm material information against company filings and original audio.</p>
          {tr.paragraphs.map((p) => { const speaker = tr.speakers[p.speaker] ?? { name: 'Speaker', title: '' }; return <section className="sbw-print-turn" key={p.id}>
            {p.id === tr.qnaStart && <h2 className="sbw-print-section">Question &amp; Answer Session</h2>}
            <div className="sbw-print-speaker"><strong>{speaker.name}</strong>{speaker.title && <span>{speaker.title}</span>}{p.start != null && <span className="sbw-print-stamp">{clock(p.start)}</span>}</div>
            {readingBlocks(p.sentences).map((group, j) => <p key={j}>{group.map(s => s.text).join(' ')}</p>)}
          </section> })}
          <footer className="sbw-print-disclaimer">Schaper, Benz &amp; Wise Investment Counsel · Generated from SBW Research · For internal use</footer>
        </section>
      </div>
    </div>
  )
}
