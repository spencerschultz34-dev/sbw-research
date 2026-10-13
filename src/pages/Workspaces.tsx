import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { Plus, Search, Menu as MenuIcon, ChevronDown, Check, Sparkle, EllipsisVertical, X, Bookmark, Type, GripVertical, Trash2 } from 'lucide-react'
import { COMPANIES, TODAY } from '../data'
import { companyById } from '../data/companies'
import { uid, useStore, type Workspace } from '../store'
import { Avatar, Logo, Menu, Modal, Select } from '../components/ui'
import { SavedCard } from './Saved'

export function WorkspacesPage() {
  const { id } = useParams()
  const store = useStore()
  const nav = useNavigate()
  const [side, setSide] = useState(true)
  const [find, setFind] = useState('')
  const [openMine, setOpenMine] = useState(true)
  const [openTeam, setOpenTeam] = useState(true)
  const ws = store.workspaces.find((w) => w.id === id) ?? store.workspaces[0]
  useEffect(() => { if (!id && store.workspaces[0]) nav(`/workspaces/${store.workspaces[0].id}`, { replace: true }) }, [id]) // eslint-disable-line
  const create = () => {
    const w: Workspace = { id: uid('w'), name: 'Untitled workspace', visibility: 'Private', labels: [], companyTags: [], team: false, updatedAt: TODAY.toISOString(), blocks: [{ id: uid('b'), kind: 'text', text: '' }] }
    store.set('workspaces', (x) => [w, ...x])
    nav(`/workspaces/${w.id}`)
  }
  const list = (team: boolean) => store.workspaces.filter((w) => w.team === team && w.name.toLowerCase().includes(find.toLowerCase()))
  return (
    <div className="page">
      <div className="page-head">
        <button className="ghost-icon" aria-label="Toggle list" onClick={() => setSide(!side)}><MenuIcon size={16} /></button>
        <span className="page-title">Workspaces</span>{ws && <span className="crumb-sub trunc">{ws.name}</span>}
        <span className="grow" />
        {ws && <><Check size={15} className="muted" /><span className="chip small">Saved</span>
          <button className="ghost-icon" title="Ask AI about this workspace" onClick={() => store.openChatPanel()}><Sparkle size={16} /></button>
          <Menu align="right" trigger={(_o, t) => <button className="ghost-icon" aria-label="More" onClick={t}><EllipsisVertical size={16} /></button>}>
            {(close) => (
              <>
                <button className="menu-item" onClick={() => { const copy = { ...ws, id: uid('w'), name: `${ws.name} (copy)` }; store.set('workspaces', (x) => [copy, ...x]); nav(`/workspaces/${copy.id}`); close() }}><span>Duplicate</span></button>
                <button className="menu-item danger" onClick={() => { store.set('workspaces', (x) => x.filter((w) => w.id !== ws.id)); nav('/workspaces'); close() }}><span>Delete workspace</span></button>
              </>
            )}
          </Menu></>}
      </div>
      <div className={`with-side${side ? '' : ' side-hidden'}`}>
        <aside className="subside">
          <button className="sub-item" onClick={create}><Plus size={15} />New workspace</button>
          <div className="sub-sep" />
          <div className="find"><Search size={14} /><input id="find-ws" placeholder="Find workspaces" value={find} onChange={(e) => setFind(e.target.value)} /></div>
          <button className="sub-group" onClick={() => setOpenMine(!openMine)}>My workspaces<ChevronDown size={12} className={openMine ? '' : 'rot'} /></button>
          {openMine && list(false).map((w) => <NavLink key={w.id} to={`/workspaces/${w.id}`} className="sub-chat"><span className="trunc">{w.name}</span></NavLink>)}
          <button className="sub-group" onClick={() => setOpenTeam(!openTeam)}>Team workspaces<ChevronDown size={12} className={openTeam ? '' : 'rot'} /></button>
          {openTeam && list(true).map((w) => <NavLink key={w.id} to={`/workspaces/${w.id}`} className="sub-chat"><span className="trunc">{w.name}</span></NavLink>)}
        </aside>
        <div className="with-side-main">{ws ? <Editor key={ws.id} ws={ws} /> : <div className="empty">Create a workspace to collect notes, transcript snippets and slides.</div>}</div>
      </div>
    </div>
  )
}

