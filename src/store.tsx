import { loadCloudState, saveCloudState } from './cloud'
import { useAuth } from './auth'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EVENTS, eventById, LIVE_OFFSET_SEC, TODAY } from './data'
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
  prefs: Prefs
}

const DEFAULT_STATE: AppState = {
  follows: ['nwb', 'hbw', 'mrdb', 'virc', 'pncr', 'tslp', 'strc', 'aurs', 'clde', 'ardi', 'brwu', 'qnt'],
  watchlists: [
    { id: 'wl-sbw', name: 'SBW WL', companyIds: ['nwb', 'hbw', 'mrdb', 'virc', 'pncr', 'tslp', 'kstl', 'hlxt', 'solf', 'orbt'] },
    { id: 'wl-staples', name: 'Consumer staples peers', companyIds: ['nwb', 'hbw', 'virc', 'solf'] },
  ],
  folders: [{ id: 'f-ideas', name: 'Q4 ideas', shared: false }, { id: 'f-team', name: 'Team: consumer', shared: true }],
  saved: [
    { id: 's1', type: 'transcript', eventId: 'orbt-gscc', ref: 'orbt-gscc-p3', highlight: 'This was a quarter of disciplined execution.', savedAt: '2026-09-19T14:00:00Z' },
    { id: 's2', type: 'transcript', eventId: 'nwb-q32026', ref: 'p15', highlight: 'On productivity, yes, we\'re on track for $1.5 billion this year', folderId: 'f-ideas', savedAt: '2026-10-08T16:00:00Z' },
    { id: 's3', type: 'transcript', eventId: 'nwb-q32026', ref: 'p12', savedAt: '2026-10-08T15:40:00Z' },
    { id: 's4', type: 'slide', eventId: 'nwb-q32026', ref: 'capex', savedAt: '2026-10-08T15:20:00Z' },
    { id: 's5', type: 'report', eventId: 'nwb-q32026', ref: 'nwb-q3-er:1', savedAt: '2026-10-08T15:10:00Z' },
  ],
  workspaces: [
    { id: 'w1', name: 'Northwind: Q3 2026 notes', visibility: 'Private', labels: ['Notes from call'], companyTags: ['nwb'], team: false, updatedAt: '2026-10-08T17:00:00Z',
      blocks: [
        { id: 'b1', kind: 'text', text: 'Organic growth re-accelerated to 3.1%. North America snacks still the swing factor; mgmt not calling a recovery yet.' },
        { id: 'b2', kind: 'saved', savedId: 's3' },
        { id: 'b3', kind: 'text', text: 'Follow-up: check pack-architecture read-through for Harbor Wholesale and Vireo.' },
      ] },
    { id: 'w2', name: 'Consumer staples: earnings preview', visibility: 'Team', labels: ['Earnings preview'], companyTags: ['virc', 'hbw'], team: true, updatedAt: '2026-10-05T12:00:00Z', blocks: [{ id: 'b1', kind: 'text', text: 'Key questions for Vireo AGM and Harbor October sales.' }] },
  ],
  labels: ['Company update', 'Earnings preview', 'Earnings results', 'Idea draft', 'Internal review / meeting', 'Investment case', 'Notes from call', 'Other', 'Portfolio meeting', 'Preparation'],
  alerts: [
    { id: 'k1', keyword: 'truck-to-rail conversion', scope: 'All companies', watchlistIds: [], docTypes: ['Transcripts', 'Slides', 'Reports'], enabled: true },
    { id: 'k2', keyword: 'pack architecture', scope: 'Watchlists', watchlistIds: ['wl-sbw'], docTypes: ['Transcripts'], enabled: true },
    { id: 'k3', keyword: '"orbital compute"', scope: 'All companies', watchlistIds: [], docTypes: ['Transcripts', 'Slides'], enabled: true },
  ],
  chats: [
    { id: 'c-auto', title: 'Watchlist earnings transcript changes', date: '2026-10-13T11:00:00Z', unread: true, automationId: 'a1',
      messages: [{ role: 'user', text: 'Summarize what changed versus the prior event for each company in @SBW WL that reported since the last run.' }, { role: 'assistant', text: '', answerId: 'auto' }] },
    { id: 'c1', title: 'Northwind North America snacks recovery', date: '2026-10-08T18:00:00Z', messages: [{ role: 'user', text: 'What did @Northwind Beverages say about the North America snacks recovery?', scope: ['nwb'] }, { role: 'assistant', text: '', answerId: 'company:nwb' }] },
    { id: 'c2', title: 'Pinecrest truck-to-rail conversion outlook', date: '2026-09-29T15:00:00Z', messages: [{ role: 'user', text: 'Truck-to-rail conversion outlook at @Pinecrest Rail', scope: ['pncr'] }, { role: 'assistant', text: '', answerId: 'company:pncr' }] },
    { id: 'c3', title: 'Stratus Cloud RPO conversion', date: '2026-09-28T15:00:00Z', messages: [{ role: 'user', text: 'Stratus Cloud remaining performance obligations conversion expectations', scope: ['strc'] }, { role: 'assistant', text: '', answerId: 'company:strc' }] },
  ],
  prompts: [
    { id: 'pr1', name: 'Earnings delta vs prior quarter', text: 'For @Company, compare the latest earnings call with the prior one. Flag changes in guidance, tone and KPIs in a table.' },
    { id: 'pr2', name: 'Bull and bear points', text: 'List the three strongest bull and bear points for @Company from the latest event, with citations.' },
    { id: 'pr3', name: 'Peer read-through', text: 'What does the latest event from @Company imply for its peers in @Watchlist?' },
  ],
  automations: [
    { id: 'a1', name: 'Watchlist earnings transcript changes', mode: 'Trigger', scope: 'SBW WL', trigger: 'Earnings calls', startDoc: 'Transcript', cadence: '', prompt: 'Flag what changed versus the prior event in language, tone and KPIs.', notify: ['Chat', 'Activity feed', 'Email'], enabled: true, lastRun: '2026-10-13T11:00:00Z' },
    { id: 'a2', name: 'Weekly staples read-through', mode: 'Schedule', scope: 'Consumer staples peers', trigger: '', startDoc: '', cadence: 'Weekly', prompt: 'Since the last run, summarize commentary across the watchlist and assess read-throughs to our positions.', notify: ['Chat'], enabled: false },
  ],
  queue: ['nwb-q32026', 'hbw-msu-september'],
  progress: { 'pncr-rail': 900, 'strc-q22026': 2000, 'orbt-gscc': 400, 'hbw-q4fy26': 1300 },
  readActivity: [],
  recentSearches: ['pack architecture', 'truck-to-rail conversion', 'cyber security', 'orbital compute', 'net interest income'],
  prefs: {
    theme: 'Dark', timeFormat: '12', timezone: 'UTC-05:00 - Central Time - Chicago', pointer: true, hideEmptyAutomations: true,
    edge: true, daily: true, weekly: false, recapWatchlist: 'Followed companies', deliveryHour: 7, languages: ['English'],
    firstName: 'Spencer', lastName: 'Schultz', phone: '', occupation: 'Buy side',
  },
}

