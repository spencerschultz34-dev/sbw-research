-- Persistent SBW Research ingestion schema.
-- Applied to Supabase on 2026-10-21; safe to reapply (idempotent).
-- Service role writes; browser roles have no table grants or permissive RLS policies.

create table if not exists public.ingestion_targets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  source_url text not null,
  source_type text not null default 'investor_relations',
  enabled boolean not null default true,
  priority integer not null default 10,
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  poll_interval_minutes integer not null default 360 check (poll_interval_minutes between 5 and 10080),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, source_url)
);
create index if not exists ingestion_targets_due on public.ingestion_targets (next_check_at, priority desc) where enabled;

create table if not exists public.research_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  event_key text not null,
  fiscal_year integer,
  fiscal_quarter integer check (fiscal_quarter between 1 and 4),
  event_type text not null default 'earnings',
  title text not null,
  event_date timestamptz,
  event_page_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, event_key)
);
create index if not exists research_events_company_date on public.research_events (company_id, event_date desc);

create table if not exists public.research_event_versions (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.research_events(id) on delete restrict,
  source text not null,
  source_event_id text,
  fingerprint text not null,
  snapshot jsonb not null,
  observed_at timestamptz not null default now(),
  unique (event_id, source, fingerprint)
);
create index if not exists research_event_versions_event on public.research_event_versions (event_id, observed_at desc);

create table if not exists public.research_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.research_events(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  kind text not null check(kind in ('press-release','slides','transcript','financials','filing','webcast','event-page','other')),
  title text not null,
  format text not null,
  source_url text not null,
  source_provider text not null default 'company_ir',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, kind, source_url)
);
create index if not exists research_documents_event on public.research_documents (event_id, kind);

create table if not exists public.research_document_versions (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.research_documents(id) on delete restrict,
  fingerprint text not null,
  source_url text not null,
  etag text,
  last_modified text,
  content_sha256 text,
  storage_key text,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  unique (document_id, fingerprint)
);
create index if not exists research_doc_versions_document on public.research_document_versions (document_id, observed_at desc);

create table if not exists public.ingestion_run_items (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.ingestion_runs(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  source_url text,
  status text not null check(status in ('success','partial','error')),
  events_seen integer not null default 0,
  documents_seen integer not null default 0,
  error_message text,
  checked_at timestamptz not null default now(),
  unique (run_id, company_id)
);
create index if not exists ingestion_run_items_company on public.ingestion_run_items (company_id, checked_at desc);
alter table public.ingestion_runs add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.ingestion_targets enable row level security;
alter table public.research_events enable row level security;
alter table public.research_event_versions enable row level security;
alter table public.research_documents enable row level security;
alter table public.research_document_versions enable row level security;
alter table public.ingestion_run_items enable row level security;
revoke all on public.ingestion_targets, public.research_events, public.research_event_versions,
  public.research_documents, public.research_document_versions, public.ingestion_run_items from anon, authenticated;
revoke all on sequence public.research_event_versions_id_seq, public.research_document_versions_id_seq,
  public.ingestion_run_items_id_seq from anon, authenticated;