function Editor({ ws }: { ws: Workspace }) {
  const store = useStore()
  const [addSaved, setAddSaved] = useState(false)
  const [drag, setDrag] = useState<string | null>(null)
  const update = (patch: Partial<Workspace>) => store.set('workspaces', (x) => x.map((w) => (w.id === ws.id ? { ...w, ...patch, updatedAt: TODAY.toISOString() } : w)))
  const setBlocks = (blocks: Workspace['blocks']) => update({ blocks })
  return (
    <div className="ws">
      <div className="ws-doc">
        <input id="ws-title" className="ws-title" value={ws.name} onChange={(e) => update({ name: e.target.value })} aria-label="Workspace title" />
        {ws.blocks.map((b, i) => (
          <div key={b.id} className={`ws-block${drag === b.id ? ' dragging' : ''}`} draggable onDragStart={() => setDrag(b.id)} onDragEnd={() => setDrag(null)}
            onDragOver={(e) => { e.preventDefault(); if (!drag || drag === b.id) return; const from = ws.blocks.findIndex((x) => x.id === drag); const nb = [...ws.blocks]; const [m] = nb.splice(from, 1); nb.splice(i, 0, m); setBlocks(nb) }}>
            <span className="ws-grip" title="Drag to reorder"><GripVertical size={14} /></span>
            {b.kind === 'text'
              ? <textarea id={`blk-${b.id}`} className="ws-text" rows={Math.max(2, Math.ceil((b.text?.length ?? 0) / 80))} placeholder="Write notes, or add a saved snippet below…" value={b.text} onChange={(e) => setBlocks(ws.blocks.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))} />
              : (() => { const s = store.saved.find((x) => x.id === b.savedId); return s ? <SavedCard s={s} embed /> : <div className="muted small">This saved item was deleted.</div> })()}
            <button className="ghost-icon ws-del" aria-label="Remove block" onClick={() => setBlocks(ws.blocks.filter((x) => x.id !== b.id))}><Trash2 size={13} /></button>
          </div>
        ))}
        <div className="row gap8 ws-add">
          <button className="btn btn-quiet btn-sm" onClick={() => setBlocks([...ws.blocks, { id: uid('b'), kind: 'text', text: '' }])}><Type size={14} />Add text</button>
          <button className="btn btn-quiet btn-sm" onClick={() => setAddSaved(true)}><Bookmark size={14} />Add from Saved</button>
        </div>
      </div>
      <aside className="ws-meta">
        <div className="card pad">
          <div className="meta-label">Visibility</div>
          <Select id="ws-visibility" value={ws.visibility} options={['Private', 'Team'] as const} onChange={(v) => update({ visibility: v, team: v === 'Team' })} width={200} />
        </div>
        <div className="card pad">
          <div className="meta-label">Labels</div>
          <div className="row gap6 wrap">
            {ws.labels.map((l) => <span key={l} className="chip">{l}<button aria-label="Remove label" onClick={() => update({ labels: ws.labels.filter((x) => x !== l) })}><X size={11} /></button></span>)}
            <Menu width={230} trigger={(_o, t) => <button className="chip chip-add" onClick={t}><Plus size={12} />Add label</button>}>
              {(close) => <div className="menu-scroll">{store.labels.filter((l) => !ws.labels.includes(l)).map((l) => <button key={l} className="menu-item" onClick={() => { update({ labels: [...ws.labels, l] }); close() }}><span>{l}</span></button>)}</div>}
            </Menu>
          </div>
          <div className="meta-label">Company tags</div>
          <div className="row gap6 wrap">
            {ws.companyTags.map((c) => <span key={c} className="chip"><Logo id={c} size={14} />{companyById(c).name}<button aria-label="Remove company" onClick={() => update({ companyTags: ws.companyTags.filter((x) => x !== c) })}><X size={11} /></button></span>)}
            <Menu width={250} trigger={(_o, t) => <button className="text-btn small" onClick={t}><Plus size={13} />Add company</button>}>
              {(close) => <div className="menu-scroll">{COMPANIES.filter((c) => !ws.companyTags.includes(c.id)).map((c) => <button key={c.id} className="menu-item" onClick={() => { update({ companyTags: [...ws.companyTags, c.id] }); close() }}><span className="row gap8"><Logo id={c.id} size={16} />{c.name}</span></button>)}</div>}
            </Menu>
          </div>
        </div>
        <div className="card pad">
          <div className="meta-label">Owner</div>
          <div className="row gap8"><Avatar name="Spencer Schultz" size={24} color="var(--gold)" /><b>{store.prefs.firstName} {store.prefs.lastName}</b></div>
        </div>
      </aside>
      {addSaved && (
        <Modal title="Add from Saved" width={560} onClose={() => setAddSaved(false)}>
          <div className="pick-saved">
            {store.saved.map((s) => (
              <div key={s.id} role="button" tabIndex={0} className="pick-saved-row" onClickCapture={(e) => { e.stopPropagation(); setBlocks([...ws.blocks, { id: uid('b'), kind: 'saved', savedId: s.id }]); setAddSaved(false) }}>
                <SavedCard s={s} embed />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
