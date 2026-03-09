-- Add missing columns required by scheduler jobs:
-- daily_reset: needs naver_api_calls in marketing_daily_metrics
-- journey_check: needs last_action_at in marketing_leads

ALTER TABLE marketing_daily_metrics
  ADD COLUMN IF NOT EXISTS naver_api_calls integer DEFAULT 0;

ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS last_action_at timestamptz;
