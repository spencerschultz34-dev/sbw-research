-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- One row per earnings call that our own pipeline (worker/) recorded and transcribed.
-- Only server code with the service role key reads or writes it: row level security is on with no policies,
-- so the public anon key used by the browser cannot see it.
create table if not exists public.calls (
  symbol text not null,
  year int not null,             -- fiscal year, as the company reports it
  quarter int not null check (quarter between 1 and 4),
  exchange text,
  company text,
  title text,
  event_date timestamptz,
  event_page text,               -- the IR page the webcast was found on
  media_url text,                -- the stream that was recorded (for debugging; usually expires)
  audio_key text,                -- object key of the MP3 in storage (R2)
  duration_sec int,
  transcript jsonb,              -- the shape the app's CallView reads (speakers, paragraphs, sentences with times)
  status text not null default 'pending', -- pending | done | failed
  error text,
  attempts int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (symbol, year, quarter)
);

alter table public.calls enable row level security;
