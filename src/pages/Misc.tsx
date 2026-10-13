import { ArrowDown, ArrowUp, Play, Pause, X } from 'lucide-react'
import { eventById, RELEASE_NOTES } from '../data'
import { companyById } from '../data/companies'
import { usePlayer, useStore } from '../store'
import { fmtDate, fmtDur } from '../format'
import { Empty, Logo } from '../components/ui'

export function QueuePage() {
  const store = useStore()
  const player = usePlayer()
  const move = (i: number, d: number) => store.set('queue', (q) => { const n = [...q]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); return n })
  return (
    <div className="page">
      <div className="page-head"><span className="page-title">Event queue</span><span className="muted">{store.queue.length} event{store.queue.length === 1 ? '' : 's'}</span></div>
      <div className="page-scroll">
        <div className="narrow-col">
          <p className="muted">Calls you add with the queue button play here one after another.</p>
          {store.queue.length === 0 && <Empty>Your queue is empty. Use the queue button on any event to add it.</Empty>}
          {store.queue.map((id, i) => {
            const ev = eventById(id)
            if (!ev) return null
            const playing = player.eventId === id && player.playing
            const prog = store.progress[id] ?? 0
            return (
              <div key={id} className="card queue-row">
                <span className="mono muted">{i + 1}</span>
                <Logo id={ev.companyId} size={32} />
                <div className="grow min0 clickable" onClick={() => store.openEvent(id, 'transcript')}><b className="trunc block">{companyById(ev.companyId).name}</b><small className="muted">{ev.title} · {fmtDate(ev.date)} · {fmtDur(ev.durationSec - prog)} left</small></div>
                <button className="ghost-icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                <button className="ghost-icon" aria-label="Move down" disabled={i === store.queue.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                <button className="play-btn" aria-label={playing ? 'Pause' : 'Play'} onClick={() => (playing ? player.toggle() : player.play(id))}>{playing ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}</button>
                <button className="ghost-icon" aria-label="Remove" onClick={() => store.set('queue', (q) => q.filter((x) => x !== id))}><X size={14} /></button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ReleaseNotesPage() {
  return (
    <div className="page">
      <div className="page-head"><span className="page-title">Release notes</span></div>
      <div className="page-scroll"><div className="narrow-col">
        {RELEASE_NOTES.map((n) => (
          <article key={n.title} className="note">
            <span className="muted small mono">{n.date}</span>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
          </article>
        ))}
      </div></div>
    </div>
  )
}

export function HelpPage() {
  const tips: [string, string][] = [
    ['Open anything fast', 'Press Ctrl K (Cmd K on Mac) to jump to a company, an event, a page or an action.'],
    ['Listen without leaving your work', 'Press play on any event. The player stays at the bottom while you browse. Use Q&A to jump straight to questions, and change speed from 0.75× to 2×.'],
    ['Read and listen side by side', 'Events open in a panel next to the page you are on. Use the expand button to go full width.'],
    ['Search exact phrases', 'Wrap a phrase in quotes, for example "free cash flow per share", to match it word for word.'],
    ['Scope AI chat', 'Type @ in chat to limit a question to a company or watchlist, and / to use a saved prompt.'],
    ['Save what matters', 'Select text in a transcript to highlight it, or use the bookmark on a paragraph, slide or report page. Everything lands in Saved.'],
  ]
  return (
    <div className="page">
      <div className="page-head"><span className="page-title">Help &amp; support</span></div>
      <div className="page-scroll"><div className="narrow-col">
        <p className="muted">This is a working prototype with fictional sample companies. Questions or feedback: reply in the project thread.</p>
        {tips.map(([t, b]) => <div key={t} className="card pad"><b>{t}</b><p className="muted">{b}</p></div>)}
      </div></div>
    </div>
  )
}
