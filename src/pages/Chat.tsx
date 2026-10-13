import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  SquarePen, CircleSlash, Workflow, Search, ChevronDown, Menu as MenuIcon, Plus, AtSign, ArrowUp, Globe, X, Paperclip, Check, Copy, Table2, Trash2, Play, Sparkle,
} from 'lucide-react'
import { COMPANIES, eventById, TODAY } from '../data'
import { companyById } from '../data/companies'
import { answer, automationAnswer, type Answer } from '../chatEngine'
import { uid, useStore, type Automation, type Chat, type ChatMessage, type Prompt } from '../store'
import { fmtDateShort } from '../format'
import { Empty, Logo, Menu, Modal, Segmented, Toggle } from '../components/ui'

const MODELS = ['Sonnet 5.5', 'Opus 5.5', 'GPT-5', 'Gemini 3 Pro']

/* ---------- Page with secondary sidebar ---------- */

export function ChatPage() {
  const { id } = useParams()
  const store = useStore()
  const nav = useNavigate()
  const [side, setSide] = useState(true)
  const [find, setFind] = useState('')
  const chats = store.chats.filter((c) => c.title.toLowerCase().includes(find.toLowerCase()))
  const auto = chats.filter((c) => c.automationId)
  const normal = chats.filter((c) => !c.automationId).sort((a, b) => b.date.localeCompare(a.date))
  const groups = useMemo(() => {
    const g = new Map<string, Chat[]>()
    normal.forEach((c) => { const k = fmtDateShort(c.date); g.set(k, [...(g.get(k) ?? []), c]) })
    return [...g.entries()]
  }, [normal])
  const [autoOpen, setAutoOpen] = useState(true)
  useEffect(() => { if (id && id !== 'prompts' && id !== 'automations' && !store.chats.some((c) => c.id === id)) nav('/chat', { replace: true }) }, [id]) // eslint-disable-line

  let main: React.ReactNode
  if (id === 'prompts') main = <PromptsView />
  else if (id === 'automations') main = <AutomationsView />
  else main = <ChatThread key={id ?? 'new'} chatId={id} />

  return (
    <div className="page">
      <div className="page-head">
        <button className="ghost-icon" aria-label="Toggle chat list" onClick={() => setSide(!side)}><MenuIcon size={16} /></button>
        <span className="page-title">Chat</span>
        {id === 'prompts' && <span className="crumb-sub">Prompts</span>}
        {id === 'automations' && <span className="crumb-sub">Automations</span>}
      </div>
      <div className={`with-side${side ? '' : ' side-hidden'}`}>
        <aside className="subside">
          <NavLink to="/chat" end className="sub-item"><SquarePen size={15} />New chat</NavLink>
          <NavLink to="/chat/prompts" className="sub-item"><CircleSlash size={15} />Prompts</NavLink>
          <NavLink to="/chat/automations" className="sub-item"><Workflow size={15} />Automations</NavLink>
          <div className="sub-sep" />
          <div className="find"><Search size={14} /><input id="find-chats" placeholder="Find chats" value={find} onChange={(e) => setFind(e.target.value)} /></div>
          <div className="sub-scroll">
            <button className="sub-group" onClick={() => setAutoOpen(!autoOpen)}>Automations<ChevronDown size={12} className={autoOpen ? '' : 'rot'} /></button>
            {autoOpen && auto.map((c) => (
              <NavLink key={c.id} to={`/chat/${c.id}`} className="sub-chat" onClick={() => store.set('chats', (cs) => cs.map((x) => (x.id === c.id ? { ...x, unread: false } : x)))}>
                <span className="trunc">{c.title}</span>{c.unread && <i className="dot-unread" />}
              </NavLink>
            ))}
            {groups.map(([day, list]) => (
              <div key={day}>
                <div className="sub-group static">{day}</div>
                {list.map((c) => <NavLink key={c.id} to={`/chat/${c.id}`} className="sub-chat"><span className="trunc">{c.title}</span></NavLink>)}
              </div>
            ))}
            {chats.length === 0 && <div className="muted small pad8">No chats match.</div>}
          </div>
        </aside>
        <div className="with-side-main">{main}</div>
      </div>
    </div>
  )
}

