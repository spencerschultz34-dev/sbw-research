# SBW Research

A research workspace for listed companies: earnings calendar, live and recorded calls with synced transcripts, slides and filings viewers, AI chat with citations, saved highlights, workspaces, watchlists and keyword alerts.

All companies, tickers, numbers and documents in this build are **fictional sample data** (`src/data`). Nothing is fetched from the internet.

## Run it on your computer

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev        # opens on http://localhost:5173
```

## Publish it on the web (Vercel, free tier)

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. Choose **Add New → Project** and import this repository.
3. Keep the defaults (Framework: Vite, build `npm run build`, output `dist`) and press **Deploy**.
4. To use your own domain, open the project's **Settings → Domains** and add e.g. `research.sbw-invest.com`, then add the DNS record Vercel shows you.

Every push to `main` redeploys automatically. Netlify and Cloudflare Pages work the same way.

## Turn on accounts (Supabase, free tier)

Without this, the app runs as a demo and saves everything in the browser. With it, people sign in and their watchlists, saved items, workspaces, alerts, chats and settings are stored in their account.

1. Create a project at [supabase.com](https://supabase.com) (sign in with GitHub).
2. Open **SQL Editor → New query**, paste the contents of `supabase/setup.sql` and press **Run**.
3. Open **Authentication → URL Configuration** and set **Site URL** to your app address (e.g. `https://sbwresearch.vercel.app`).
4. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
5. In Vercel, open the project's **Settings → Environment Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with those values, then redeploy.

To keep sign-ups to your team only, turn off **Authentication → Providers → Email → Allow new users to sign up** after your accounts exist, and invite people from **Authentication → Users**.

## Project layout

| Path | What it holds |
| --- | --- |
| `src/components/Shell.tsx` | Sidebar, split panels, Quick access (Ctrl/Cmd K) |
| `src/components/EventPanel.tsx` | Event overview, transcript, slides and report viewers |
| `src/components/PlayerBar.tsx` | Docked audio player with chapters and live mode |
| `src/pages/*` | Home, Calendar, Search, Chat, Saved, Workspaces, Watchlists, Alerts, Settings |
| `src/data/*` | Sample companies and events, swap for a real data source |
| `src/chatEngine.ts` | Local stand-in for AI answers with citations |
| `src/store.tsx` | App state, saved in the browser and, when signed in, to the account |
| `src/auth.tsx`, `src/cloud.ts` | Sign-in screen and Supabase sync |
| `supabase/setup.sql` | Database table and access rules for accounts |

## Going live with real data

The UI reads everything through `src/data/index.ts` and `src/chatEngine.ts`. To use real information you need:

- **A licensed data provider** for events, transcripts, audio, slides, filings and consensus estimates.
- **A small backend** (API plus database) to store user accounts, watchlists, saved items and alerts, instead of the browser.
- **An AI model API** behind `chatEngine.ts`, answering from the retrieved documents and returning citations.
- **Sign-in** (for example Clerk, Auth0 or Supabase Auth).

`npm run build:artifact` builds the single-page preview used for the claude.ai link.
