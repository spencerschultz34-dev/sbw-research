import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { Plus, Search, Menu as MenuIcon, ChevronDown, Check, Users } from 'lucide-react'
import { eventById } from '../data'
import { companyById } from '../data/companies'
import { uid, useStore, type SavedItem } from '../store'
import { fmtDate, relAge } from '../format'
import { Avatar, Empty, Logo, Menu, Modal, Toggle } from '../components/ui'
import { PaperPage, SlideView } from '../components/visuals'

export function SavedPage() {
  const { folder = 'mine' } = useParams()
  const store = useStore()
  const [side, setSide] = useState(true)
  const [find, setFind] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [onlyHl, setOnlyHl] = useState(false)
  const [sort, setSort] = useState<'Newest first' | 'Oldest first'>('Newest first')
  const [newFolder, setNewFolder] = useState(false)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const cur = store.folders.find((f) => f.id === folder)
  const title = folder === 'all' ? 'All saved items' : folder === 'mine' ? 'My items' : cur?.name ?? 'Folder'
  const items = store.saved
    .filter((s) => (folder === 'all' || folder === 'mine' ? true : s.folderId === folder))
    .sort((a, b) => (sort === 'Newest first' ? b.savedAt.localeCompare(a.savedAt) : a.savedAt.localeCompare(b.savedAt)))
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const move = (fid: string, copy: boolean) => {
    store.set('saved', (ss) => (copy
      ? [...ss, ...ss.filter((s) => sel.includes(s.id)).map((s) => ({ ...s, id: uid('s'), folderId: fid }))]
      : ss.map((s) => (sel.includes(s.id) ? { ...s, folderId: fid } : s))))
    store.notify(`${sel.length} item${sel.length > 1 ? 's' : ''} ${copy ? 'copied' : 'moved'}`)
    setSel([])
  }
  const col = (type: SavedItem['type'], label: string) => {
    const list = items.filter((s) => s.type === type && (type !== 'transcript' || !onlyHl || s.highlight))
    return (
      <div className="saved-col">
        <div className="saved-col-head"><b>{label}</b>{type === 'transcript' && <label className="row gap6 small muted">Only highlights<Toggle on={onlyHl} onChange={setOnlyHl} label="Only highlights" /></label>}</div>
        <div className="saved-col-body">
          {list.length === 0 && <div className="empty small">No {label.toLowerCase()} saved</div>}
          {list.map((s) => <SavedCard key={s.id} s={s} checked={sel.includes(s.id)} onCheck={() => toggle(s.id)} />)}
        </div>
      </div>
    )
  }
  return (
    <div className="page">
      <div className="page-head">
        <button className="ghost-icon" aria-label="Toggle folders" onClick={() => setSide(!side)}><MenuIcon size={16} /></button>
        <span className="page-title">Saved</span><span className="crumb-sub">{title}</span>
        <span className="grow" />
        <button className="btn btn-quiet btn-sm" onClick={() => setSel(sel.length === items.length ? [] : items.map((i) => i.id))}>{sel.length === items.length && items.length ? 'Clear' : 'Select all'}</button>
        {(['Copy to', 'Move to'] as const).map((a) => (
          <Menu key={a} align="right" width={220} trigger={(_o, t) => <button className="btn btn-quiet btn-sm" disabled={!sel.length} onClick={t}>{a}</button>}>
            {(close) => store.folders.map((f) => <button key={f.id} className="menu-item" onClick={() => { move(f.id, a === 'Copy to'); close() }}><span>{f.name}</span></button>)}
          </Menu>
        ))}
        <button className="btn btn-quiet btn-sm" disabled={!sel.length} onClick={() => { store.set('saved', (ss) => ss.filter((s) => !sel.includes(s.id))); store.notify(`${sel.length} deleted`); setSel([]) }}>Delete</button>
        <Menu align="right" trigger={(_o, t) => <button className="text-btn" onClick={t}>{sort}<ChevronDown size={14} /></button>}>
          {(close) => (['Newest first', 'Oldest first'] as const).map((s) => <button key={s} className="menu-item" onClick={() => { setSort(s); close() }}><span>{s}</span>{s === sort && <Check size={14} />}</button>)}
        </Menu>
      </div>
      <div className={`with-side${side ? '' : ' side-hidden'}`}>
        <aside className="subside">
          <button className="sub-item" onClick={() => setNewFolder(true)}><Plus size={15} />New folder</button>
          <div className="sub-sep" />
          <div className="find"><Search size={14} /><input id="find-folders" placeholder="Find folders" value={find} onChange={(e) => setFind(e.target.value)} /></div>
          <div className="sub-group static">Browse</div>
          <NavLink to="/saved/all" className="sub-chat">All saved items</NavLink>
          <NavLink to="/saved" end className="sub-chat">My items</NavLink>
          <div className="sub-group static">Folders</div>
          {store.folders.filter((f) => f.name.toLowerCase().includes(find.toLowerCase())).map((f) => (
            <NavLink key={f.id} to={`/saved/${f.id}`} className="sub-chat"><span className="trunc">{f.name}</span>{f.shared && <Users size={13} className="muted" />}<em className="count">{store.saved.filter((s) => s.folderId === f.id).length}</em></NavLink>
          ))}
        </aside>
        <div className="with-side-main saved-grid">
          {col('transcript', 'Transcripts')}
          {col('slide', 'Slides')}
          {col('report', 'Reports')}
        </div>
      </div>
      {newFolder && (
        <Modal title="New folder" onClose={() => setNewFolder(false)} footer={<>
          <button className="btn btn-quiet" onClick={() => setNewFolder(false)}>Cancel</button>
          <button className="btn btn-light" disabled={!name.trim()} onClick={() => { store.set('folders', (f) => [...f, { id: uid('f'), name: name.trim(), shared }]); setNewFolder(false); setName(''); store.notify('Folder created') }}>Create folder</button>
        </>}>
          <label className="field-label" htmlFor="folder-name">Name</label>
          <input id="folder-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pricing commentary" />
          <label className="check-row"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />Share with my team</label>
        </Modal>
      )}
    </div>
  )
}