/* ---------- Thread ---------- */

function resolveAnswer(m: ChatMessage, store: ReturnType<typeof useStore>): Answer | undefined {
  if (m.answer) return m.answer
  if (m.answerId === 'auto') return automationAnswer(store.watchlists.find((w) => w.id === 'wl-sbw')?.companyIds ?? [])
  if (m.answerId?.startsWith('company:')) return answer(store.chats.flatMap((c) => c.messages).find((x) => x.role === 'user' && x.scope?.includes(m.answerId!.slice(8)))?.text ?? '', [m.answerId.slice(8)])
  return undefined
}

export function ChatThread({ chatId, compact }: { chatId?: string; compact?: boolean }) {
  const store = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [localId, setLocalId] = useState<string | undefined>(chatId)
  const chat = store.chats.find((c) => c.id === localId)
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [chat?.messages.length, thinking])

  const initialScope = params.get('scope') ? [params.get('scope')!] : store.panel?.kind === 'event' ? [eventById(store.panel.eventId)!.companyId] : []

  const send = (text: string, scope: string[], model: string, web: boolean, files: string[], wl: string[]) => {
    const user: ChatMessage = { role: 'user', text, scope, model, web, files }
    let id = localId
    if (!chat) {
      id = uid('c')
      const title = text.replace(/@/g, '').slice(0, 60)
      store.set('chats', (cs) => [{ id: id!, title, date: TODAY.toISOString(), messages: [user] }, ...cs])
      setLocalId(id)
      if (!compact) nav(`/chat/${id}`, { replace: true })
    } else {
      store.set('chats', (cs) => cs.map((c) => (c.id === id ? { ...c, messages: [...c.messages, user] } : c)))
    }
    setThinking(true)
    const wlIds = wl.flatMap((w) => store.watchlists.find((x) => x.id === w)?.companyIds ?? (w === 'followed' ? store.follows : []))
    window.setTimeout(() => {
      const a = answer(text, scope, wlIds)
      store.set('chats', (cs) => cs.map((c) => (c.id === id ? { ...c, messages: [...c.messages, { role: 'assistant' as const, text: '', answer: a }] } : c)))
      setThinking(false)
    }, 900)
  }

  const msgs = chat?.messages ?? []
  return (
    <div className={`thread${compact ? ' compact' : ''}${msgs.length ? '' : ' empty-thread'}`}>
      {msgs.length > 0 && (
        <div className="thread-scroll">
          <div className="thread-inner">
            {msgs.map((m, i) => (m.role === 'user'
              ? <div key={i} className="msg-user"><div className="bubble">{renderMentions(m.text)}{m.files?.length ? <div className="row gap6 wrap">{m.files.map((f) => <span key={f} className="chip"><Paperclip size={12} />{f}</span>)}</div> : null}</div></div>
              : <AnswerView key={i} a={resolveAnswer(m, store)} onFollow={(t) => send(t, msgs[i - 1]?.scope ?? [], msgs[i - 1]?.model ?? MODELS[0], false, [], [])} />))}
            {(thinking || msgs[msgs.length - 1]?.role === 'user') && <div className="thinking"><Sparkle size={14} /><span>Reading transcripts, slides and filings…</span></div>}
            <div ref={endRef} />
          </div>
        </div>
      )}
      <div className="composer-wrap">
        {!msgs.length && !compact && <h2 className="composer-hello">What do you want to know?</h2>}
        <Composer onSend={send} initialScope={initialScope} initialText={params.get('prompt') ?? ''} compact={compact} prefill={!chat?.messages.length} />
        <div className="disclaimer">AI can get things wrong. Verify important information.</div>
      </div>
    </div>
  )
}

function renderMentions(text: string) {
  return text.split(/(@[A-Z][\w&.]*(?: [A-Z][\w&.]*)*)/).map((p, i) => (p.startsWith('@') ? <span key={i} className="mention">{p}</span> : p))
}

