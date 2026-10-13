import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlayerProvider, StoreProvider } from './store'
import { Shell } from './components/Shell'
import { Home } from './pages/Home'
import { CompanyPage } from './pages/Company'
import { CalendarPage } from './pages/Calendar'
import { SearchPage } from './pages/Search'
import { ChatPage } from './pages/Chat'
import { SavedPage } from './pages/Saved'
import { WorkspacesPage } from './pages/Workspaces'
import { WatchlistsPage } from './pages/Watchlists'
import { AlertsPage } from './pages/Alerts'
import { SettingsPage } from './pages/Settings'
import { HelpPage, QueuePage, ReleaseNotesPage } from './pages/Misc'

declare const __ARTIFACT__: boolean
// The hosted app uses hash URLs so it works on any static host; the Claude preview keeps routing in memory.
const Router = __ARTIFACT__ ? MemoryRouter : HashRouter

export function App() {
  return (
    <StoreProvider>
      <PlayerProvider>
        <Router>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="chat/:id" element={<ChatPage />} />
              <Route path="saved" element={<SavedPage />} />
              <Route path="saved/:folder" element={<SavedPage />} />
              <Route path="workspaces" element={<WorkspacesPage />} />
              <Route path="workspaces/:id" element={<WorkspacesPage />} />
              <Route path="watchlists" element={<WatchlistsPage />} />
              <Route path="watchlists/:id" element={<WatchlistsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="company/:id" element={<CompanyPage />} />
              <Route path="company/:id/:tab" element={<CompanyPage />} />
              <Route path="queue" element={<QueuePage />} />
              <Route path="release-notes" element={<ReleaseNotesPage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/:section" element={<SettingsPage />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </Router>
      </PlayerProvider>
    </StoreProvider>
  )
}
