import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Check, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { EVENTS } from '../data'
import { companyById } from '../data/companies'
import { uid, useStore, type KeywordAlert } from '../store'
import { fmtDate, fmtStamp } from '../format'
import { Avatar, Empty, Logo, Menu, Modal, Toggle, Highlight } from '../components/ui'

const EMPTY: KeywordAlert = { id: '', keyword: '', scope: 'Followed companies', watchlistIds: [], docTypes: ['Transcripts', 'Slides', 'Reports'], enabled: true }

export function AlertsPage() {
  const store = useStore()
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState<KeywordAlert | null>(null)
  const [active, setActive] = useState<string | null>(store.alerts[0]?.id ?? null)
  const [wlFilter, setWlFilter] = useState<string>('all')
  useEffect(() => { if (params.get('new')) { setEdit({ ...EMPTY }); setParams({}, { replace: true }) } }, []) // eslint-disable-line

  const hitsFor = (a: KeywordAlert) => {
    const term = a.keyword.replace(/^"|"$/g, '').toLowerCase()
    const allowed = a.scope === 'All companies' ? null : a.scope === 'Followed companies' ? store.follows : store.watchlists.filter((w) => a.watchlistIds.includes(w.id)).flatMap((w) => w.companyIds)
    const wl = wlFilter === 'all' ? null : store.watchlists.find((w) => w.id === wlFilter)?.companyIds ?? store.follows
    const out: { ev: typeof EVENTS[number]; pid?: string; text: string; speaker?: string; start?: number; where: string }[] = []
    for (const ev of EVENTS) {
      if (ev.status === 'upcoming') continue
      if (allowed && !allowed.includes(ev.companyId)) continue
      if (wl && !wl.includes(ev.companyId)) continue
      if (a.docTypes.includes('Transcripts')) ev.transcript?.paragraphs.forEach((p) => { if (p.text.toLowerCase().includes(term)) out.push({ ev, pid: p.id, text: p.text, speaker: ev.transcript!.speakers[p.speaker].name, start: p.start, where: 'Transcript' }) })
      if (a.docTypes.includes('Slides')) ev.slides?.forEach((s) => { if ([s.title, ...(s.bullets ?? [])].join(' ').toLowerCase().includes(term)) out.push({ ev, text: s.title, where: 'Slides' }) })
    }
    return out
  }
  const cur = store.alerts.find((a) => a.id === active)
  const hits = useMemo(() => (cur ? hitsFor(cur) : []), [cur, wlFilter, store.follows, store.watchlists]) // eslint-disable-line

  return (
    <div className="page">
      <div className="page-head">
        <span className="page-title">Keyword alerts</span>
        <span className="grow" />
        <Menu align="right" width={230} trigger={(_o, t) => <button className="text-btn" onClick={t}>{wlFilter === 'all' ? 'All watchlists' : wlFilter === 'followed' ? 'Followed companies' : store.watchlists.find((w) => w.id === wlFilter)?.name}<ChevronDown size={14} /></button>}>
          {(close) => [{ id: 'all', name: 'All watchlists' }, { id: 'followed', name: 'Followed companies' }, ...store.watchlists].map((w) => <button key={w.id} className="menu-item" onClick={() => { setWlFilter(w.id); close() }}><span>{w.name}</span>{wlFilter === w.id && <Check size={14} />}</button>)}
        </Menu>
        <button className="btn btn-light btn-sm" onClick={() => setEdit({ ...EMPTY })}><Plus size={14} />New alert</button>
      </div>
      <div className="alerts">
        <div className="alerts-list">
          {store.alerts.length === 0 && <Empty>Add a keyword to get notified when it is said or written.</Empty>}
          {store.alerts.map((a) => (
            <div key={a.id} className={`card alert-card clickable${a.id === active ? ' on' : ''}`} onClick={() => setActive(a.id)}>
              <div className="row between">
                <b className="trunc">{a.keyword}</b>
                <span onClick={(e) => e.stopPropagation()}><Toggle on={a.enabled} label={`${a.keyword} alerts`} onChange={(v) => store.set('alerts', (as) => as.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)))} /></span>
              </div>
              <div className="muted small">{a.scope === 'Watchlists' ? store.watchlists.filter((w) => a.watchlistIds.includes(w.id)).map((w) => w.name).join(', ') : a.scope} · {a.docTypes.join(', ')}</div>
              <div className="row between small"><span className="chip">{hitsFor(a).length} mentions</span>
                <span className="row gap6">
                  <button className="text-btn small" onClick={(e) => { e.stopPropagation(); setEdit(a) }}>Edit</button>
                  <button className="ghost-icon" aria-label="Delete alert" onClick={(e) => { e.stopPropagation(); store.set('alerts', (as) => as.filter((x) => x.id !== a.id)) }}><Trash2 size={13} /></button>
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="alerts-hits">
          {cur && <h3 className="sec-title">Mentions of “{cur.keyword.replace(/"/g, '')}”</h3>}
          {cur && hits.length === 0 && <Empty>No mentions yet. You will be notified the moment it is said or written.</Empty>}
          {hits.map((h, i) => (
            <div key={i} className="card pad result clickable" onClick={() => store.openEvent(h.ev.id, h.where === 'Slides' ? 'slides' : 'transcript', h.pid)}>
              <div className="row gap8 wrap"><Logo id={h.ev.companyId} size={20} /><b>{companyById(h.ev.companyId).name}</b><ChevronRight size={13} className="muted" /><span>{h.ev.title}</span><span className="muted small">{fmtDate(h.ev.date)}</span><span className="grow" /><span className="chip">{h.where}</span>{h.start !== undefined && <span className="mono small muted">{fmtStamp(h.start)}</span>}</div>
              <p><Highlight text={h.text} q={cur!.keyword} /></p>
              {h.speaker && <span className="speaker-chip"><Avatar name={h.speaker} size={18} />{h.speaker}</span>}
            </div>
          ))}
        </div>
      </div>
      {edit && (
        <Modal title={edit.id ? 'Edit keyword alert' : 'New keyword alert'} onClose={() => setEdit(null)} footer={<>
          <button className="btn btn-quiet" onClick={() => setEdit(null)}>Cancel</button>
          <button className="btn btn-light" disabled={!edit.keyword.trim() || !edit.docTypes.length} onClick={() => {
            const a = { ...edit, keyword: edit.keyword.trim(), id: edit.id || uid('k') }
            store.set('alerts', (as) => (edit.id ? as.map((x) => (x.id === edit.id ? a : x)) : [a, ...as]))
            setActive(a.id); setEdit(null); store.notify('Alert saved')
          }}>Save alert</button>
        </>}>
          <label className="field-label" htmlFor="kw">Keyword or phrase</label>
          <input id="kw" className="input" autoFocus value={edit.keyword} placeholder='e.g. pricing power, "free cash flow per share"' onChange={(e) => setEdit({ ...edit, keyword: e.target.value })} />
          <label className="field-label">Companies</label>
          <div className="row gap6 wrap">{(['Followed companies', 'Watchlists', 'All companies'] as const).map((s) => <button key={s} className={`fchip${edit.scope === s ? ' on' : ''}`} onClick={() => setEdit({ ...edit, scope: s })}>{s}</button>)}</div>
          {edit.scope === 'Watchlists' && <div className="row gap6 wrap">{store.watchlists.map((w) => <label key={w.id} className="check-row"><input type="checkbox" checked={edit.watchlistIds.includes(w.id)} onChange={() => setEdit({ ...edit, watchlistIds: edit.watchlistIds.includes(w.id) ? edit.watchlistIds.filter((x) => x !== w.id) : [...edit.watchlistIds, w.id] })} />{w.name}</label>)}</div>}
          <label className="field-label">Look in</label>
          <div className="row gap10 wrap">{(['Transcripts', 'Slides', 'Reports'] as const).map((d) => <label key={d} className="check-row"><input type="checkbox" checked={edit.docTypes.includes(d)} onChange={() => setEdit({ ...edit, docTypes: edit.docTypes.includes(d) ? edit.docTypes.filter((x) => x !== d) : [...edit.docTypes, d] })} />{d}</label>)}</div>
          <p className="muted small">Notifications appear in your activity feed and on mobile.</p>
        </Modal>
      )}
    </div>
  )
}
