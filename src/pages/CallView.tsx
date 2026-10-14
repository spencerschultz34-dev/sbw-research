import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, RotateCw, MessageCircleQuestion, LocateFixed } from 'lucide-react'
import { audioUrl, loadTranscript, type CallTranscript } from '../sec'
import { Avatar, Empty } from '../components/ui'

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]
const clock = (s: number) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(x).padStart(2, '0')}` }

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

  return (
    <div className="call">
      {tr.audio && <audio ref={audio} src={audioUrl(symbol, exchange, year, quarter)} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)} onError={() => setAudioErr(true)} />}
      {!tr.audio && <p className="call-note">Transcript from {tr.source}. Audio and follow-along need an EarningsCall plan for this company.</p>}
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
      {tr.audio && audioErr && <p className="call-note">Audio isn't available for this call on the current EarningsCall plan. The transcript still works.</p>}
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
                <p>
                  {p.sentences.map((s, i) => {
                    const k = `${p.id}-${i}`
                    return <span key={k} data-k={k} className={`sent${k === current && (playing || pos > 0) ? ' now' : ''}`} onClick={() => s.t != null && seek(s.t)}>{s.text} </span>
                  })}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
