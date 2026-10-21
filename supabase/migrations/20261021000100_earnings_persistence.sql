-- Shared earnings tables; existing user_state is preserved.
create table if not exists public.companies (
 id uuid primary key default gen_random_uuid(),
 ticker text not null unique,
 name text,
 cik bigint,
 exchange text,
 updated_at timestamptz not null default now()
);
create table if not exists public.earnings_events (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 source text not null default 'finnhub',
 fiscal_year int not null,
 fiscal_quarter int not null check (fiscal_quarter between 1 and 4),
 event_date date not null,
 event_hour text,
 eps_actual numeric,
 eps_estimate numeric,
 revenue_actual numeric,
 revenue_estimate numeric,
 updated_at timestamptz not null default now(),
 unique(company_id, source, fiscal_year, fiscal_quarter)
);
create index if not exists earnings_events_date_idx on public.earnings_events(event_date);
create table if not exists public.ingestion_runs (
 id uuid primary key default gen_random_uuid(),
 source text not null,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 status text not null check (status in ('started','success','error')),
 records_processed integer not null default 0,
 error_message text
);
alter table public.companies enable row level security;
alter table public.earnings_events enable row level security;
alter table public.ingestion_runs enable row level security;
create policy "authenticated read companies" on public.companies for select to authenticated using (true);
create policy "authenticated read earnings" on public.earnings_events for select to authenticated using (true);
revoke all on public.ingestion_runs from anon, authenticated;
grant select on public.companies, public.earnings_events to authenticated;
