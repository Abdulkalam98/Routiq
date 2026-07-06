# Routiq — Project Memory

## Overview
- **What**: AI API Gateway — route to multiple LLM providers, save 60% on tokens
- **Website**: https://routiqai.vercel.app
- **API**: https://routiq-api.onrender.com
- **Repo**: https://github.com/Abdulkalam98/Routiq
- **Tagline**: "Route smarter. Build faster."

## Tech Stack
- **Backend**: Python 3.12.3 + FastAPI (deployed on Render free tier)
- **Frontend**: Next.js 14 + Tailwind CSS (deployed on Vercel free tier)
- **Database**: Supabase PostgreSQL (Session Pooler, port 5432, IPv4)
- **Cache/Rate Limit**: Upstash Redis (REST API, 10K commands/day free)
- **Embeddings**: Google `text-embedding-004` (via AI Studio, free)
- **LLM**: Google AI Studio — `gemini-2.5-flash`
- **Payments**: Razorpay (UPI, net banking, Indian cards — INR only)

## Customer Info
- Email: `dev@routiq.io`
- Customer UUID: `ea0ad5aa-d5bc-495e-b58f-e73d886424ec`

## Key Endpoints
- `POST /v1/chat/completions` — OpenAI-compatible (requires API key auth, supports `model: "auto"`)
- `POST /v1/keys/create` — Create API key with `{name, email}` (no JWT)
- `POST /v1/keys` — Create API key (requires JWT auth)
- `GET /v1/keys` — List keys (requires JWT auth)
- `DELETE /v1/keys/{id}` — Revoke key (requires JWT auth)
- `GET /v1/models` — List available models
- `POST /v1/playground/chat` — Playground chat (JWT auth, supports smart routing + caching)
- `GET /v1/dashboard/stats?range=30d` — Aggregated stats for time range (JWT auth)
- `GET /v1/dashboard/cost-by-model?range=30d` — Cost/tokens/requests by model (JWT auth)
- `GET /v1/dashboard/requests?limit=50&range=30d` — Recent requests with status (JWT auth)
- `GET /v1/dashboard/logs?limit=50&offset=0&model=X&status=Y&range=7d` — Full logs, paginated (JWT auth)
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
- Smart auto-routing: `model: "auto"` → rule-based complexity classifier → cheapest adequate model
- Exact-match caching: SHA-256(model+messages) → Upstash Redis, 1hr TTL, fails open
- Semantic caching: Google text-embedding-004 → cosine similarity > 0.92 → cache hit
- Context windowing: auto-trim to 6K tokens, keep system prompt + last 4 turns
- Conversation summarization: gemini-flash compresses dropped messages → inject as system context
- All token-reduction features fail open — errors never block the request
- Security pipeline: token budget → prompt injection → PII redaction (all before provider call)

## Project Structure
```
routiq/
├── backend/          # FastAPI app
│   ├── main.py       # App entry, router registration
│   ├── config.py     # Pydantic settings
│   ├── database.py   # Async SQLAlchemy + Supabase pooler
│   ├── routers/      # chat, models, keys, billing, playground, dashboard, auth
│   ├── middleware/    # auth (API key), ratelimit (Upstash), token_budget, prompt_guard
│   ├── services/
│   │   ├── providers/       # openai, anthropic, google, mistral
│   │   ├── router.py        # Model → provider routing
│   │   ├── smart_router.py  # Prompt complexity classifier
│   │   ├── cache.py         # Exact-match Redis cache
│   │   ├── semantic_cache.py # Embedding-based similarity cache
│   │   ├── context_window.py # Token trimming + message windowing
│   │   ├── summarizer.py    # Conversation summarization via gemini-flash
│   │   ├── pii_redactor.py  # PII detection & redaction (regex)
│   │   ├── cost.py          # Token cost calculation
│   │   ├── usage.py         # Async usage logging (with observability fields)
│   │   └── billing.py       # Razorpay integration
│   ├── models/       # customer, api_key, usage_log, payment
│   └── migrations/   # SQL migration scripts (run manually on Supabase)
├── frontend/         # Next.js 14
│   ├── pages/        # index, docs, dashboard, logs, keys, billing, playground, login, signup
│   ├── components/   # Layout, Navbar
│   └── vercel.json   # Rewrites /api/* → Render
└── CLAUDE.md         # This file
```

