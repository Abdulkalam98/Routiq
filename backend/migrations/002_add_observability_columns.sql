-- Add observability columns to usage_logs table
-- Run this on Supabase SQL Editor

ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS cache_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS completion_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS is_stream BOOLEAN NOT NULL DEFAULT false;

-- Index on status for filter queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_status ON usage_logs (status);
