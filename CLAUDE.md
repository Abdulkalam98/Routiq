# Routiq — Project Memory

## Overview
- **What**: AI API Gateway for Indian developers (OpenRouter clone for India)
- **Website**: https://routiqai.vercel.app
- **API**: https://routiq-api.onrender.com
- **Repo**: https://github.com/Abdulkalam98/Routiq
- **Tagline**: "Route smarter. Build faster."

## Tech Stack
- **Backend**: Python 3.12.3 + FastAPI (deployed on Render free tier)
- **Frontend**: Next.js 14 + Tailwind CSS (deployed on Vercel free tier)
- **Database**: Supabase PostgreSQL (Session Pooler, port 5432, IPv4)
- **Cache/Rate Limit**: Upstash Redis (REST API, 10K commands/day free)
- **LLM**: Google AI Studio — `gemini-2.5-flash`
- **Payments**: Razorpay (UPI, net banking, Indian cards — INR only)

## Customer Info
- Email: `dev@routiq.io`
- Customer UUID: `ea0ad5aa-d5bc-495e-b58f-e73d886424ec`

## Key Endpoints
- `POST /v1/chat/completions` — OpenAI-compatible (requires API key auth)
- `POST /v1/keys/create` — Create API key with `{name, email}` (no JWT)
- `POST /v1/keys` — Create API key (requires JWT auth)
- `GET /v1/keys` — List keys (requires JWT auth)
- `DELETE /v1/keys/{id}` — Revoke key (requires JWT auth)
- `GET /v1/models` — List available models
- `GET /health` — Health check

## Key Architecture Decisions
- OpenAI SDK compatible — users switch by changing `base_url` only
- API key prefix: `rq_` (32 random chars, bcrypt hashed, never stored raw)
- Upstash REST API instead of redis-py (saves a dependency, works serverless)
- Google provider supports dual mode: AI Studio (free) and Vertex AI ($300 credits)
- Async usage logging (never blocks response)
- Automatic provider fallback chain: OpenAI → Anthropic → Google → Mistral (skips unconfigured)
- All costs in INR only, 5% markup on token costs, USD_TO_INR = 84.0
- Frontend uses relative URLs (`API_BASE = ''`) — Vercel rewrites `/api/:path*` to Render

## Project Structure
```
routiq/
├── backend/          # FastAPI app
│   ├── main.py       # App entry, router registration
│   ├── config.py     # Pydantic settings
│   ├── database.py   # Async SQLAlchemy + Supabase pooler
│   ├── routers/      # chat, models, keys, billing
│   ├── middleware/    # auth (API key), ratelimit (Upstash)
│   ├── services/     # providers/, router, cost, billing, usage
│   └── models/       # customer, api_key, usage_log, payment
├── frontend/         # Next.js 14
│   ├── pages/        # index, dashboard, keys, billing
│   ├── components/   # Layout, Navbar
│   └── vercel.json   # Rewrites /api/* → Render
└── CLAUDE.md         # This file
```

## Critical Patterns
- `get_provider()` returns `tuple[BaseLLMProvider, str]` — always unpack
- Provider `chat_completion()` returns nested OpenAI format (choices/usage)
- Streaming method is `chat_completion_stream()` (not `stream_chat_completion`)
- Razorpay must be lazy-imported (pkg_resources issue on Render)
- Plan field is `String(20)` not Enum (Supabase stores lowercase)
- All imports use flat paths (`from config import ...` not `from backend.config`)
- ApiKey model field is `key_prefix` (not `prefix`)
- Google model map: `gemini-flash` → `gemini-2.5-flash`
- Python version pinned to 3.12.3 (Render defaults to 3.14 which breaks pydantic)

## Environment Variables (Render)
- `DATABASE_URL` — Supabase Session Pooler (`postgresql+asyncpg://...`)
- `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`
- `GOOGLE_API_KEY` — Google AI Studio key
- `PYTHON_VERSION` = `3.12.3`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

## Pricing Plans
- Free: ₹0 — 100K tokens/month, 3 models, 10 req/min
- Starter: ₹999/mo — 2M tokens/month, all models, 60 req/min
- Pro: ₹2,999/mo — 20M tokens/month, all models, 300 req/min

## Models Supported
- gpt-4o, gpt-4o-mini (OpenAI)
- claude-sonnet-4-6, claude-haiku (Anthropic)
- gemini-1.5-pro, gemini-flash (Google — routes to gemini-2.5-flash)
- mistral-large, mistral-small (Mistral)

## Git Profile
- GitHub account: Abdulkalam98
- Other account: Abdul0898 (may be default active)
- Always `gh auth switch --user Abdulkalam98` before pushing

## Bugs Fixed (History)
1. Python 3.14 on Render → pinned to 3.12.3
2. `from backend.` import prefix → removed prefix
3. `pkg_resources` missing → lazy import razorpay
4. IPv6 unreachable on Render → Supabase Session Pooler (IPv4)
5. PlanType enum mismatch → String(20) field
6. Vercel `@api_url` secret → hardcoded URL in vercel.json
7. `get_provider()` tuple not unpacked → destructure both values
8. Response parsing flat vs nested → parse OpenAI nested format
9. `stream_chat_completion` → `chat_completion_stream`
10. Fallback with empty API keys → skip unconfigured providers
11. `gemini-2.0-flash` quota exhausted → switched to `gemini-2.5-flash`
12. ApiKey `prefix` field → `key_prefix`
13. Frontend `API_BASE` localhost → relative URL for Vercel rewrites
14. `plan` column PostgreSQL enum → converted to VARCHAR(20): `ALTER TABLE customers ALTER COLUMN plan TYPE VARCHAR(20) USING plan::VARCHAR`
15. `create_key` used undefined `customer.id` → changed to `user["customer_id"]`

## Development Commands
```bash
# Local dev
cd backend && uvicorn main:app --reload

# Frontend
cd frontend && npm install && npm run dev

# Test API
curl -X POST https://routiq-api.onrender.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model": "gemini-flash", "messages": [{"role": "user", "content": "Hello"}]}'

# Create API key
curl -X POST https://routiq-api.onrender.com/v1/keys/create \
  -H "Content-Type: application/json" \
  -d '{"name": "My Key", "email": "dev@routiq.io"}'
```

## Notes
- Project built 2026-05-18
- No tests written yet — add pytest + jest when ready
