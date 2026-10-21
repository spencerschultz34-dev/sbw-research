import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { User, SlidersHorizontal, Newspaper, Rss, Terminal, ExternalLink, Tags, LogOut, Menu as MenuIcon, ChevronRight, Copy, Trash2, Globe } from 'lucide-react'
import { useStore } from '../store'
import { IrSourcesSettings } from './IrViews'
import { useAuth } from '../auth'
import { fmtDate } from '../format'
import { Avatar, Modal, Segmented, Select, Toggle } from '../components/ui'

const LANGS = ['English', 'Arabic', 'Bosnian', 'Bulgarian', 'Chinese', 'Czech', 'Danish', 'Dutch', 'Estonian', 'Finnish', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Norwegian', 'Polish', 'Portuguese', 'Spanish', 'Swedish']
const TZS = ['UTC-08:00 - Pacific Time - Los Angeles', 'UTC-06:00 - Mountain Time - Denver', 'UTC-05:00 - Central Time - Chicago', 'UTC-04:00 - Eastern Time - New York', 'UTC+01:00 - London', 'UTC+02:00 - Stockholm']

export function SettingsPage() {
  const { section = 'profile' } = useParams()
  const [side, setSide] = useState(true)
  const store = useStore()
  const [out, setOut] = useState(false)
  const auth = useAuth()
  return (
    <div className="page">
      <div className="page-head"><button className="ghost-icon" aria-label="Toggle settings menu" onClick={() => setSide(!side)}><MenuIcon size={16} /></button><span className="page-title">Settings</span></div>
      <div className={`with-side${side ? '' : ' side-hidden'}`}>
        <aside className="subside">
          <NavLink to="/settings" end className="sub-item"><User size={15} />Profile</NavLink>
          <NavLink to="/settings/preferences" className="sub-item"><SlidersHorizontal size={15} />Preferences</NavLink>
          <NavLink to="/settings/newsletter" className="sub-item"><Newspaper size={15} />Newsletter</NavLink>
          <NavLink to="/settings/press-releases" className="sub-item"><Rss size={15} />Press releases</NavLink>
          <div className="sub-group static">Integrations</div>
          <NavLink to="/settings/investor-relations" className="sub-item"><Globe size={15} />IR pages</NavLink>
          <NavLink to="/settings/mcp" className="sub-item"><Terminal size={15} />MCP server<ExternalLink size={12} className="push-right muted" /></NavLink>
          <div className="sub-group static">Team</div>
          <NavLink to="/settings/labels" className="sub-item"><Tags size={15} />Labels</NavLink>
          <div className="sub-sep" />
          <button className="sub-item muted" onClick={() => setOut(true)}><LogOut size={15} />Logout</button>
        </aside>
        <div className="with-side-main scroll">
          <div className="narrow-col settings">
            {section === 'profile' && <Profile />}
            {section === 'preferences' && <Preferences />}
            {section === 'newsletter' && <Newsletter />}
            {section === 'press-releases' && <PressLangs />}
            {section === 'mcp' && <Mcp />}
            {section === 'investor-relations' && <IrSourcesSettings />}
            {section === 'labels' && <Labels />}
          </div>
        </div>
      </div>
      {out && (
        auth.cloudEnabled ? (
          <Modal title="Log out?" onClose={() => setOut(false)} footer={<>
            <button className="btn btn-quiet" onClick={() => setOut(false)}>Cancel</button>
            <button className="btn btn-light" onClick={() => { auth.signOut() }}>Log out</button>
          </>}>
            <p>Your watchlists, saved items and settings stay in your account for next time.</p>
          </Modal>
        ) : (
          <Modal title="Log out?" onClose={() => setOut(false)} footer={<>
            <button className="btn btn-quiet" onClick={() => setOut(false)}>Cancel</button>
            <button className="btn btn-light" onClick={() => { store.resetDemo(); setOut(false); store.notify('App data reset') }}>Reset app data</button>
          </>}>
            <p>Accounts are not switched on for this copy of the app. You can reset your lists and saved items to how they started instead.</p>
          </Modal>
        )
      )}
    </div>
  )
}

function Row({ label, sub, children, htmlFor }: { label: string; sub?: string; children: React.ReactNode; htmlFor?: string }) {
  return <div className="set-row"><label htmlFor={htmlFor}><span>{label}</span>{sub && <small>{sub}</small>}</label><div className="set-ctl">{children}</div></div>
}

function Profile() {
  const { prefs, set, syncState, notify } = useStore()
  const auth = useAuth()
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const p = (k: keyof typeof prefs) => (v: string) => set('prefs', (x) => ({ ...x, [k]: v }))
  const syncLabel = { local: 'Saved in this browser only', loading: 'Loading your account…', synced: 'Saved to your account', error: 'Could not reach your account, changes are kept in this browser' }[syncState]
  return (
    <>
      <div className="row between"><h2 className="col-title">Profile</h2><span className="muted small">{auth.createdAt ? `User since ${fmtDate(auth.createdAt)}` : syncLabel}</span></div>
      {auth.cloudEnabled && <p className="muted small">{syncLabel}</p>}
      <div className="card set-card">
        <Row label="Profile picture"><Avatar name={`${prefs.firstName} ${prefs.lastName}`} size={32} color="var(--gold)" /></Row>
        <Row label="Full name" htmlFor="first"><input id="first" className="input sm" value={prefs.firstName} onChange={(e) => p('firstName')(e.target.value)} /><input id="last" className="input sm" aria-label="Last name" value={prefs.lastName} onChange={(e) => p('lastName')(e.target.value)} /></Row>
        <Row label="E-mail" htmlFor="email"><input id="email" className="input" value={auth.email ?? "demo@sbw-invest.com"} readOnly /></Row>
        <Row label="Phone" htmlFor="phone"><input id="phone" className="input" placeholder="Enter phone number" value={prefs.phone} onChange={(e) => p('phone')(e.target.value)} /></Row>
        <Row label="Occupation"><Select id="occ" value={prefs.occupation} options={['Buy side', 'Sell side', 'Investor relations', 'Corporate', 'Private investor', 'Other']} onChange={p('occupation')} width={180} /></Row>
      </div>
      <h3 className="sec-title">Contacts</h3>
      <div className="card set-card"><div className="set-row clickable"><span className="row gap8"><Avatar name="Account Team" size={24} /><b>SBW Research support</b><span className="muted">Account team</span></span><ChevronRight size={15} className="muted" /></div></div>
      <div className="card set-card"><Row label="Password"><button className="btn btn-quiet" disabled={!auth.cloudEnabled} title={auth.cloudEnabled ? undefined : 'Accounts are not switched on'} onClick={() => { setPw(''); setPwErr(null); setPwOpen(true) }}>Change password</button></Row></div>
      {pwOpen && (
        <Modal title="Change password" onClose={() => setPwOpen(false)} footer={<>
          <button className="btn btn-quiet" onClick={() => setPwOpen(false)}>Cancel</button>
          <button className="btn btn-light" disabled={pw.length < 8} onClick={async () => { const e = await auth.changePassword(pw); if (e) setPwErr(e); else { setPwOpen(false); notify('Password changed') } }}>Save</button>
        </>}>
          <label className="field-label" htmlFor="new-pw">New password (at least 8 characters)</label>
          <input id="new-pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {pwErr && <p className="auth-msg err">{pwErr}</p>}
        </Modal>
      )}
    </>
  )
}

function Preferences() {
  const { prefs, set } = useStore()
  return (
    <>
      <h2 className="col-title">Preferences</h2>
      <h3 className="sec-title">Time &amp; date</h3>
      <div className="card set-card">
        <Row label="Timezone"><Select id="tz" value={prefs.timezone} options={TZS} onChange={(v) => set('prefs', (x) => ({ ...x, timezone: v }))} width={300} /></Row>
        <Row label="Time format"><Segmented value={prefs.timeFormat} onChange={(v) => set('prefs', (x) => ({ ...x, timeFormat: v }))} options={[{ value: '12', label: '12 hour' }, { value: '24', label: '24 hour' }]} /></Row>
      </div>
      <h3 className="sec-title">Appearance</h3>
      <div className="card set-card">
        <Row label="Theme"><Select id="theme" value={prefs.theme} options={['Dark', 'Light', 'System'] as const} onChange={(v) => set('prefs', (x) => ({ ...x, theme: v }))} width={180} /></Row>
        <Row label="Use pointer cursors" htmlFor="ptr"><Toggle id="ptr" label="Use pointer cursors" on={prefs.pointer} onChange={(v) => set('prefs', (x) => ({ ...x, pointer: v }))} /></Row>
      </div>
      <h3 className="sec-title">Automations</h3>
      <div className="card set-card">
        <Row label="Hide empty automation results" sub="Keep automation runs without findings out of your activity feed." htmlFor="hide-empty"><Toggle id="hide-empty" label="Hide empty automation results" on={prefs.hideEmptyAutomations} onChange={(v) => set('prefs', (x) => ({ ...x, hideEmptyAutomations: v }))} /></Row>
      </div>
    </>
  )
}

function Newsletter() {
  const { prefs, set, watchlists } = useStore()
  const hours = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` }))
  return (
    <>
      <h2 className="col-title">Newsletter</h2>
      <div className="card set-card">
        <Row label="SBW Edge" sub="Every other week: a deep dive into one company we cover." htmlFor="edge"><Toggle id="edge" label="SBW Edge" on={prefs.edge} onChange={(v) => set('prefs', (x) => ({ ...x, edge: v }))} /></Row>
      </div>
      <h3 className="sec-title">Recaps</h3>
      <p className="muted small">Daily or weekly updates from companies you follow.</p>
      <div className="card set-card">
        <Row label="Daily" htmlFor="daily"><Toggle id="daily" label="Daily recap" on={prefs.daily} onChange={(v) => set('prefs', (x) => ({ ...x, daily: v }))} /></Row>
        {prefs.daily && (
          <div className="set-nested">
            <Row label="Watchlists" sub="Only receive recaps for companies in these watchlists."><Select id="recap-wl" value={prefs.recapWatchlist} options={['Followed companies', ...watchlists.map((w) => w.name)]} onChange={(v) => set('prefs', (x) => ({ ...x, recapWatchlist: v }))} width={220} /></Row>
            <Row label="Daily delivery time" sub="Arrives in your inbox at this hour in your local timezone."><Select id="recap-hour" value={String(prefs.deliveryHour)} options={hours} onChange={(v) => set('prefs', (x) => ({ ...x, deliveryHour: Number(v) }))} width={110} /></Row>
          </div>
        )}
        <Row label="Weekly" htmlFor="weekly"><Toggle id="weekly" label="Weekly recap" on={prefs.weekly} onChange={(v) => set('prefs', (x) => ({ ...x, weekly: v }))} /></Row>
      </div>
    </>
  )
}

function PressLangs() {
  const { prefs, set } = useStore()
  return (
    <>
      <h2 className="col-title">Press releases</h2>
      <h3 className="sec-title">Languages</h3>
      <p className="muted small">Only press releases in selected languages will appear in the app or trigger notifications.</p>
      <div className="card set-card">
        {LANGS.map((l) => (
          <label key={l} className="set-row check">
            <input type="checkbox" checked={prefs.languages.includes(l)} onChange={() => set('prefs', (x) => ({ ...x, languages: x.languages.includes(l) ? x.languages.filter((y) => y !== l) : [...x.languages, l] }))} />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </>
  )
}

function Mcp() {
  const { notify } = useStore()
  const url = 'https://mcp.sbw-research.app/v1'
  return (
    <>
      <h2 className="col-title">MCP server</h2>
      <p className="muted">Connect SBW Research to Claude or other AI tools so they can read your transcripts, filings, watchlists and saved items.</p>
      <div className="card set-card">
        <Row label="Server URL"><input id="mcp-url" className="input mono small" readOnly value={url} /><button className="btn btn-quiet" onClick={() => navigator.clipboard?.writeText(url).then(() => notify('Copied'), () => notify('Copy is blocked here'))}><Copy size={13} />Copy</button></Row>
      </div>
      <p className="muted small">Placeholder. The server goes live once the app has a backend and a licensed data source.</p>
    </>
  )
}

function Labels() {
  const { labels, set, workspaces } = useStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  return (
    <>
      <div className="row between"><h2 className="col-title">Team labels</h2><button className="btn btn-light btn-sm" onClick={() => setAdding(true)}>Add label</button></div>
      <div className="table-wrap">
        <table className="data-table bordered">
          <thead><tr><th>Name</th><th>Workspace usage</th><th /></tr></thead>
          <tbody>
            {labels.map((l) => {
              const n = workspaces.filter((w) => w.labels.includes(l)).length
              return <tr key={l}><td>{l}</td><td className="muted">{n ? `${n} workspace${n > 1 ? 's' : ''}` : 'Not used'}</td><td className="right"><button className="ghost-icon" aria-label={`Delete ${l}`} onClick={() => set('labels', (x) => x.filter((y) => y !== l))}><Trash2 size={13} /></button></td></tr>
            })}
          </tbody>
        </table>
      </div>
      {adding && (
        <Modal title="Add label" onClose={() => setAdding(false)} footer={<>
          <button className="btn btn-quiet" onClick={() => setAdding(false)}>Cancel</button>
          <button className="btn btn-light" disabled={!name.trim()} onClick={() => { set('labels', (x) => [...x, name.trim()].sort()); setName(''); setAdding(false) }}>Add label</button>
        </>}>
          <label className="field-label" htmlFor="label-name">Name</label>
          <input id="label-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Model update" />
        </Modal>
      )}
    </>
  )
}
