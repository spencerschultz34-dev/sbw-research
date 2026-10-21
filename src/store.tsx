import { loadCloudState, saveCloudState } from './cloud'
import { useAuth } from './auth'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { EVENTS, eventById, ensureCompanies, ensureTranscript, getVersion, subscribe, TODAY } from './data'
import { DEFAULT_TICKERS, idFor } from './data/companies'
import { audioUrl } from './sec'
import type { Answer } from './chatEngine'

/* ---------- Types ---------- */

export interface Watchlist { id: string; name: string; companyIds: string[] }
export interface Folder { id: string; name: string; shared: boolean }
export interface SavedItem {
  id: string
  type: 'transcript' | 'slide' | 'report'
  eventId: string
  ref: string // paragraph id | slide key | reportId:page
  text?: string
  highlight?: string
  folderId?: string
  savedAt: string
}
export interface WorkspaceBlock { id: string; kind: 'text' | 'saved'; text?: string; savedId?: string }
export interface Workspace {
  id: string; name: string; visibility: 'Private' | 'Team'; labels: string[]; companyTags: string[]
  blocks: WorkspaceBlock[]; team: boolean; updatedAt: string
}
export interface KeywordAlert {
  id: string; keyword: string; scope: 'All companies' | 'Followed companies' | 'Watchlists'; watchlistIds: string[]
  docTypes: ('Transcripts' | 'Slides' | 'Reports')[]; enabled: boolean
}
/** Investor relations source linked to a company. */
export interface IrSource { id: string; ticker: string; cik: number | null; name: string; url: string; addedAt: string }
export interface ChatMessage { role: 'user' | 'assistant'; text: string; scope?: string[]; model?: string; answerId?: string; answer?: Answer; files?: string[]; web?: boolean }
export interface Chat { id: string; title: string; date: string; messages: ChatMessage[]; automationId?: string; unread?: boolean }
export interface Prompt { id: string; name: string; text: string }
export interface Automation {
  id: string; name: string; mode: 'Trigger' | 'Schedule'; scope: string; trigger: string; startDoc: string
  cadence: string; prompt: string; notify: string[]; enabled: boolean; lastRun?: string
}
export interface Prefs {
  theme: 'Dark' | 'Light' | 'System'; timeFormat: '12' | '24'; timezone: string; pointer: boolean; hideEmptyAutomations: boolean
  edge: boolean; daily: boolean; weekly: boolean; recapWatchlist: string; deliveryHour: number; languages: string[]
  firstName: string; lastName: string; phone: string; occupation: string
}

export type PanelTab = 'overview' | 'transcript' | 'slides' | 'report'
export type Panel =
  | { kind: 'event'; eventId: string; tab: PanelTab; focus?: string; nonce?: number }
  | { kind: 'chat' }
  | null

interface AppState {
  dataVersion: number // 2 = real companies; older saved state pointed at the sample companies
  follows: string[]
  watchlists: Watchlist[]
  folders: Folder[]
  saved: SavedItem[]
  workspaces: Workspace[]
  labels: string[]
  alerts: KeywordAlert[]
  chats: Chat[]
  prompts: Prompt[]
  automations: Automation[]
  queue: string[]
  progress: Record<string, number>
  readActivity: string[]
  recentSearches: string[]
  irSources: IrSource[]
  prefs: Prefs
}