export function SavedCard({ s, checked, onCheck, embed }: { s: SavedItem; checked?: boolean; onCheck?: () => void; embed?: boolean }) {
  const store = useStore()
  const ev = eventById(s.eventId)
  if (!ev) return null
  const c = companyById(ev.companyId)
  const open = () => store.openEvent(ev.id, s.type === 'slide' ? 'slides' : s.type, s.ref)
  let body: React.ReactNode = null
  let speaker: React.ReactNode = null
  if (s.type === 'transcript') {
    const p = ev.transcript?.paragraphs.find((x) => x.id === s.ref)
    if (p) {
      const sp = ev.transcript!.speakers[p.speaker]
      const i = s.highlight ? p.text.indexOf(s.highlight) : -1
      body = <p className="clamp4">{i >= 0 ? <>{p.text.slice(0, i)}<mark className="hl">{s.highlight}</mark>{p.text.slice(i + s.highlight!.length)}</> : s.highlight ? <mark className="hl">{s.highlight}</mark> : p.text}</p>
      speaker = <span className="speaker-chip"><Avatar name={sp.name} size={18} />{sp.name}{sp.role && `, ${sp.role.split(',')[0].replace('Chief Executive Officer', 'CEO').replace('Chief Financial Officer', 'CFO')}`}</span>
    }
  } else if (s.type === 'slide') {
    const sl = ev.slides?.find((x) => x.key === s.ref)
    if (sl) body = <SlideView slide={sl} companyId={c.id} />
  } else {
    const [rid, pg] = s.ref.split(':')
    const r = ev.reports.find((x) => x.id === rid)
    if (r) body = <div className="saved-paper"><div className="thumb-scale big"><PaperPage page={r.pages[+pg] ?? r.pages[0]} companyId={c.id} /></div><span className="muted small">{r.title}{r.form ? ` (${r.form})` : ''} · page {+pg + 1}</span></div>
  }
  return (
    <div className={`card saved-card${checked ? ' checked' : ''}${embed ? ' embed' : ''}`}>
      {!embed && (
        <div className="row between">
          <input type="checkbox" aria-label="Select" checked={!!checked} onChange={onCheck} />
          <span className="row gap6 muted small"><Avatar name="Spencer Schultz" size={18} color="var(--gold)" />{relAge(s.savedAt)}</span>
        </div>
      )}
      <div className="clickable" onClick={open}>{body}</div>
      {speaker}
      <div className="row gap6 small saved-foot"><Logo id={c.id} size={16} /><span className="trunc"><b>{c.name}</b> › {ev.title}</span><span className="grow" /><span className="muted nowrap">{fmtDate(ev.date)}</span></div>
    </div>
  )
}

export { Empty }
