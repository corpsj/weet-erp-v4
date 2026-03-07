-- Marketing notifications: replaces Discord webhooks with in-app notification system
-- All alerts, reports, and proposals are stored as queryable notification rows

create table if not exists public.marketing_notifications (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (category in (
      'proposal', 'report', 'lead', 'market', 'error', 'channel', 'journey', 'execution'
    )),
  type text not null,
  severity smallint not null default 3 check (severity between 1 and 4),
  title text not null,
  body text,
  action_path text,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_mn_created_desc
  on public.marketing_notifications (created_at desc);

create index if not exists idx_mn_unread
  on public.marketing_notifications (created_at desc)
  where read_at is null;

create index if not exists idx_mn_category
  on public.marketing_notifications (category);

create unique index if not exists idx_mn_dedupe
  on public.marketing_notifications (dedupe_key)
  where dedupe_key is not null;

-- RLS
alter table public.marketing_notifications enable row level security;

drop policy if exists "auth users full access" on public.marketing_notifications;
create policy "auth users full access" on public.marketing_notifications
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);
