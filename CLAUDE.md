# Routiq — Project Memory

## Overview
- **What**: AI API Gateway for Indian developers (OpenRouter clone for India)
- **Website**: routiq.io
- **API**: api.routiq.io/v1
- **Repo**: https://github.com/Abdulkalam98/Routiq
- **Tagline**: "Route smarter. Build faster."

## Tech Stack
- **Backend**: Python + FastAPI (deployed on Render free tier)
- **Frontend**: Next.js 14 + Tailwind CSS (deployed on Vercel free tier)
- **Database**: Supabase (free PostgreSQL, 500MB)
- **Cache/Rate Limit**: Upstash Redis (REST API, 10K commands/day free)
- **LLM Providers**: OpenAI, Anthropic, Google (AI Studio free + Vertex AI), Mistral
- **Payments**: Razorpay (UPI, net banking, Indian cards — ₹ only)
- **Primary Color**: #6366f1 (indigo)

## Key Architecture Decisions
- OpenAI SDK compatible — users switch by changing `base_url` only
- API key prefix: `rq_` (32 random chars, bcrypt hashed, never stored raw)
- Upstash REST API instead of redis-py (saves a dependency, works serverless)
- Google provider supports dual mode: AI Studio (free) and Vertex AI ($300 credits)
- Async usage logging (never blocks response)
- Automatic provider fallback chain: OpenAI → Anthropic → Google → Mistral
- All costs in ₹ only, 5% markup on token costs, USD_TO_INR = 84.0

## Project Structure
```
routiq/
├── backend/          # FastAPI app
│   ├── main.py       # App entry, router registration
│   ├── config.py     # Pydantic settings
│   ├── database.py   # Async SQLAlchemy + Supabase pooler
│   ├── routers/      # chat, models, keys, billing
│   ├── middleware/    # auth (API key), ratelimit (Upstash)
│   ├── services/     # providers/, router, cost, billing
│   └── models/       # customer, api_key, usage (SQLAlchemy)
├── frontend/         # Next.js 14
│   ├── pages/        # index, dashboard, keys, billing
│   ├── components/   # Layout, Navbar
│   └── lib/          # api.js, constants.js
├── nginx/            # Reverse proxy config
├── deploy/           # railway.toml, deploy.sh
├── docker-compose.yml       # Cloud services (minimal)
├── docker-compose.local.yml # Full local stack
├── docker-compose.prod.yml  # Production
├── SETUP.md          # Free tier deployment guide
└── README.md         # User-facing docs
```

## Pricing Plans
- Free: ₹0 — 100K tokens/month, 3 models, 10 req/min
- Starter: ₹999/mo — 2M tokens/month, all models, 60 req/min
- Pro: ₹2,999/mo — 20M tokens/month, all models, 300 req/min

## Git Profile
- GitHub account: Abdulkalam98
- Other account: Abdul0898 (default active)
- Always switch to Abdulkalam98 before pushing to this repo

## Models Supported
- gpt-4o, gpt-4o-mini (OpenAI)
- claude-sonnet-4-6, claude-haiku (Anthropic)
- gemini-1.5-pro, gemini-flash (Google)
- mistral-large, mistral-small (Mistral)

## Free Services Used
| Service | Provider | Limit |
|---------|----------|-------|
| Database | Supabase | 500MB PostgreSQL |
| Redis | Upstash | 10K commands/day |
| Backend | Render | 750 hrs/month, auto-sleep |
| Frontend | Vercel | Unlimited deploys |
| LLM | Google AI Studio | 1M tokens/day (Gemini Flash) |
| Payments | Razorpay | 2% per transaction |

## Development Commands
```bash
# Local dev (with cloud services)
cd backend && uvicorn main:app --reload

# Local dev (full stack, no cloud)
docker compose -f docker-compose.local.yml up

# Frontend
cd frontend && npm install && npm run dev

# Migrations
cd backend && alembic upgrade head
```

## Notes
- Project built 2026-05-18
- 62 files, 5,909 lines of code
- All subagents completed successfully on first build
- No tests written yet — add pytest + jest when ready