function AnswerView({ a, onFollow }: { a?: Answer; onFollow: (t: string) => void }) {
  const store = useStore()
  if (!a) return null
  const open = (n: number) => {
    const c = a.cites.find((x) => x.n === n)
    if (c) store.openEvent(c.eventId, c.tab, c.ref)
  }
  const Cites = ({ ns }: { ns?: number[] }) => <>{ns?.map((n) => <button key={n} className="cite" onClick={() => open(n)}>{n}</button>)}</>
  const tableToTsv = (b: Extract<Answer['blocks'][number], { t: 'table' }>) => [b.head, ...b.rows].map((r) => r.join('\t')).join('\n')
  return (
    <div className="msg-ai">
      {a.blocks.map((b, i) => {
        if (b.t === 'h') return <h3 key={i}>{b.text}</h3>
        if (b.t === 'p') return <p key={i}>{b.text} <Cites ns={b.cites} /></p>
        if (b.t === 'ul') return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it.text} <Cites ns={it.cites} /></li>)}</ul>
        return (
          <div key={i} className="ai-table">
            <div className="table-wrap">
              <table className="num-table left">
                <thead><tr>{b.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, k) => <tr key={k}>{r.map((cell, j) => {
                  const m = cell.match(/^(.*) \[(\d+)\]$/)
                  return <td key={j}>{m ? <>{m[1]} <button className="cite" onClick={() => open(+m[2])}>{m[2]}</button></> : cell}</td>
                })}</tr>)}</tbody>
              </table>
            </div>
            <Menu align="right" trigger={(_o, t) => <button className="text-btn small" onClick={t}><Table2 size={13} />Export<ChevronDown size={12} /></button>}>
              {(close) => (
                <>
                  <button className="menu-item" onClick={() => { navigator.clipboard?.writeText(tableToTsv(b)).then(() => store.notify('Copied. Paste into Excel.'), () => store.notify('Copy is blocked here')); close() }}><span>Copy for Excel</span></button>
                  <button className="menu-item" onClick={() => { store.notify('Downloads work in the hosted version of the app'); close() }}><span>Download .xlsx</span></button>
                </>
              )}
            </Menu>
          </div>
        )
      })}
      {a.cites.length > 0 && (
        <div className="sources">
          <div className="muted small">Sources</div>
          <div className="source-list">
            {a.cites.map((c) => (
              <button key={c.n} className="source" onClick={() => open(c.n)}>
                <span className="cite">{c.n}</span><Logo id={eventById(c.eventId)!.companyId} size={16} /><span className="trunc">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="row gap6 wrap followups">
        {a.followups.map((f) => <button key={f} className="fchip" onClick={() => onFollow(f)}>{f}</button>)}
      </div>
      <div className="row gap6 ai-actions">
        <button className="ghost-icon" title="Copy answer" onClick={() => navigator.clipboard?.writeText(a.blocks.map((b) => (b.t === 'ul' ? b.items.map((x) => `- ${x.text}`).join('\n') : b.t === 'table' ? b.rows.map((r) => r.join(' | ')).join('\n') : b.text)).join('\n\n')).then(() => store.notify('Answer copied'), () => store.notify('Copy is blocked here'))}><Copy size={14} /></button>
        <button className="text-btn small" onClick={() => store.notify('PDF export works in the hosted version of the app')}>Export chat as PDF</button>
      </div>
    </div>
  )
}

/* ---------- Composer with @, / and model picker ---------- */

function Composer({ onSend, initialScope, initialText, compact, prefill = true }: { prefill?: boolean; onSend: (t: string, scope: string[], model: string, web: boolean, files: string[], wl: string[]) => void; initialScope: string[]; initialText: string; compact?: boolean }) {
  const store = useStore()
  const [text, setText] = useState(initialText || (prefill && initialScope.length ? `@${companyById(initialScope[0]).name} ` : ''))
  const [scope, setScope] = useState<string[]>(initialScope)
  const [wl, setWl] = useState<string[]>([])
  const [model, setModel] = useState(MODELS[0])
  const [web, setWeb] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [picker, setPicker] = useState<null | 'at' | 'slash'>(null)
  const [pq, setPq] = useState('')
  const ta = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const placeholder = compact ? 'Ask about this event or any company' : "Provide an overview of Northwind Beverages' main business segments."

  const insertMention = (label: string) => {
    setText((t) => t.replace(/@[\w ]*$/, '') + `@${label} `)
    setPicker(null); setPq('')
    ta.current?.focus()
  }
  const submit = () => {
    const t = text.trim() || placeholder
    onSend(t, scope, model, web, files, wl)
    setText(''); setFiles([]); setPicker(null)
  }
  const atOptions = [
    ...store.watchlists.map((w) => ({ id: w.id, label: w.name, kind: 'Watchlist' as const })),
    ...COMPANIES.map((c) => ({ id: c.id, label: c.name, kind: 'Company' as const })),
  ].filter((o) => o.label.toLowerCase().includes(pq.toLowerCase())).slice(0, 8)
  const slashOptions = store.prompts.filter((p) => p.name.toLowerCase().includes(pq.toLowerCase()))

  return (
    <div className="composer">
      {(scope.length > 0 || wl.length > 0) && (
        <div className="row gap6 wrap scope-row">
          {scope.map((s) => <span key={s} className="chip"><Logo id={s} size={14} />{companyById(s).name}<button aria-label="Remove" onClick={() => setScope(scope.filter((x) => x !== s))}><X size={11} /></button></span>)}
          {wl.map((w) => <span key={w} className="chip">{store.watchlists.find((x) => x.id === w)?.name}<button aria-label="Remove" onClick={() => setWl(wl.filter((x) => x !== w))}><X size={11} /></button></span>)}
        </div>
      )}
      <textarea id={compact ? 'composer-panel' : 'composer'} ref={ta} rows={compact ? 2 : 2} value={text} placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          const at = v.match(/@([\w ]{0,20})$/)
          const sl = v.match(/(^|\s)\/(\w*)$/)
          if (at) { setPicker('at'); setPq(at[1]) } else if (sl) { setPicker('slash'); setPq(sl[2]) } else if (picker) setPicker(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (picker === 'at' && atOptions[0]) pick(atOptions[0]); else if (picker === 'slash' && slashOptions[0]) applyPrompt(slashOptions[0]); else submit() }
          if (e.key === 'Escape') setPicker(null)
        }} />
      {files.length > 0 && <div className="row gap6 wrap">{files.map((f) => <span key={f} className="chip"><Paperclip size={12} />{f}<button aria-label="Remove" onClick={() => setFiles(files.filter((x) => x !== f))}><X size={11} /></button></span>)}</div>}
      <div className="composer-bar">
        <button className="ghost-icon" title="Attach files" onClick={() => fileRef.current?.click()}><Plus size={16} /></button>
        <input ref={fileRef} type="file" multiple hidden accept=".pdf,.xlsx,.xls,.docx,.doc,.pptx,.png,.jpg,.jpeg" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? []).map((f) => f.name)]); e.target.value = '' }} />
        <button className={`ghost-icon${picker === 'at' ? ' on' : ''}`} title="Scope to a company or watchlist" onClick={() => { setText((t) => t + (t.endsWith(' ') || !t ? '@' : ' @')); setPicker('at'); setPq(''); ta.current?.focus() }}><AtSign size={16} /></button>
        <button className={`ghost-icon${picker === 'slash' ? ' on' : ''}`} title="Saved prompts" onClick={() => { setPicker(picker === 'slash' ? null : 'slash'); setPq('') }}><CircleSlash size={16} /></button>
        <button className={`ghost-icon${web ? ' on' : ''}`} title={web ? 'Web results on' : 'Include web results'} onClick={() => setWeb(!web)}><Globe size={16} /></button>
        <span className="grow" />
        <Menu align="right" width={190} trigger={(_o, t) => <button className="text-btn model" onClick={t}><Sparkle size={13} className="accent" />{model}<ChevronDown size={13} /></button>}>
          {(close) => MODELS.map((m) => <button key={m} className="menu-item" onClick={() => { setModel(m); close() }}><span>{m}</span>{m === model && <Check size={14} />}</button>)}
        </Menu>
        <button className="send" aria-label="Send" onClick={submit}><ArrowUp size={16} /></button>
      </div>
      {picker && (
        <div className="picker">
          {picker === 'at' ? (
            <>
              <div className="menu-label">Scope to</div>
              {atOptions.map((o) => <button key={o.kind + o.id} className="menu-item" onMouseDown={(e) => { e.preventDefault(); pick(o) }}>
                <span className="row gap8">{o.kind === 'Company' ? <Logo id={o.id} size={16} /> : <span className="wl-glyph">W</span>}{o.label}</span><span className="muted small">{o.kind}</span></button>)}
            </>
          ) : (
            <>
              <div className="menu-label">Saved prompts</div>
              {slashOptions.map((p) => <button key={p.id} className="menu-item" onMouseDown={(e) => { e.preventDefault(); applyPrompt(p) }}><span>{p.name}</span></button>)}
              {slashOptions.length === 0 && <div className="muted small pad8">No saved prompts match.</div>}
            </>
          )}
        </div>
      )}
    </div>
  )
  function pick(o: { id: string; label: string; kind: 'Company' | 'Watchlist' }) {
    if (o.kind === 'Company') setScope((s) => [...new Set([...s, o.id])]); else setWl((w) => [...new Set([...w, o.id])])
    insertMention(o.label)
  }
  function applyPrompt(p: Prompt) {
    setText(p.text.replace('@Company', scope[0] ? `@${companyById(scope[0]).name}` : '@Company'))
    setPicker(null)
    ta.current?.focus()
  }
}

