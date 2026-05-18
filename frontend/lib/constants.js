export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceLabel: '₹0',
    tokens: '100K',
    tokensNum: 100000,
    models: '3 models',
    rateLimit: '10 req/min',
    features: ['gpt-4o-mini', 'gemini-flash', 'mistral-small', 'Basic dashboard'],
  },
  starter: {
    name: 'Starter',
    price: 999,
    priceLabel: '₹999/mo',
    tokens: '2M',
    tokensNum: 2000000,
    models: 'All models',
    rateLimit: '60 req/min',
    features: ['All 8 models', 'Priority support', '10K req/day', 'Full dashboard'],
  },
  pro: {
    name: 'Pro',
    price: 2999,
    priceLabel: '₹2,999/mo',
    tokens: '20M',
    tokensNum: 20000000,
    models: 'All models',
    rateLimit: '300 req/min',
    features: ['All 8 models', 'Dedicated support', 'Unlimited daily', 'Full dashboard', 'Custom models'],
  },
};

export const MODELS = [
  { id: 'gpt-4o', provider: 'OpenAI', inputCost: '₹0.221', outputCost: '₹0.882' },
  { id: 'gpt-4o-mini', provider: 'OpenAI', inputCost: '₹0.013', outputCost: '₹0.053' },
  { id: 'claude-sonnet-4-6', provider: 'Anthropic', inputCost: '₹0.265', outputCost: '₹1.323' },
  { id: 'claude-haiku', provider: 'Anthropic', inputCost: '₹0.022', outputCost: '₹0.110' },
  { id: 'gemini-1.5-pro', provider: 'Google', inputCost: '₹0.110', outputCost: '₹0.441' },
  { id: 'gemini-flash', provider: 'Google', inputCost: '₹0.007', outputCost: '₹0.026' },
  { id: 'mistral-large', provider: 'Mistral', inputCost: '₹0.176', outputCost: '₹0.529' },
  { id: 'mistral-small', provider: 'Mistral', inputCost: '₹0.088', outputCost: '₹0.265' },
];

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