const KEY = 'sbw-research-state-v1'
function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) }
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
        if (data) setState({ ...DEFAULT_STATE, ...(data as Partial<AppState>) })
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
  const [liveEdge, setLiveEdge] = useState(LIVE_OFFSET_SEC)
  const ev = st.eventId ? eventById(st.eventId) : undefined
  const isLive = ev?.status === 'live'
  const duration = isLive ? liveEdge : ev?.durationSec ?? 0

  useEffect(() => {
    const id = window.setInterval(() => setLiveEdge((x) => x + 0.5), 500)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!st.playing) return
    const id = window.setInterval(() => {
      setSt((s) => {
        const e = s.eventId ? eventById(s.eventId) : undefined
        if (!e) return s
        const live = e.status === 'live'
        let pos = s.pos + 0.25 * s.speed
        let speed = s.speed
        const end = live ? liveEdge : e.durationSec
        if (pos >= end) {
          pos = end
          if (live) speed = 1 // catching up to live resets speed
          else return { ...s, pos, playing: false }
        }
        return { ...s, pos, speed }
      })
    }, 250)
    return () => window.clearInterval(id)
  }, [st.playing, liveEdge])

  // Save listening progress every few seconds
  const lastSaved = useRef(0)
  useEffect(() => {
    if (!st.eventId || Math.abs(st.pos - lastSaved.current) < 5) return
    lastSaved.current = st.pos
    const id = st.eventId
    store.set('progress', (p) => ({ ...p, [id]: Math.floor(st.pos) }))
  }, [st.pos, st.eventId]) // eslint-disable-line

  const api = useMemo<PlayerApi>(() => ({
    ...st,
    duration, isLive, liveEdge,
    play: (eventId, at) => {
      const e = eventById(eventId)
      const start = at ?? (e?.status === 'live' ? LIVE_OFFSET_SEC : store.progress[eventId] ?? 0)
      setSt((s) => ({ ...s, eventId, pos: start, playing: true, speed: e?.status === 'live' ? 1 : s.speed }))
    },
    toggle: () => setSt((s) => ({ ...s, playing: !s.playing })),
    seek: (sec) => setSt((s) => ({ ...s, pos: Math.max(0, Math.min(sec, duration)) })),
    skip: (d) => setSt((s) => ({ ...s, pos: Math.max(0, Math.min(s.pos + d, duration)) })),
    setSpeed: (speed) => setSt((s) => ({ ...s, speed })),
    setVolume: (volume) => setSt((s) => ({ ...s, volume })),
    close: () => setSt((s) => ({ ...s, eventId: null, playing: false })),
  }), [st, duration, isLive, liveEdge, store.progress])

  return <PCtx.Provider value={api}>{children}</PCtx.Provider>
}

/* ---------- Helpers ---------- */

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`
export { TODAY, EVENTS }