/* ---------- Side-panel chat (floating Chat button / ✧ icons) ---------- */

export function ChatPanel() {
  const store = useStore()
  const [chatId, setChatId] = useState<string | undefined>()
  return (
    <div className="event-panel">
      <div className="ep-head">
        <Sparkle size={16} className="accent" /><span className="crumb">Chat</span>
        <span className="grow" />
        <button className="ghost-icon" title="New chat" onClick={() => setChatId(uid('new'))}><SquarePen size={15} /></button>
        <button className="ghost-icon" title="Close" onClick={store.closePanel}><X size={17} /></button>
      </div>
      <ChatThread key={chatId ?? 'panel'} compact />
    </div>
  )
}

/* ---------- Prompts ---------- */

function PromptsView() {
  const store = useStore()
  const nav = useNavigate()
  const [edit, setEdit] = useState<Prompt | null>(null)
  return (
    <div className="narrow-col pad-top">
      <div className="row between"><h2 className="col-title">Prompts</h2><button className="btn btn-light" onClick={() => setEdit({ id: '', name: '', text: '' })}><Plus size={14} />New prompt</button></div>
      <p className="muted">Save prompts you use often. Type / in any chat to insert one. Use @Company or @Watchlist as placeholders.</p>
      {store.prompts.map((p) => (
        <div key={p.id} className="card pad prompt-card">
          <div className="row between"><b>{p.name}</b>
            <span className="row gap6">
              <button className="btn btn-quiet btn-sm" onClick={() => nav(`/chat?prompt=${encodeURIComponent(p.text)}`)}><Play size={12} />Use</button>
              <button className="btn btn-quiet btn-sm" onClick={() => setEdit(p)}>Edit</button>
              <button className="ghost-icon" aria-label="Delete" onClick={() => store.set('prompts', (ps) => ps.filter((x) => x.id !== p.id))}><Trash2 size={14} /></button>
            </span>
          </div>
          <p className="muted">{renderMentions(p.text)}</p>
        </div>
      ))}
      {store.prompts.length === 0 && <Empty>No saved prompts yet.</Empty>}
      {edit && (
        <Modal title={edit.id ? 'Edit prompt' : 'New prompt'} onClose={() => setEdit(null)} footer={
          <><button className="btn btn-quiet" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn btn-light" disabled={!edit.name.trim() || !edit.text.trim()} onClick={() => {
              store.set('prompts', (ps) => (edit.id ? ps.map((x) => (x.id === edit.id ? edit : x)) : [...ps, { ...edit, id: uid('pr') }]))
              setEdit(null); store.notify('Prompt saved')
            }}>Save prompt</button></>
        }>
          <label className="field-label" htmlFor="prompt-name">Name</label>
          <input id="prompt-name" className="input" value={edit.name} placeholder="e.g. Guidance changes vs prior quarter" onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <label className="field-label" htmlFor="prompt-text">Prompt</label>
          <textarea id="prompt-text" className="input" rows={5} value={edit.text} placeholder="For @Company, compare…" onChange={(e) => setEdit({ ...edit, text: e.target.value })} />
        </Modal>
      )}
    </div>
  )
}