const DEFAULT_IDS = DEFAULT_TICKERS.map(([t]) => idFor(t))
const DEFAULT_STATE: AppState = {
  dataVersion: 2,
  follows: DEFAULT_IDS,
  watchlists: [
    { id: 'wl-sbw', name: 'SBW WL', companyIds: DEFAULT_IDS },
    { id: 'wl-staples', name: 'Consumer staples', companyIds: ['ko', 'pep', 'cost'] },
  ],
  folders: [{ id: 'f-ideas', name: 'Ideas', shared: false }],
  saved: [],
  workspaces: [],
  labels: ['Company update', 'Earnings preview', 'Earnings results', 'Idea draft', 'Internal review / meeting', 'Investment case', 'Notes from call', 'Other', 'Portfolio meeting', 'Preparation'],
  alerts: [],
  chats: [],
  prompts: [
    { id: 'pr1', name: 'Earnings delta vs prior quarter', text: 'For @Company, compare the latest earnings call with the prior one. Flag changes in guidance, tone and KPIs in a table.' },
    { id: 'pr2', name: 'Bull and bear points', text: 'List the three strongest bull and bear points for @Company from the latest event, with citations.' },
    { id: 'pr3', name: 'Peer read-through', text: 'What does the latest event from @Company imply for its peers in @Watchlist?' },
  ],
  automations: [],
  queue: [],
  progress: {},
  readActivity: [],
  recentSearches: [],
  irSources: [
    { id: 'ir-aapl', ticker: 'AAPL', cik: 320193, name: 'Apple Inc.', url: 'https://investor.apple.com/investor-relations/default.aspx', addedAt: '2026-10-15T00:00:00Z' },
    { id: 'ir-msft', ticker: 'MSFT', cik: 789019, name: 'Microsoft Corporation', url: 'https://www.microsoft.com/en-us/investor', addedAt: '2026-10-15T00:00:00Z' },
    { id: 'ir-hood', ticker: 'HOOD', cik: 1783879, name: 'Robinhood Markets, Inc.', url: 'https://investors.robinhood.com/financials/quarterly-results', addedAt: '2026-10-21T00:00:00Z' },
  ],
  prefs: {
    theme: 'Dark', timeFormat: '12', timezone: 'UTC-05:00 - Central Time - Chicago', pointer: true, hideEmptyAutomations: true,
    edge: true, daily: true, weekly: false, recapWatchlist: 'Followed companies', deliveryHour: 7, languages: ['English'],
    firstName: 'Spencer', lastName: 'Schultz', phone: '', occupation: 'Buy side',
  },
}

const KEY = 'sbw-research-state-v1'
/** State saved before the switch to real data refers to sample companies: keep the person's settings, drop the rest. */
function migrate(saved: Partial<AppState>): AppState {
  if (saved.dataVersion === DEFAULT_STATE.dataVersion) return { ...DEFAULT_STATE, ...saved }
  const keep = (k: 'prefs' | 'labels' | 'prompts') => saved[k] ?? DEFAULT_STATE[k]
  return { ...DEFAULT_STATE, prefs: { ...DEFAULT_STATE.prefs, ...keep('prefs') as Prefs }, labels: keep('labels') as string[], prompts: keep('prompts') as Prompt[] }
}
function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch { /* storage unavailable */ }
  return DEFAULT_STATE
}

/* ---------- App store ---------- */

