-- BYOK + Output Guardrails migration
-- Run this on Supabase SQL Editor

-- Table for storing user's own provider API keys (encrypted)
CREATE TABLE IF NOT EXISTS user_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_label VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customer_provider UNIQUE (customer_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_upk_customer ON user_provider_keys(customer_id, provider, is_active);

-- Track which key was used for each request (own vs platform)
ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS key_source VARCHAR(10) NOT NULL DEFAULT 'platform';