/* ---------- Automations ---------- */

const EMPTY_AUTO: Automation = { id: '', name: '', mode: 'Trigger', scope: 'SBW WL', trigger: 'Earnings calls', startDoc: 'Transcript', cadence: 'Weekly', prompt: '', notify: ['Chat'], enabled: true }

function AutomationsView() {
  const store = useStore()
  const nav = useNavigate()
  const [edit, setEdit] = useState<Automation | null>(null)
  const [step, setStep] = useState(0)
  const scopes = [...store.watchlists.map((w) => w.name), ...COMPANIES.map((c) => c.name)]
  const runNow = (a: Automation) => {
    const id = uid('c')
    const wl = store.watchlists.find((w) => w.name === a.scope)?.companyIds ?? COMPANIES.filter((c) => c.name === a.scope).map((c) => c.id)
    store.set('chats', (cs) => [{ id, title: a.name, date: TODAY.toISOString(), automationId: a.id, unread: true, messages: [{ role: 'user' as const, text: a.prompt }, { role: 'assistant' as const, text: '', answer: automationAnswer(wl) }] }, ...cs])
    store.set('automations', (as) => as.map((x) => (x.id === a.id ? { ...x, lastRun: TODAY.toISOString() } : x)))
    nav(`/chat/${id}`)
  }
  const steps = ['Run mode', 'Scope', edit?.mode === 'Schedule' ? 'Cadence' : 'Trigger', 'Prompt', 'Notifications']
  return (
    <div className="narrow-col wide pad-top">
      <div className="row between"><h2 className="col-title">Automations</h2><button className="btn btn-light" onClick={() => { setEdit({ ...EMPTY_AUTO }); setStep(0) }}><Plus size={14} />New automation</button></div>
      <p className="muted">A saved prompt that runs when a company publishes or on a schedule. Results arrive in Chat, even when you are logged out.</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Scope</th><th>Runs</th><th>Last run</th><th>On</th><th /></tr></thead>
          <tbody>
            {store.automations.map((a) => (
              <tr key={a.id}>
                <td><b>{a.name}</b></td>
                <td>{a.scope}</td>
                <td>{a.mode === 'Trigger' ? `When ${a.trigger.toLowerCase()} publish (${a.startDoc.toLowerCase()})` : a.cadence}</td>
                <td className="nowrap">{a.lastRun ? fmtDateShort(a.lastRun) : 'Never'}</td>
                <td><Toggle on={a.enabled} label={`${a.name} on`} onChange={(v) => store.set('automations', (as) => as.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)))} /></td>
                <td className="right nowrap">
                  <button className="btn btn-quiet btn-sm" onClick={() => runNow(a)}>Run now</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => { setEdit(a); setStep(0) }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? 'Edit automation' : 'New automation'} width={560} onClose={() => setEdit(null)} footer={
          <>
            <span className="muted small grow">Step {step + 1} of {steps.length}: {steps[step]}</span>
            {step > 0 && <button className="btn btn-quiet" onClick={() => setStep(step - 1)}>Back</button>}
            {step < steps.length - 1
              ? <button className="btn btn-light" onClick={() => setStep(step + 1)}>Next</button>
              : <button className="btn btn-light" disabled={!edit.prompt.trim()} onClick={() => {
                const name = edit.name.trim() || edit.prompt.slice(0, 40)
                store.set('automations', (as) => (edit.id ? as.map((x) => (x.id === edit.id ? { ...edit, name } : x)) : [...as, { ...edit, name, id: uid('a') }]))
                setEdit(null); store.notify('Automation saved')
              }}>Save automation</button>}
          </>
        }>
          <div className="stepper">{steps.map((s, i) => <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</span>)}</div>
          {step === 0 && (
            <div className="choice-grid">
              {(['Trigger', 'Schedule'] as const).map((m) => (
                <button key={m} className={`choice${edit.mode === m ? ' on' : ''}`} onClick={() => setEdit({ ...edit, mode: m })}>
                  <b>{m === 'Trigger' ? 'When new material is published' : 'On a schedule'}</b>
                  <span className="muted small">{m === 'Trigger' ? 'Runs as soon as a document or event is available.' : 'Runs daily, weekly or monthly for a read over a period.'}</span>
                </button>
              ))}
            </div>
          )}
          {step === 1 && (
            <>
              <label className="field-label">Company or watchlist</label>
              <div className="row gap6 wrap">{scopes.map((s) => <button key={s} className={`fchip${edit.scope === s ? ' on' : ''}`} onClick={() => setEdit({ ...edit, scope: s })}>{s}</button>)}</div>
            </>
          )}
          {step === 2 && edit.mode === 'Trigger' && (
            <>
              <label className="field-label">Event type</label>
              <div className="row gap6 wrap">{['Any event', 'Earnings calls', 'Conferences', 'Capital markets days'].map((s) => <button key={s} className={`fchip${edit.trigger === s ? ' on' : ''}`} onClick={() => setEdit({ ...edit, trigger: s })}>{s}</button>)}</div>
              <label className="field-label">Start when this is published</label>
              <div className="row gap6 wrap">{['First document', 'Transcript', 'Slide presentation', 'Report'].map((s) => <button key={s} className={`fchip${edit.startDoc === s ? ' on' : ''}`} onClick={() => setEdit({ ...edit, startDoc: s })}>{s}</button>)}</div>
            </>
          )}
          {step === 2 && edit.mode === 'Schedule' && (
            <>
              <label className="field-label">Cadence</label>
              <Segmented value={edit.cadence || 'Weekly'} onChange={(v) => setEdit({ ...edit, cadence: v })} options={['Daily', 'Weekly', 'Monthly'].map((v) => ({ value: v, label: v }))} />
              <p className="muted small">Scheduled runs cover a period. Say the lookback in your prompt, for example “Since the last run”.</p>
            </>
          )}
          {step === 3 && (
            <>
              <label className="field-label" htmlFor="auto-name">Name</label>
              <input id="auto-name" className="input" value={edit.name} placeholder="e.g. Earnings deltas for my holdings" onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <label className="field-label" htmlFor="auto-prompt">Prompt</label>
              <textarea id="auto-prompt" className="input" rows={5} value={edit.prompt} placeholder="Flag what changed versus the prior event in language, tone and KPIs." onChange={(e) => setEdit({ ...edit, prompt: e.target.value })} />
              <ul className="tips"><li>Start with a verb: summarize, compare, flag, extract.</li><li>Keep one theme per automation.</li><li>Ask for a format if you want one: table, bullets or chart.</li></ul>
            </>
          )}
          {step === 4 && (
            <>
              <label className="field-label">Where results go</label>
              {['Chat', 'Activity feed', 'Email', 'Mobile push'].map((n) => (
                <label key={n} className="check-row">
                  <input type="checkbox" checked={edit.notify.includes(n)} disabled={n === 'Chat'} onChange={() => setEdit({ ...edit, notify: edit.notify.includes(n) ? edit.notify.filter((x) => x !== n) : [...edit.notify, n] })} />
                  {n}{n === 'Chat' && <span className="muted small"> (always)</span>}
                </label>
              ))}
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
