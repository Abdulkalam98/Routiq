# Routiq — Free Tier Setup Guide

Deploy Routiq for ₹0 using free cloud services.

## Architecture (All Free Tier)

| Service | Provider | Free Tier |
|---------|----------|-----------|
| Database | Supabase | 500MB PostgreSQL, unlimited API |
| Cache/Rate Limit | Upstash | 10K commands/day, 256MB |
| Backend | Render | 750 hours/month, auto-sleep |
| Frontend | Vercel | Unlimited deploys, 100GB bandwidth |
| LLM (Google) | AI Studio | 15 RPM, 1M tokens/day (Gemini Flash) |
| LLM (Mistral) | Mistral | Free tier available |
| Payments | Razorpay | No monthly fee, 2% per transaction |

**Total monthly cost: ₹0** (until you scale)

---

## Step 1: Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → Sign up free
2. Create new project → Choose region (Mumbai for India)
3. Save your database password
4. Go to **Settings → Database**:
   - Copy the **Connection string (URI)**
   - Replace `[YOUR-PASSWORD]` with your db password
   - Change `postgresql://` to `postgresql+asyncpg://`
   - Use the **Pooler connection** (port 6543) for production

```env
DATABASE_URL=postgresql+asyncpg://postgres.abc123:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

5. Run migrations:
```bash
cd backend
alembic upgrade head
```

---

## Step 2: Upstash Redis (Rate Limiting)

1. Go to [upstash.com](https://upstash.com) → Sign up free
2. Create Redis database → Choose region (Mumbai/Singapore)
3. Copy credentials from the dashboard:

```env
UPSTASH_REDIS_URL=https://select-moose-12345.upstash.io
UPSTASH_REDIS_TOKEN=AXxxASQgMj...
REDIS_URL=rediss://default:AXxxASQgMj...@select-moose-12345.upstash.io:6379
```

Free tier: 10,000 commands/day — enough for ~100 users.

---

## Step 3: Google AI Studio (Free LLM)

This gives you Gemini Flash for FREE (1 million tokens/day!).

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API Key** → Create key
3. Copy the API key:

```env
GOOGLE_API_KEY=AIzaSy...
```

Free limits:
- Gemini Flash: 15 RPM, 1M tokens/day, 1500 RPD
- Gemini 1.5 Pro: 2 RPM, 50 RPD

### Alternative: Vertex AI ($300 free credits)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. New account gets $300 free credits (90 days)
3. Enable Vertex AI API
4. Set up auth: `gcloud auth application-default login`

```env
GOOGLE_CLOUD_PROJECT=my-project-id
```

---

## Step 4: Other LLM Providers (Optional)

### OpenAI
- Sign up at [platform.openai.com](https://platform.openai.com)
- New accounts get $5 free credits
- `OPENAI_API_KEY=sk-...`

### Anthropic
- Sign up at [console.anthropic.com](https://console.anthropic.com)
- New accounts get $5 free credits
- `ANTHROPIC_API_KEY=sk-ant-...`

### Mistral
- Sign up at [console.mistral.ai](https://console.mistral.ai)
- Free tier available (basic models)
- `MISTRAL_API_KEY=...`

**Minimum viable setup:** Just Google AI Studio key → you get gemini-flash for free.

---

## Step 5: Deploy Backend (Render — Free)

1. Go to [render.com](https://render.com) → Sign up free
2. New Web Service → Connect your GitHub repo
3. Configure:
   - **Root directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
4. Add environment variables (from steps 1-4)
5. Deploy!

Your API will be at: `https://routiq-api.onrender.com`

> Note: Free tier sleeps after 15 min inactivity. First request after sleep takes ~30s.

### Alternative: Railway (Free $5/month credits)

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Add environment variables
4. Railway gives $5 free usage/month

---

## Step 6: Deploy Frontend (Vercel — Free)

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Import your repo → Set root directory to `frontend`
3. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://routiq-api.onrender.com
   ```
4. Deploy!

Your frontend will be at: `https://routiq.vercel.app`

Custom domain: Add `routiq.io` in Vercel settings (free).

---

## Step 7: Razorpay (Payments)

1. Go to [razorpay.com](https://razorpay.com) → Sign up
2. No monthly fee — only 2% per transaction
3. Get test mode keys first:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

4. Set up webhook URL: `https://routiq-api.onrender.com/webhooks/razorpay`
5. Subscribe to events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`

---

## Quick Start (5 minutes)

```bash
# Clone
git clone https://github.com/your-user/routiq.git
cd routiq

# Backend
cd backend
cp ../.env.example .env
# Fill in your Supabase, Upstash, and Google AI Studio keys
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload

# Frontend (new terminal)
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

---

## Cost Breakdown at Scale

| Users | Requests/day | Monthly Cost |
|-------|-------------|--------------|
| 1-10 | <100 | ₹0 (all free tiers) |
| 10-50 | 100-500 | ₹0 (still within limits) |
| 50-200 | 500-2K | ~₹500 (Render paid, Upstash Pro) |
| 200-1000 | 2K-10K | ~₹2,000 (scaled services) |
| 1000+ | 10K+ | ~₹5,000+ (production infra) |

You can run Routiq for **free** until you have paying customers, then costs scale with revenue.

---

## Environment Variables Summary

```env
# Required (minimum viable)
DATABASE_URL=postgresql+asyncpg://...        # Supabase
UPSTASH_REDIS_URL=https://...               # Upstash
UPSTASH_REDIS_TOKEN=...                     # Upstash
GOOGLE_API_KEY=AIzaSy...                    # Google AI Studio (free)
JWT_SECRET=random-string-here               # Generate one

# Optional (add more providers)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MISTRAL_API_KEY=...

# Payments (when ready)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Frontend
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```