## Critical Patterns
- `get_provider()` returns `tuple[BaseLLMProvider, str]` — always unpack
- `get_provider_smart(messages)` returns `tuple[BaseLLMProvider, str, str]` — (provider, resolved_model, actual_model)
- Provider `chat_completion()` returns nested OpenAI format (choices/usage)
- Streaming method is `chat_completion_stream()` (not `stream_chat_completion`)
- Razorpay must be lazy-imported (pkg_resources issue on Render)
- Plan field is `String(20)` not Enum (Supabase stores lowercase)
- All imports use flat paths (`from config import ...` not `from backend.config`)
- ApiKey model field is `key_prefix` (not `prefix`)
- API key prefix stored as `key[:10]`, auth lookup must also use `key[:10]` (not 8!)
- Google model map: `gemini-flash` → `gemini-2.5-flash`
- Python version pinned to 3.12.3 (Render defaults to 3.14 which breaks pydantic)
- Smart routing: simple→gemini-flash, medium→gpt-4o-mini, complex→gpt-4o (zero LLM calls)
- Cache key: `cache:` + SHA-256(model+messages)[:32], TTL 3600s
- Semantic cache: `scache:{0-499}` rotating buffer, `scache:idx` counter
- Context window: `trim_messages()` returns `(trimmed, was_trimmed, dropped)`
- Summarizer uses Google AI Studio endpoint directly (no extra dependency)
- All fail-open: cache/embedding/summarizer/security errors never block the request
- Dashboard endpoints return zeros (not errors) when no usage data exists
- Auth middleware stores `request.state.api_key_id` for downstream security checks
- Token budget key: `budget:{api_key_id}:daily`, TTL resets at midnight UTC
- Prompt guard: score-based (high=+2, medium=+1), block≥3, warn≥1
- PII redactor: only scans user-role messages, system prompts left intact

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
- `auto` — Smart routing (picks cheapest model based on prompt complexity)

## Smart Routing (model: "auto")
- Rule-based classifier — zero LLM calls, zero cost
- Simple (≤15 words, greetings, short factual) → `gemini-flash`
- Medium (moderate length, single complexity signal) → `gpt-4o-mini`
- Complex (2+ complexity keywords, code blocks, multi-question) → `gpt-4o`

## Caching (Two Layers)

### Exact-Match Cache (`services/cache.py`)
- SHA-256 of model + messages → Redis key
- Stored in Upstash Redis, 1hr TTL
- Non-streaming requests only
- Returns 0 tokens / ₹0 cost on cache hit
- Response header: `X-Routiq-Cached: true`

### Semantic Cache (`services/semantic_cache.py`)
- Embeds last user message via Google `text-embedding-004`
- Stores in rotating Redis buffer (500 entries, 2hr TTL)
- Cosine similarity > 0.92 = cache hit
- Scans last 50 entries via pipeline (single Redis call)
- Response header: `X-Routiq-Cache-Type: semantic`
- "What is Python?" ≈ "Explain Python to me" → same cached response

### Request Flow (non-streaming)
```
Exact cache → Semantic cache → Context trim + summarize → Provider call → Store both caches
```

## Context Compression (`services/context_window.py` + `services/summarizer.py`)
- **Token estimation**: 4 chars ≈ 1 token (no tiktoken dependency)
- **Context window**: 6,000 tokens max — keeps system prompt + last 4 turns
- **Summarization trigger**: When dropped messages > 500 estimated tokens
- **Summarizer**: Calls gemini-flash with max 150 output tokens (~100 word summary)
- **Injection**: Summary prepended as system message: "Previous conversation context: ..."
- **Response header**: `X-Routiq-Tokens-Saved: N`
- **Fail-open**: If summarization fails, uses trimmed messages without summary

## Security Pipeline (`middleware/token_budget.py`, `middleware/prompt_guard.py`, `services/pii_redactor.py`)

### Request Flow (order matters)
```
Auth → Rate Limit → Token Budget → Prompt Injection → PII Redaction → Cache → Provider
```

### Token Budget (`middleware/token_budget.py`)
- Daily token limits per API key (resets midnight UTC via Redis TTL)
- Tiers: free=50K/day, starter=200K/day, pro=1M/day
- Redis key: `budget:{api_key_id}:daily` → integer (INCRBY after response)
- Pre-check: GET, compare to limit → 429 `token_budget_exceeded`
- Post-increment: INCRBY + EXPIRE pipeline (async, fire-and-forget)
- Fails open if Redis unavailable

### Prompt Injection Guard (`middleware/prompt_guard.py`)
- Score-based weighted pattern matching (compiled regex, <1ms)
- High patterns (+2): "ignore previous instructions", "jailbreak", DAN mode, system prompt extraction
- Medium patterns (+1): "pretend you are", "without restrictions", "developer mode"
- Score ≥ 3 → BLOCK (400 `prompt_injection_detected`)
- Score 1-2 → WARN (allow, header `X-Routiq-Injection-Risk: medium`)
- Score 0 → PASS (clean)
- Only scans user-role messages, never logs actual prompt content

