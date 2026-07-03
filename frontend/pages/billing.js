import { useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { useAuth } from '../lib/auth';
import {
  CheckCircleIcon,
  ArrowUpIcon,
} from '@heroicons/react/24/outline';

const plans = [
  {
    name: 'Free',
    price: '₹0',
    limit: '100K tokens/month',
    features: ['3 models', '10 req/min', 'Community support'],
  },
  {
    name: 'Starter',
    price: '₹999',
    limit: '2M tokens/month',
    features: ['All models', '60 req/min', 'Email support', 'Smart routing'],
  },
  {
    name: 'Pro',
    price: '₹2,999',
    limit: '20M tokens/month',
    features: ['All models', '300 req/min', 'Priority support', 'Smart routing', 'Custom caching'],
  },
];

const paymentHistory = [
  { id: 1, date: '2026-07-01', amount: '₹999', status: 'paid', invoice: 'INV-2026-007' },
  { id: 2, date: '2026-06-01', amount: '₹999', status: 'paid', invoice: 'INV-2026-006' },
  { id: 3, date: '2026-05-18', amount: '₹0', status: 'free', invoice: 'INV-2026-005' },
];

export default function Billing() {
  useAuth();

  const [currentPlan] = useState('Starter');
  const [usage] = useState({ used: 32450, limit: 50000 });

  const usagePercent = (usage.used / usage.limit) * 100;

  return (
    <Layout>
      <Head>
        <title>Billing - Routiq</title>
      </Head>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your subscription and payment history</p>
        </div>

        {/* Current Plan */}
        <div className="dashboard-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Current Plan
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                You are on the{' '}
                <span className="font-medium text-red-400">
                  {currentPlan}
                </span>{' '}
                plan
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">₹999</p>
              <p className="text-sm text-gray-500">per month</p>
            </div>
          </div>

          {/* Usage Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">
                Requests used this month
              </span>
              <span className="text-sm text-gray-400">
                {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2.5 bg-dark-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercent > 80
                    ? 'bg-red-500'
                    : usagePercent > 60
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {usagePercent.toFixed(1)}% of your monthly limit used
            </p>
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="dashboard-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Available Plans
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-5 transition-all ${
                  plan.name === currentPlan
                    ? 'border-red-500/50 bg-red-500/5'
                    : 'border-dark-600 hover:border-dark-500 bg-dark-700/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white">{plan.name}</h3>
                  {plan.name === currentPlan && (
                    <span className="text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-white">{plan.price}</p>
                <p className="text-sm text-gray-400 mt-1">{plan.limit}</p>

                {/* Features */}
                <ul className="mt-3 space-y-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="text-xs text-gray-400 flex items-center gap-1.5">
                      <CheckCircleIcon className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.name !== currentPlan && (
                  <button
                    className={`mt-4 w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      plans.indexOf(plan) >
                      plans.findIndex((p) => p.name === currentPlan)
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-dark-600 hover:bg-dark-500 text-gray-300'
                    }`}
                  >
                    {plans.indexOf(plan) >
                    plans.findIndex((p) => p.name === currentPlan) ? (
                      <span className="flex items-center justify-center gap-1">
                        <ArrowUpIcon className="w-4 h-4" />
                        Upgrade
                      </span>
                    ) : (
                      'Downgrade'
                    )}
                  </button>
                )}

                {plan.name === currentPlan && (
                  <div className="mt-4 flex items-center gap-1 text-sm text-red-400">
                    <CheckCircleIcon className="w-4 h-4" />
                    Active
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Payment History */}
        <div className="dashboard-card overflow-hidden">
          <div className="p-6 border-b border-dark-600">
            <h2 className="text-lg font-semibold text-white">
              Payment History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600">
                {paymentHistory.map((payment) => (
                  <tr key={payment.id} className="hover:bg-dark-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {payment.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {payment.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payment.status === 'paid'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400 hover:text-red-300 cursor-pointer font-medium">
                      {payment.invoice}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
