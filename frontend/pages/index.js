import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import {
  BoltIcon,
  CurrencyRupeeIcon,
  ArrowPathIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const plans = [
  {
    name: 'Free',
    price: '₹0',
    period: '/month',
    description: 'Get started with Routiq',
    features: [
      '1,000 requests/month',
      'GPT-4o-mini, Claude Haiku',
      'Community support',
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
      '50,000 requests/month',
      'All models (GPT-4o, Claude Sonnet, Gemini)',
      'Priority support',
      'Advanced analytics',
      'Custom rate limits',
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
      'Unlimited requests',
      'All models + early access',
      'Dedicated support',
      'Full analytics & logs',
      'Custom rate limits',
      'SLA guarantee',
    ],
    cta: 'Get API Key',
    highlighted: false,
  },
];

const valueProps = [
  {
    icon: BoltIcon,
    title: '4 providers. 1 API key.',
    description:
      'OpenAI, Anthropic, Google, Mistral — all through a single unified endpoint. No more juggling SDKs.',
  },
  {
    icon: CurrencyRupeeIcon,
    title: 'Pay in ₹ via UPI',
    description:
      'No international card needed. Pay directly in Indian Rupees using UPI, netbanking, or cards.',
  },
  {
    icon: ArrowPathIcon,
    title: 'Switch in 30 seconds',
    description:
      'Change your base_url and API key. That\'s it. Your existing OpenAI SDK code works instantly.',
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Routiq - One API. Every AI Model. Pay in ₹.</title>
        <meta
          name="description"
          content="Route smarter. Build faster. Access OpenAI, Anthropic, Google, and Mistral through one API. Pay in Indian Rupees."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-slate-900">
        <Navbar />

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-32">
          <div className="absolute inset-0 bg-gradient-to-b from-primary-500/10 to-transparent" />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
              Route smarter.{' '}
              <span className="text-primary-400">Build faster.</span>
            </h1>
            <p className="mt-6 text-xl sm:text-2xl text-gray-300 max-w-2xl mx-auto">
              One API. Every AI Model. Pay in ₹.
            </p>

            {/* Code Block */}
            <div className="mt-12 max-w-xl mx-auto">
              <div className="rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-3 text-xs text-gray-400 font-mono">
                    main.py
                  </span>
                </div>
                <pre className="p-6 bg-gray-900 text-left text-sm leading-relaxed overflow-x-auto">
                  <code className="font-mono">
                    <span className="text-gray-400"># Just change 2 lines</span>
                    {'\n'}
                    <span className="text-purple-400">client</span>
                    <span className="text-white"> = </span>
                    <span className="text-green-400">OpenAI</span>
                    <span className="text-white">(</span>
                    {'\n'}
                    <span className="text-white">    </span>
                    <span className="text-orange-300">api_key</span>
                    <span className="text-white">=</span>
                    <span className="text-green-300">"rq_your_key"</span>
                    <span className="text-white">,</span>
                    {'\n'}
                    <span className="text-white">    </span>
                    <span className="text-orange-300">base_url</span>
                    <span className="text-white">=</span>
                    <span className="text-green-300">
                      "https://api.routiq.io/v1"
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
                className="btn-primary text-lg px-8 py-3 inline-block"
              >
                Get API Key
              </Link>
              <Link
                href="/dashboard"
                className="btn-secondary text-lg px-8 py-3 inline-block bg-transparent text-gray-300 border-gray-600 hover:bg-gray-800"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="py-20 bg-slate-800/50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8">
              {valueProps.map((prop) => (
                <div
                  key={prop.title}
                  className="p-6 rounded-xl bg-slate-800 border border-gray-700"
                >
                  <prop.icon className="w-10 h-10 text-primary-400 mb-4" />
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
        <section className="py-20 bg-slate-900" id="pricing">
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
                      ? 'border-primary-500 bg-slate-800 ring-2 ring-primary-500/20'
                      : 'border-gray-700 bg-slate-800'
                  }`}
                >
                  {plan.highlighted && (
                    <span className="inline-block px-3 py-1 text-xs font-medium text-primary-400 bg-primary-500/10 rounded-full mb-4">
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
                        <CheckIcon className="w-5 h-5 text-primary-400 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/keys"
                    className={`mt-8 block text-center py-2.5 px-5 rounded-lg font-medium transition-colors ${
                      plan.highlighted
                        ? 'bg-primary-500 hover:bg-primary-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
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
        <footer className="py-12 border-t border-gray-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-gray-400 text-sm">
              Built for Indian developers.
            </p>
            <p className="mt-2 text-gray-500 text-xs">
              &copy; {new Date().getFullYear()} Routiq. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