### PII Redaction (`services/pii_redactor.py`)
- Regex-based detection of: email, phone, credit card, SSN, Aadhaar, IPv4
- Replaces with: `[REDACTED_EMAIL]`, `[REDACTED_PHONE]`, `[REDACTED_CARD]`, etc.
- Only scans user-role messages (system prompts left intact)
- Response header: `X-Routiq-PII-Redacted: N` (count, never actual values)
- Runs BEFORE caching (so cached responses are already clean)

### Security Design Principles
- **All fail-open**: Redis down / regex error → request proceeds normally
- **No new dependencies**: pure regex + existing Upstash REST client
- **Never logs PII**: only pattern names and counts in logs
- **OpenAI-compatible errors**: `{error: {message, type, code}}` format
- **Async increments**: budget tracking never blocks the response

## Observability (`routers/dashboard.py` + `frontend/pages/logs.js`)

### UsageLog Model (Enhanced)
- **Core fields**: customer_id, api_key_id, model, provider, prompt_tokens, completion_tokens, cost_usd, cost_inr, latency_ms, created_at
- **Observability fields**: status (success/cached/error), cache_type (exact/semantic/null), completion_id, error_message (truncated 200 chars), is_stream (bool)
- **Indexes**: customer_id, api_key_id, created_at, status

### Dashboard API
- All endpoints support `?range=` param: `24h`, `7d`, `30d`, `90d`
- `/dashboard/stats` returns: total_spend, total_tokens, total_requests, cache_hit_rate, avg_spend_per_day, avg_tokens_per_day
- `/dashboard/cost-by-model` returns: model, cost, tokens, requests (per model)
- `/dashboard/requests` returns: full request details with status, cache_type, is_stream
- `/dashboard/logs` returns: paginated logs with `{logs, total, limit, offset, has_more}`

### Logs Page (`/logs`)
- Filterable table: time range, model, status
- Expandable row details: request ID, provider, token breakdown, error message
- Color-coded status badges: green (success), blue (cached), red (error)
- Latency indicators: green (<1s), yellow (1-3s), red (>3s)
- Summary stats bar: avg latency, cache hit ratio, total cost, error count
- Pagination: 50 per page, prev/next navigation
- CSV export of current view

### Cache Hit Logging
- Cache hits (both exact and semantic) are logged as separate UsageLog entries
- `status="cached"`, `cache_type="exact"|"semantic"`, tokens=0, cost=0
- Enables accurate cache hit rate calculation in dashboard

### Critical Patterns
- `_get_range_start(range)` converts range string to UTC datetime
- Dashboard returns zeros (not errors) when no data
- `getattr(log, "field", default)` used for backward compat with old rows missing new columns
- `log_usage()` accepts all observability fields as optional kwargs (backward compatible)

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
16. API key auth prefix mismatch: creation stored `key[:10]` but auth searched `key[:8]` → aligned both to `key[:10]`

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
- Token savings features added 2026-07-02 (dashboard, presets, smart routing, exact-match caching)
- Dark/red theme applied 2026-07-03 (all pages: landing, docs, dashboard, playground, keys, billing, login, signup)
- Docs page added 2026-07-03 (sidebar nav, endpoint badges, code blocks with copy)
- Token reduction features added 2026-07-03 (semantic caching, context window, summarization)
- Landing page updated 2026-07-03 (removed India-specific copy, added token-saving feature cards)
- Security features added 2026-07-03 (token budget per key, PII redaction, prompt injection detection)
- Observability added 2026-07-06 (request logs page, time-range filtering, enhanced UsageLog, cache hit tracking)
- Navbar links: Docs → /docs, Pricing → #pricing, Playground → /playground, Dashboard → /dashboard
- Sidebar nav order: Dashboard, Logs, Playground, API Keys, Billing
- No tests written yet — add pytest + jest when ready
- Playground presets: Summarizer, Translator, Code Helper, Explainer, Grammar Fixer (frontend-only)
- Docs page uses IntersectionObserver for scroll-aware sidebar highlighting

## Migrations
- `backend/migrations/002_add_observability_columns.sql` — adds status, cache_type, completion_id, error_message, is_stream to usage_logs
- Run migrations manually on Supabase SQL Editor (no auto-migration tool)

## UI Theme
- **Global**: Dark theme (`bg-dark-900`) with red accent (`red-600` buttons, `red-400` text highlights)
- **Layout**: All authenticated pages use dark sidebar/topbar (isDark = true always)
- **Tailwind dark colors**: `dark-900` (#0a0a0f), `dark-800` (#111118), `dark-700` (#1a1a24), `dark-600` (#2a2a3a)
- **Dashboard cards**: Use `.dashboard-card` class (defined in globals.css)
- **Accent pattern**: Red for CTAs/active states, green for success badges, amber for warnings
- **Logo**: Red square with white "R" (`bg-red-600`)
