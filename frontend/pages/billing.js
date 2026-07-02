import { useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import Link from 'next/link';
import { useAuth } from '../lib/auth';
import {
  CheckCircleIcon,
  ArrowUpIcon,
} from '@heroicons/react/24/outline';

const plans = [
  {
    name: 'Free',
    price: '₹0',
    limit: '1,000 requests/month',
    tokenLimit: 1000,
  },
  {
    name: 'Starter',
    price: '₹999',
    limit: '50,000 requests/month',
    tokenLimit: 50000,
  },
  {
    name: 'Pro',
    price: '₹2,999',
    limit: 'Unlimited requests',
    tokenLimit: null,
  },
];

const paymentHistory = [
  { id: 1, date: '2024-03-01', amount: '₹999', status: 'paid', invoice: 'INV-2024-003' },
  { id: 2, date: '2024-02-01', amount: '₹999', status: 'paid', invoice: 'INV-2024-002' },
  { id: 3, date: '2024-01-01', amount: '₹999', status: 'paid', invoice: 'INV-2024-001' },
  { id: 4, date: '2023-12-01', amount: '₹0', status: 'free', invoice: 'INV-2023-012' },
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
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>

        {/* Current Plan */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Current Plan
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                You are on the{' '}
                <span className="font-medium text-primary-600">
                  {currentPlan}
                </span>{' '}
                plan
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900">₹999</p>
              <p className="text-sm text-gray-500">per month</p>
            </div>
          </div>

          {/* Usage Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Requests used this month
              </span>
              <span className="text-sm text-gray-500">
                {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercent > 80
                    ? 'bg-orange-500'
                    : usagePercent > 60
                    ? 'bg-yellow-500'
                    : 'bg-primary-500'
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
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Upgrade Plan
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg border p-5 ${
                  plan.name === currentPlan
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  {plan.name === currentPlan && (
                    <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">{plan.price}</p>
                <p className="text-sm text-gray-500 mt-1">{plan.limit}</p>

                {plan.name !== currentPlan && (
                  <button
                    className={`mt-4 w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      plans.indexOf(plan) >
                      plans.findIndex((p) => p.name === currentPlan)
                        ? 'bg-primary-500 hover:bg-primary-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
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
                  <div className="mt-4 flex items-center gap-1 text-sm text-primary-600">
                    <CheckCircleIcon className="w-4 h-4" />
                    Active
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Payment History */}
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Payment History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paymentHistory.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payment.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-600 hover:text-primary-800 cursor-pointer font-medium">
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