interface Store extends AppState {
  set: <K extends keyof AppState>(k: K, v: AppState[K] | ((prev: AppState[K]) => AppState[K])) => void
  panel: Panel
  openEvent: (eventId: string, tab?: PanelTab, focus?: string) => void
  openChatPanel: () => void
  closePanel: () => void
  expanded: boolean
  setExpanded: (v: boolean) => void
  toast: string | null
  notify: (msg: string) => void
  quickOpen: boolean
  setQuickOpen: (v: boolean) => void
  isFollowed: (cid: string) => boolean
  resetDemo: () => void
  dataVersion: number
  syncState: 'local' | 'loading' | 'synced' | 'error'
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load)
  const [panel, setPanel] = useState<Panel>(null)
  const [expanded, setExpanded] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const toastTimer = useRef<number>()
  // Live data arrives after the first render; this re-renders every screen when it does.
  const dataVersion = useSyncExternalStore(subscribe, getVersion)
  const tracked = useMemo(() => [...new Set([...state.follows, ...state.watchlists.flatMap((w) => w.companyIds)])], [state.follows, state.watchlists])
  useEffect(() => { void ensureCompanies(tracked) }, [tracked])

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  // Signed-in users: load their saved state once, then save changes back (debounced).
  const { userId } = useAuth()
  const [syncedFor, setSyncedFor] = useState<string | null>(null)
  const [syncError, setSyncError] = useState(false)
  useEffect(() => {
    if (!userId) { setSyncedFor(null); return }
    let cancelled = false
    loadCloudState(userId)
      .then(async (data) => {
        if (cancelled) return
        if (data) setState(migrate(data as Partial<AppState>))
        else await saveCloudState(userId, state)
        setSyncedFor(userId)
      })
      .catch(() => { if (!cancelled) setSyncError(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
  useEffect(() => {
    if (!userId || syncedFor !== userId) return
    const t = window.setTimeout(() => {
      saveCloudState(userId, state).then(() => setSyncError(false)).catch(() => setSyncError(true))
    }, 1200)
    return () => window.clearTimeout(t)
  }, [state, userId, syncedFor])

  const set: Store['set'] = useCallback((k, v) => {
    setState((s) => ({ ...s, [k]: typeof v === 'function' ? (v as (p: unknown) => unknown)(s[k]) : v }))
  }, [])

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const value: Store = {
    ...state,
    set,
    panel,
    openEvent: (eventId, tab = 'overview', focus) => { setPanel({ kind: 'event', eventId, tab, focus, nonce: Date.now() }) },
    openChatPanel: () => setPanel({ kind: 'chat' }),
    closePanel: () => { setPanel(null); setExpanded(false) },
    expanded, setExpanded,
    toast, notify,
    quickOpen, setQuickOpen,
    isFollowed: (cid) => state.follows.includes(cid),
    dataVersion,
    syncState: !userId ? 'local' : syncError ? 'error' : syncedFor === userId ? 'synced' : 'loading',
    resetDemo: () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } setState(DEFAULT_STATE) },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------- Player (separate context so ticking doesn't re-render the app) ---------- */

interface PlayerState {
  eventId: string | null
  pos: number
  playing: boolean
  speed: number
  volume: number
}
interface PlayerApi extends PlayerState {
  play: (eventId: string, at?: number) => void
  toggle: () => void
  seek: (sec: number) => void
  skip: (delta: number) => void
  setSpeed: (s: number) => void
  setVolume: (v: number) => void
  close: () => void
  duration: number
  isLive: boolean
  liveEdge: number
}
const PCtx = createContext<PlayerApi | null>(null)
export const usePlayer = () => useContext(PCtx)!

export function PlayerProvider({ children }: { children: ReactNode }) {
  const store = useStore()
  const [st, setSt] = useState<PlayerState>({ eventId: null, pos: 0, playing: false, speed: 1, volume: 0.8 })
  const [duration, setDuration] = useState(0)
  const audio = useRef<HTMLAudioElement | null>(null)
  const ev = st.eventId ? eventById(st.eventId) : undefined

  // One audio element for the whole app, streaming the call from /api/calls.
  const el = () => {
    if (!audio.current) {
      const a = new Audio()
      a.preload = 'metadata'
      a.addEventListener('timeupdate', () => setSt((s) => ({ ...s, pos: a.currentTime })))
      a.addEventListener('play', () => setSt((s) => ({ ...s, playing: true })))
      a.addEventListener('pause', () => setSt((s) => ({ ...s, playing: false })))
      a.addEventListener('loadedmetadata', () => { if (Number.isFinite(a.duration)) setDuration(a.duration) })
      a.addEventListener('error', () => { setSt((s) => ({ ...s, playing: false })); store.notify('Audio for this call is not available on the current EarningsCall plan.') })
      audio.current = a
    }
    return audio.current
  }
  useEffect(() => { if (audio.current) { audio.current.playbackRate = st.speed; audio.current.volume = st.volume } }, [st.speed, st.volume])

  // Save listening progress every few seconds
  const lastSaved = useRef(0)
  useEffect(() => {
    if (!st.eventId || Math.abs(st.pos - lastSaved.current) < 5) return
    lastSaved.current = st.pos
    const id = st.eventId
    store.set('progress', (p) => ({ ...p, [id]: Math.floor(st.pos) }))
  }, [st.pos, st.eventId]) // eslint-disable-line

  const total = duration || ev?.durationSec || 0
  const api = useMemo<PlayerApi>(() => ({
    ...st,
    duration: total, isLive: false, liveEdge: 0,
    play: (eventId, at) => {
      const e = eventById(eventId)
      if (!e?.call) return
      void ensureTranscript(eventId)
      const a = el()
      const src = audioUrl(e.call.symbol, e.call.exchange, e.call.year, e.call.quarter)
      const start = at ?? store.progress[eventId] ?? 0
      if (!a.src.endsWith(src)) { a.src = src; setDuration(0) }
      a.currentTime = start
      a.playbackRate = st.speed
      setSt((s) => ({ ...s, eventId, pos: start }))
      a.play().catch(() => setSt((s) => ({ ...s, playing: false })))
    },
    toggle: () => { const a = audio.current; if (!a) return; if (a.paused) void a.play().catch(() => {}); else a.pause() },
    seek: (sec) => { const a = audio.current; if (a) a.currentTime = Math.max(0, Math.min(sec, total || sec)) },
    skip: (d) => { const a = audio.current; if (a) a.currentTime = Math.max(0, Math.min(a.currentTime + d, total || a.currentTime + d)) },
    setSpeed: (speed) => setSt((s) => ({ ...s, speed })),
    setVolume: (volume) => setSt((s) => ({ ...s, volume })),
    close: () => { audio.current?.pause(); setSt((s) => ({ ...s, eventId: null, playing: false })) },
  }), [st, total, store.progress]) // eslint-disable-line

  return <PCtx.Provider value={api}>{children}</PCtx.Provider>
}

/* ---------- Helpers ---------- */

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`
export { TODAY, EVENTS }
