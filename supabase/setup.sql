-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- One row per user holding their watchlists, saved items, workspaces, alerts, chats and settings.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- Each person can only read and write their own row.
drop policy if exists "read own state" on public.user_state;
create policy "read own state" on public.user_state for select using (auth.uid() = user_id);
drop policy if exists "insert own state" on public.user_state;
create policy "insert own state" on public.user_state for insert with check (auth.uid() = user_id);
drop policy if exists "update own state" on public.user_state;
create policy "update own state" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
