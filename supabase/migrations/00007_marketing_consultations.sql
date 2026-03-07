-- Marketing consultations: conversion bridge from leads to sales
-- Tracks the handoff from automated marketing to human sales process

create table if not exists public.marketing_consultations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.marketing_leads (id) on delete cascade,
  persona_type text,
  request_channel text not null default 'dm_response',  -- dm_response, phone, kakao, form, handoff_keyword
  status text not null default 'requested',  -- requested, scheduled, completed, contracted, lost
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz,
  completed_at timestamptz
);

-- Add conversion metrics columns to daily_metrics
alter table public.marketing_daily_metrics
  add column if not exists consultations_requested integer default 0,
  add column if not exists consultations_completed integer default 0,
  add column if not exists contracts_signed integer default 0;

-- Add status column to marketing_leads (some code references it but it might not exist in schema)
alter table public.marketing_leads
  add column if not exists status text default 'new';

-- Indexes
create index if not exists idx_marketing_consultations_lead_id on public.marketing_consultations (lead_id);
create index if not exists idx_marketing_consultations_status on public.marketing_consultations (status);

-- RLS
alter table public.marketing_consultations enable row level security;

drop policy if exists "auth users full access" on public.marketing_consultations;
create policy "auth users full access" on public.marketing_consultations
for all
using (auth.uid() is not null)
with check (auth.uid() is not null);
