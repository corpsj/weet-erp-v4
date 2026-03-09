-- Add missing metadata columns to marketing tables
-- These columns are referenced in the scheduler code but were missing from the schema

ALTER TABLE marketing_proposals 
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE marketing_contents 
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
