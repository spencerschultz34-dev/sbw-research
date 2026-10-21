import { ChevronRight, ListEnd, Pause, Play, Volume2, VolumeX, X, RotateCcw, RotateCw } from 'lucide-react'
import { companyById } from '../data/companies'
import { eventById } from '../data'
import { usePlayer, useStore } from '../store'
import { fmtDur } from '../format'
import { Logo, Menu, ReportIcon, SlidesIcon, TranscriptIcon } from './ui'
import { useNavigate } from 'react-router-dom'

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]

export function PlayerBar() {
  const p = usePlayer()
  const { openEvent } = useStore()
  const nav = useNavigate()
  if (!p.eventId) return null
  const ev = eventById(p.eventId)
  if (!ev) return null
  const c = companyById(ev.companyId)
  const chapters = ev.transcript?.chapters ?? [{ title: ev.status === 'live' ? 'Live' : 'Recording', start: 0 }]
  const total = p.isLive ? p.liveEdge : p.duration || ev.durationSec
  const curIdx = Math.max(0, chapters.findLastIndex((ch) => ch.start <= p.pos))
  const behindLive = p.isLive && p.liveEdge - p.pos > 3

  return (
    <div className="player" style={{ ['--tint' as string]: c.color }}>
      <button className="player-id" onClick={() => openEvent(ev.id, 'transcript')}>
        <Logo id={c.id} size={34} />
        <span><b>{c.name}</b><small>{ev.title}</small></span>
      </button>
      <div className="player-mid">
        <div className="player-track" onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          p.seek(((e.clientX - r.left) / r.width) * total)
        }}>
          {chapters.map((ch, i) => {
            const end = chapters[i + 1]?.start ?? total
            const w = ((end - ch.start) / total) * 100
            const fill = Math.max(0, Math.min(1, (p.pos - ch.start) / (end - ch.start))) * 100
            return <span key={i} className="seg" style={{ width: `${w}%` }} title={ch.title}><i style={{ width: `${fill}%` }} /></span>
          })}
        </div>
        <div className="player-meta">
          <Menu trigger={(_o, t) => (
            <button className="player-chapter" onClick={t}>{fmtDur(p.pos)} • {chapters[curIdx].title}<ChevronRight size={13} /></button>
          )}>
            {(close) => chapters.map((ch, i) => (
              <button key={i} className={`menu-item${i === curIdx ? ' cur' : ''}`} onClick={() => { p.seek(ch.start); close() }}>
                <span>{ch.title}</span><span className="muted mono">{fmtDur(ch.start)}</span>
              </button>
            ))}
          </Menu>
          {p.isLive
            ? <button className={`live-pill${behindLive ? '' : ' at-edge'}`} onClick={() => p.seek(p.liveEdge)}><i />{behindLive ? `Back to live (-${fmtDur(p.liveEdge - p.pos)})` : 'LIVE'}</button>
            : <span className="mono muted">-{fmtDur(total - p.pos)}</span>}
        </div>
      </div>
      <div className="player-ctrls">
        <button className="ghost-icon skip" aria-label="Back 15 seconds" onClick={() => p.skip(-15)}><RotateCcw size={20} /><small>15</small></button>
        <button className="ghost-icon big" aria-label={p.playing ? 'Pause' : 'Play'} onClick={p.toggle}>{p.playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</button>
        <button className="ghost-icon skip" aria-label="Forward 15 seconds" onClick={() => p.skip(15)}><RotateCw size={20} /><small>15</small></button>
      </div>
      <div className="player-right">
        {ev.transcript && <button className="text-btn" onClick={() => p.seek(ev.transcript!.qnaStart)}>Q&amp;A</button>}
        <Menu align="right" trigger={(_o, t) => <button className="text-btn mono" onClick={t}>{p.speed.toFixed(p.speed % 1 ? 2 : 1).replace(/0$/, '')}×</button>}>
          {(close) => SPEEDS.map((s) => <button key={s} className="menu-item" onClick={() => { p.setSpeed(s); close() }}><span>{s}×</span></button>)}
        </Menu>
        <button className="ghost-icon" aria-label="Mute" onClick={() => p.setVolume(p.volume ? 0 : 0.8)}>{p.volume ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <span className="player-chips">
          {ev.transcript && <button className="icon-chip" title="Transcript" onClick={() => openEvent(ev.id, 'transcript')}><TranscriptIcon /></button>}
          {ev.slides && <button className="icon-chip" title="Slides" onClick={() => openEvent(ev.id, 'slides')}><SlidesIcon /></button>}
          {ev.reports.length > 0 && <button className="icon-chip" title="Report" onClick={() => openEvent(ev.id, 'report')}><ReportIcon /></button>}
        </span>
        <button className="ghost-icon" aria-label="Event queue" onClick={() => nav('/queue')}><ListEnd size={17} /></button>
        <button className="ghost-icon" aria-label="Close player" onClick={p.close}><X size={17} /></button>
      </div>
    </div>
  )
}
