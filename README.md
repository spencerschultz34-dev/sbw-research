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

## Real US company data (SEC EDGAR)

On the hosted site, press Ctrl/Cmd K and type any US ticker or company name. Results under **US companies · SEC filings** open a page with the company profile, quarterly revenue, operating income, net income and EPS, and every recent SEC filing linked to sec.gov.

This uses the free SEC EDGAR APIs through `api/sec.ts`, a Vercel Edge Function, so it doesn't run in `npm run dev` or the claude.ai preview. SEC asks for a contact email on every request: add `SEC_CONTACT_EMAIL` in Vercel's Environment Variables (it defaults to research@sbw-invest.com).

## Earnings calls: transcripts and audio (EarningsCall)

The **Earnings** tab on a company page lists each results announcement (8-K Item 2.02) with its press release and slide deck from the SEC. When EarningsCall has the call, a **Call & transcript** view plays the audio with the transcript following along; click any sentence to jump there.

This runs through `api/calls.ts`. Without a key it uses EarningsCall's free demo, which covers Apple (AAPL) and Microsoft (MSFT) only. For every company, buy the Ultimate plan at [earningscall.biz](https://earningscall.biz/api-pricing) (transcripts with speakers and timestamps, plus audio) and add `EARNINGSCALL_API_KEY` in Vercel's Environment Variables, then redeploy.

### Free fallback: Alpha Vantage

Add a free key from [alphavantage.co](https://www.alphavantage.co/support/#api-key) as `ALPHAVANTAGE_API_KEY` in Vercel. When EarningsCall can't serve a company (for example on the demo or trial key), the app lists its calls with EPS against estimates and shows a speaker-labelled transcript, without audio. The free key allows 25 requests a day, and each call is cached for a week.

## Consensus estimates and segments (Business Quant)

Company pages show next quarter's analyst consensus (with the low and high estimate), a beat/miss table for the last four quarters, and revenue by segment. In Vercel, add `BUSINESSQUANT_API_KEY` under Settings, Environment Variables, then redeploy. Never commit the key. The free preview covers Apple only; for any other company the sections stay hidden until the key is on a paid plan.

## Project layout

| Path | What it holds |
| --- | --- |
| `src/components/Shell.tsx` | Sidebar, split panels, Quick access (Ctrl/Cmd K) |
| `src/components/EventPanel.tsx` | Event overview, transcript, slides and report viewers |
| `src/components/PlayerBar.tsx` | Docked audio player with chapters and live mode |
| `src/pages/*` | Home, Calendar, Search, Chat, Saved, Workspaces, Watchlists, Alerts, Settings |
| `src/data/*` | Sample companies and events, swap for a real data source |
| `api/sec.ts`, `src/sec.ts`, `src/pages/SecCompany.tsx` | Real SEC EDGAR data: server function, client and company page |
| `api/calls.ts`, `src/pages/CallView.tsx` | Earnings call transcripts and audio from EarningsCall |
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
