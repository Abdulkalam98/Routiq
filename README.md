# Routiq

> Route smarter. Build faster.

One API. Every AI Model. Pay in ₹.

## Quickstart

```bash
pip install openai
```

```python
from openai import OpenAI

client = OpenAI(
    api_key="rq_your_key_here",
    base_url="https://api.routiq.io/v1"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

That's it. Change two lines and you're using Routiq.

## Supported Models

| Model | Provider | Input ₹/1K tokens | Output ₹/1K tokens |
|-------|----------|-------------------|---------------------|
| gpt-4o | OpenAI | ₹0.221 | ₹0.882 |
| gpt-4o-mini | OpenAI | ₹0.013 | ₹0.053 |
| claude-sonnet-4-6 | Anthropic | ₹0.265 | ₹1.323 |
| claude-haiku | Anthropic | ₹0.022 | ₹0.110 |
| gemini-1.5-pro | Google | ₹0.110 | ₹0.441 |
| gemini-flash | Google | ₹0.007 | ₹0.026 |
| mistral-large | Mistral | ₹0.176 | ₹0.529 |
| mistral-small | Mistral | ₹0.088 | ₹0.265 |

*Prices include 5% Routiq markup. All billing in ₹ only.*

## Features

- **OpenAI SDK compatible** — change `base_url` and you're done
- **4 providers, 1 API key** — OpenAI, Anthropic, Google, Mistral
- **Pay in ₹** — UPI, net banking, Indian cards via Razorpay
- **Streaming support** — full SSE streaming just like OpenAI
- **Automatic fallback** — if a provider fails, we try the next one
- **Usage dashboard** — track spend, tokens, and latency

## Pricing

| Plan | Price | Tokens/month | Models |
|------|-------|-------------|--------|
| Free | ₹0 | 100K | 3 models |
| Starter | ₹999/mo | 2M | All models |
| Pro | ₹2,999/mo | 20M | All models |

## API Reference

### POST /v1/chat/completions

Standard OpenAI chat completions format. Supports `stream: true`.

```bash
curl https://api.routiq.io/v1/chat/completions \
  -H "Authorization: Bearer rq_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### GET /v1/models

Returns all available models in OpenAI list format.

### Special model: "auto"

Use `model: "auto"` to route to the cheapest available model (currently gemini-flash).

## Self-Hosting

### Requirements

- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+
- API keys for at least one LLM provider

### Setup

```bash
git clone https://github.com/routiq/routiq.git
cd routiq
cp .env.example .env
# Fill in your API keys in .env
docker compose up -d
```

The API will be available at `http://localhost:8000`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `MISTRAL_API_KEY` | Mistral API key |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret |
| `JWT_SECRET` | Secret for JWT token signing |
| `USD_TO_INR` | Fallback USD to INR rate (default: 84.0) |

## License

MIT
