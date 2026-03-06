-- Marketing tables: merged from weet-director marketing automation system

-- 1. marketing_leads (referenced by marketing_lead_actions)
create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  username text not null,
  score integer default 0,
  persona_type text,
  journey_stage text default 'awareness',
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. marketing_signals (referenced by marketing_proposals)
create table if not exists public.marketing_signals (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  signal_type text,
  title text,
  summary text,
  urgency text default 'low',
  sentiment text,
  keywords jsonb not null default '[]'::jsonb,
  url text,
  collected_at timestamptz not null default now()
);

-- 3. marketing_proposals (references marketing_signals)
create table if not exists public.marketing_proposals (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references public.marketing_signals (id) on delete set null,
  title text not null,
  action_type text,
  content_draft text,
  status text default 'pending',
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

-- 4. marketing_contents
create table if not exists public.marketing_contents (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  title text,
  body text not null,
  status text default 'draft',
  engagement_metrics jsonb not null default '{}'::jsonb,
  persona_target text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- 5. marketing_lead_actions (references marketing_leads)
create table if not exists public.marketing_lead_actions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.marketing_leads (id) on delete cascade,
  action_type text,
  details jsonb not null default '{}'::jsonb,
  performed_at timestamptz not null default now()
);

-- 6. marketing_daily_metrics
create table if not exists public.marketing_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  leads_collected integer default 0,
  proposals_made integer default 0,
  proposals_approved integer default 0,
  contents_published integer default 0,
  created_at timestamptz not null default now()
);

-- 7. marketing_settings (text PK, not UUID)
create table if not exists public.marketing_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_marketing_leads_platform on public.marketing_leads (platform);
create index if not exists idx_marketing_leads_journey_stage on public.marketing_leads (journey_stage);
create index if not exists idx_marketing_proposals_status on public.marketing_proposals (status);
create index if not exists idx_marketing_contents_channel on public.marketing_contents (channel);
create index if not exists idx_marketing_contents_status on public.marketing_contents (status);
create index if not exists idx_marketing_signals_source on public.marketing_signals (source);
create index if not exists idx_marketing_signals_urgency on public.marketing_signals (urgency);
create index if not exists idx_marketing_lead_actions_lead_id on public.marketing_lead_actions (lead_id);

-- RLS
alter table public.marketing_leads enable row level security;
alter table public.marketing_proposals enable row level security;
alter table public.marketing_contents enable row level security;
alter table public.marketing_signals enable row level security;
alter table public.marketing_lead_actions enable row level security;
alter table public.marketing_daily_metrics enable row level security;
alter table public.marketing_settings enable row level security;

-- Policies (marketing data is team-shared — any authenticated user has full access)
drop policy if exists "auth users full access" on public.marketing_leads;
create policy "auth users full access" on public.marketing_leads
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "auth users full access" on public.marketing_proposals;
create policy "auth users full access" on public.marketing_proposals
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "auth users full access" on public.marketing_contents;
create policy "auth users full access" on public.marketing_contents
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "auth users full access" on public.marketing_signals;
create policy "auth users full access" on public.marketing_signals
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "auth users full access" on public.marketing_lead_actions;
create policy "auth users full access" on public.marketing_lead_actions
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "auth users full access" on public.marketing_daily_metrics;
create policy "auth users full access" on public.marketing_daily_metrics
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "auth users full access" on public.marketing_settings;
create policy "auth users full access" on public.marketing_settings
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- Triggers (only on tables with updated_at)
create trigger trg_marketing_leads_updated_at
before update on public.marketing_leads
for each row execute function public.set_updated_at();

create trigger trg_marketing_settings_updated_at
before update on public.marketing_settings
for each row execute function public.set_updated_at();
