-- Add OpenClaw integration columns to marketing_contents

-- Add published_by column (tracks whether content was published manually or via OpenClaw)
alter table public.marketing_contents add column if not exists published_by text default 'manual';

-- Add openclaw_job_id column (references the OpenClaw job that published this content)
alter table public.marketing_contents add column if not exists openclaw_job_id text;

-- Create index on published_by for filtering
create index if not exists idx_marketing_contents_published_by on public.marketing_contents (published_by);

-- Create index on openclaw_job_id for tracing
create index if not exists idx_marketing_contents_openclaw_job_id on public.marketing_contents (openclaw_job_id);
