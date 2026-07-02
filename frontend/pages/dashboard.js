import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { useAuth } from '../lib/auth';
import {
  CurrencyRupeeIcon,
  BoltIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const API_BASE = '';

const dummyStats = {
  total_spend_today: 42.5,
  total_requests_today: 312,
  total_requests_month: 8947,
};

const dummyCostByModel = [
  { model: 'gpt-4o', cost: 28.4 },
  { model: 'claude-sonnet', cost: 18.2 },
  { model: 'gpt-4o-mini', cost: 8.1 },
  { model: 'gemini-pro', cost: 5.6 },
  { model: 'mistral-large', cost: 3.2 },
];

const dummyRequests = [
  { id: 1, model: 'gpt-4o', tokens: 1243, cost: 0.18, latency: '320ms', time: '2 min ago' },
  { id: 2, model: 'claude-sonnet', tokens: 892, cost: 0.12, latency: '280ms', time: '5 min ago' },
  { id: 3, model: 'gpt-4o-mini', tokens: 456, cost: 0.02, latency: '180ms', time: '8 min ago' },
  { id: 4, model: 'gemini-pro', tokens: 2100, cost: 0.09, latency: '410ms', time: '12 min ago' },
  { id: 5, model: 'gpt-4o', tokens: 3200, cost: 0.32, latency: '520ms', time: '15 min ago' },
  { id: 6, model: 'mistral-large', tokens: 780, cost: 0.06, latency: '250ms', time: '18 min ago' },
  { id: 7, model: 'claude-sonnet', tokens: 1567, cost: 0.21, latency: '340ms', time: '22 min ago' },
  { id: 8, model: 'gpt-4o-mini', tokens: 320, cost: 0.01, latency: '120ms', time: '25 min ago' },
  { id: 9, model: 'gpt-4o', tokens: 2890, cost: 0.29, latency: '490ms', time: '30 min ago' },
  { id: 10, model: 'gemini-pro', tokens: 1100, cost: 0.05, latency: '300ms', time: '35 min ago' },
  { id: 11, model: 'claude-sonnet', tokens: 945, cost: 0.13, latency: '290ms', time: '40 min ago' },
  { id: 12, model: 'gpt-4o', tokens: 1800, cost: 0.22, latency: '380ms', time: '45 min ago' },
  { id: 13, model: 'mistral-large', tokens: 650, cost: 0.05, latency: '220ms', time: '50 min ago' },
  { id: 14, model: 'gpt-4o-mini', tokens: 280, cost: 0.01, latency: '110ms', time: '55 min ago' },
  { id: 15, model: 'gemini-pro', tokens: 1450, cost: 0.07, latency: '350ms', time: '1 hr ago' },
  { id: 16, model: 'gpt-4o', tokens: 2200, cost: 0.26, latency: '440ms', time: '1 hr ago' },
  { id: 17, model: 'claude-sonnet', tokens: 1780, cost: 0.24, latency: '360ms', time: '1 hr ago' },
  { id: 18, model: 'gpt-4o-mini', tokens: 510, cost: 0.02, latency: '150ms', time: '1 hr ago' },
  { id: 19, model: 'mistral-large', tokens: 890, cost: 0.07, latency: '270ms', time: '2 hr ago' },
  { id: 20, model: 'gpt-4o', tokens: 1600, cost: 0.20, latency: '400ms', time: '2 hr ago' },
];

export default function Dashboard() {
  useAuth();

  const [stats, setStats] = useState(dummyStats);
  const [costByModel, setCostByModel] = useState(dummyCostByModel);
  const [requests, setRequests] = useState(dummyRequests);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, costRes, requestsRes] = await Promise.all([
          fetch(`${API_BASE}/api/dashboard/stats`),
          fetch(`${API_BASE}/api/dashboard/cost-by-model`),
          fetch(`${API_BASE}/api/dashboard/requests?limit=20`),
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
        if (costRes.ok) {
          const data = await costRes.json();
          setCostByModel(data);
        }
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          setRequests(data);
        }
      } catch (err) {
        // Use dummy data on fetch failure
      }
    }
    fetchData();
  }, []);

  return (
    <Layout>
      <Head>
        <title>Dashboard - Routiq</title>
      </Head>

      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <CurrencyRupeeIcon className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Spend Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{stats.total_spend_today}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <BoltIcon className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Requests Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.total_requests_today.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <CalendarDaysIcon className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Requests This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.total_requests_month.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cost by Model Chart */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Cost by Model (₹)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costByModel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="model"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value) => [`₹${value}`, 'Cost']}
                />
                <Bar
                  dataKey="cost"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Requests Table */}
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Requests
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Latency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-primary-50 text-primary-700 font-mono">
                        {req.model}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                      {req.tokens.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      ₹{req.cost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {req.latency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {req.time}
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
