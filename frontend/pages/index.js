import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import {
  BoltIcon,
  CpuChipIcon,
  ArrowPathIcon,
  CheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const plans = [
  {
    name: 'Free',
    price: '₹0',
    period: '/month',
    description: 'Get started with Inferix',
    features: [
      '100K tokens/month',
      '3 models (GPT-4o-mini, Claude Haiku, Gemini Flash)',
      '10 req/min',
      'Basic analytics',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: '₹999',
    period: '/month',
    description: 'For growing projects',
    features: [
      '2M tokens/month',
      'All models (GPT-4o, Claude Sonnet, Gemini Pro)',
      '60 req/min',
      'Smart auto-routing',
      'Response caching',
    ],
    cta: 'Get API Key',
    highlighted: true,
  },
  {
    name: 'Pro',
    price: '₹2,999',
    period: '/month',
    description: 'For production workloads',
    features: [
      '20M tokens/month',
      'All models + early access',
      '300 req/min',
      'Smart auto-routing',
      'Custom caching TTL',
      'Priority support + SLA',
    ],
    cta: 'Get API Key',
    highlighted: false,
  },
];

const valueProps = [
  {
    icon: BoltIcon,
    title: 'Smart Routing',
    description:
      'Auto-picks the cheapest model for your prompt. Simple questions use cheap models, complex ones get GPT-4o. Zero wasted tokens.',
  },
  {
    icon: SparklesIcon,
    title: 'Semantic Caching',
    description:
      'Similar prompts return cached responses instantly — zero tokens, zero cost. Not just exact matches, but meaning-based similarity.',
  },
  {
    icon: CpuChipIcon,
    title: 'Context Compression',
    description:
      'Long conversations auto-trimmed and summarized. Cuts 50-80% of tokens while preserving full context.',
  },
  {
    icon: ArrowPathIcon,
    title: '4 Providers. 1 API Key.',
    description:
      'OpenAI, Anthropic, Google, Mistral — switch your base_url and you\'re done. Existing OpenAI SDK code works instantly.',
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Inferix - One API. Every AI Model. Save 60% on Tokens.</title>
        <meta
          name="description"
          content="Route smarter. Build faster. Access OpenAI, Anthropic, Google, and Mistral through one API with smart routing, semantic caching, and context compression."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-dark-900">
        <Navbar />

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-32">
          <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent" />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
              Route smarter.{' '}
              <span className="text-red-500">Build faster.</span>
            </h1>
            <p className="mt-6 text-xl sm:text-2xl text-gray-300 max-w-2xl mx-auto">
              One API. Every AI Model. Save 60% on tokens.
            </p>

            {/* Code Block */}
            <div className="mt-12 max-w-xl mx-auto">
              <div className="rounded-xl overflow-hidden border border-dark-600 shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 bg-dark-800 border-b border-dark-600">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-3 text-xs text-gray-400 font-mono">
                    main.py
                  </span>
                </div>
                <pre className="p-6 bg-dark-800 text-left text-sm leading-relaxed overflow-x-auto">
                  <code className="font-mono">
                    <span className="text-gray-500"># Just change 2 lines</span>
                    {'\n'}
                    <span className="text-red-400">client</span>
                    <span className="text-white"> = </span>
                    <span className="text-green-400">OpenAI</span>
                    <span className="text-white">(</span>
                    {'\n'}
                    <span className="text-white">    </span>
                    <span className="text-orange-300">api_key</span>
                    <span className="text-white">=</span>
                    <span className="text-green-300">{'"rq_your_key"'}</span>
                    <span className="text-white">,</span>
                    {'\n'}
                    <span className="text-white">    </span>
                    <span className="text-orange-300">base_url</span>
                    <span className="text-white">=</span>
                    <span className="text-green-300">
                      {'"https://api.inferix.ai/v1"'}
                    </span>
                    {'\n'}
                    <span className="text-white">)</span>
                  </code>
                </pre>
              </div>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/keys"
                className="bg-red-600 hover:bg-red-700 text-white font-medium text-lg px-8 py-3 rounded-lg transition-colors inline-block"
              >
                Get API Key
              </Link>
              <Link
                href="/dashboard"
                className="bg-transparent text-gray-300 border border-dark-500 hover:bg-dark-700 font-medium text-lg px-8 py-3 rounded-lg transition-colors inline-block"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="py-20 bg-dark-800/50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {valueProps.map((prop) => (
                <div
                  key={prop.title}
                  className="p-6 rounded-xl bg-dark-800 border border-dark-600"
                >
                  <prop.icon className="w-10 h-10 text-red-400 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {prop.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {prop.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 bg-dark-900" id="pricing">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white">
                Simple, transparent pricing
              </h2>
              <p className="mt-3 text-gray-400">
                Pay only for what you use. No hidden fees.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-xl p-8 border ${
                    plan.highlighted
                      ? 'border-red-500/50 bg-dark-800 ring-2 ring-red-500/20'
                      : 'border-dark-600 bg-dark-800'
                  }`}
                >
                  {plan.highlighted && (
                    <span className="inline-block px-3 py-1 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-full mb-4">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-xl font-semibold text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-400">
                    {plan.description}
                  </p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-gray-300"
                      >
                        <CheckIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/keys"
                    className={`mt-8 block text-center py-2.5 px-5 rounded-lg font-medium transition-colors ${
                      plan.highlighted
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-dark-600 hover:bg-dark-500 text-white'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-dark-600">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-gray-400 text-sm">
              Route smarter. Build faster.
            </p>
            <p className="mt-2 text-gray-500 text-xs">
              &copy; {new Date().getFullYear()} Inferix. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
