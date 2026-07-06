import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { useAuth, getToken } from '../lib/auth';
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  CurrencyDollarIcon,
  CircleStackIcon,
  BoltIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const API_BASE = '';

// Time range options
const TIME_RANGES = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
];

// Color palette for models
const MODEL_COLORS = {
  'gemini-flash': '#ef4444',
  'gemini-1.5-pro': '#f97316',
  'gpt-4o': '#3b82f6',
  'gpt-4o-mini': '#8b5cf6',
  'claude-sonnet': '#ec4899',
  'claude-haiku': '#14b8a6',
  'mistral-large': '#eab308',
  'mistral-small': '#84cc16',
  'auto': '#6b7280',
};

function formatNumber(num) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toString();
}

function formatCurrency(amount) {
  return '₹' + amount.toFixed(2);
}

export default function Dashboard() {
  useAuth();

  const [timeRange, setTimeRange] = useState('30d');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelFilter, setModelFilter] = useState('all');

  // Data state
  const [stats, setStats] = useState({
    total_spend: 0,
    total_tokens: 0,
    total_requests: 0,
    cache_hit_rate: 0,
    avg_spend_per_day: 0,
    avg_tokens_per_day: 0,
    budget_used: 0,
    budget_limit: 0,
    budget_resets: null,
  });
  const [costByModel, setCostByModel] = useState([]);
  const [dailySpend, setDailySpend] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [statsRes, costRes, requestsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/dashboard/stats?range=${timeRange}`, { headers }),
        fetch(`${API_BASE}/api/v1/dashboard/cost-by-model?range=${timeRange}`, { headers }),
        fetch(`${API_BASE}/api/v1/dashboard/requests?limit=50&range=${timeRange}`, { headers }),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats({
          total_spend: data.total_spend_today || 0,
          total_tokens: data.total_tokens || 0,
          total_requests: data.total_requests_today || data.total_requests_month || 0,
          cache_hit_rate: data.cache_hit_rate || 0,
          avg_spend_per_day: data.avg_spend_per_day || 0,
          avg_tokens_per_day: data.avg_tokens_per_day || 0,
          budget_used: data.budget_used || 0,
          budget_limit: data.budget_limit || 0,
          budget_resets: data.budget_resets || null,
        });
      }

      if (costRes.ok) {
        const data = await costRes.json();
        setCostByModel(data);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        // Build daily spend chart from requests
        const dailyMap = {};
        data.forEach((req) => {
          const date = req.time ? req.time.split('T')[0] : new Date().toISOString().split('T')[0];
          if (!dailyMap[date]) dailyMap[date] = {};
          if (!dailyMap[date][req.model]) dailyMap[date][req.model] = 0;
          dailyMap[date][req.model] += req.cost || 0;
        });
        const dailyArr = Object.entries(dailyMap)
          .map(([date, models]) => ({ date, ...models }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setDailySpend(dailyArr);
      }

      setLastUpdated(new Date());
    } catch (err) {
      // Keep existing data on error
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCSV = () => {
    if (!costByModel.length) return;
    const headers = ['Model', 'Spend (₹)', 'Tokens', 'Requests', '% of Total'];
    const totalSpend = costByModel.reduce((sum, m) => sum + (m.cost || 0), 0);
    const rows = costByModel.map((m) => [
      m.model,
      (m.cost || 0).toFixed(2),
      m.tokens || 0,
      m.requests || 0,
      totalSpend > 0 ? ((m.cost / totalSpend) * 100).toFixed(1) + '%' : '0%',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inferix-usage-${timeRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalSpend = costByModel.reduce((sum, m) => sum + (m.cost || 0), 0);
  const totalTokens = costByModel.reduce((sum, m) => sum + (m.tokens || 0), 0);
  const totalRequests = costByModel.reduce((sum, m) => sum + (m.requests || 0), 0);
  const allModels = [...new Set(costByModel.map((m) => m.model))];

  // Budget calculation
  const budgetPercent =
    stats.budget_limit > 0
      ? Math.round((stats.budget_used / stats.budget_limit) * 100)
      : 0;

  return (
    <Layout>
      <Head>
        <title>Usage Dashboard - Inferix</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Usage Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">
              Track your spend and usage across models
            </p>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Last updated: {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
              </span>
            )}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-dark-700 border border-dark-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg border border-dark-600 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stat Cards — 4 cards in a row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Spend */}
          <div className="dashboard-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Total Spend</span>
              <CurrencyDollarIcon className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(totalSpend || stats.total_spend)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(stats.avg_spend_per_day || totalSpend / 30)}/day avg
            </p>
          </div>

          {/* Total Tokens */}
          <div className="dashboard-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Total Tokens</span>
              <CircleStackIcon className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-white">
              {formatNumber(totalTokens || stats.total_tokens)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              <span className="text-primary-400 bg-primary-400/10 px-1.5 py-0.5 rounded text-[10px] font-medium">
                {formatNumber(stats.avg_tokens_per_day || totalTokens / 30)}/day avg
              </span>
            </p>
          </div>

          {/* Total Requests */}
          <div className="dashboard-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Total Requests</span>
              <BoltIcon className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-white">
              {formatNumber(totalRequests || stats.total_requests)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.cache_hit_rate > 0
                ? `${stats.cache_hit_rate.toFixed(1)}% cache hit rate`
                : 'Cache enabled'}
            </p>
          </div>

          {/* Budget */}
          <div className="dashboard-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Budget (7d)</span>
              <ShieldCheckIcon className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-white">{budgetPercent}%</p>
            {/* Progress bar */}
            <div className="w-full bg-dark-600 rounded-full h-1.5 mt-2 mb-1">
              <div
                className={`h-1.5 rounded-full ${
                  budgetPercent > 80 ? 'bg-red-500' : budgetPercent > 50 ? 'bg-yellow-500' : 'bg-primary-500'
                }`}
                style={{ width: `${Math.min(budgetPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {formatCurrency(stats.budget_used)} of {formatCurrency(stats.budget_limit || 500)} limit
            </p>
            {stats.budget_resets && (
              <p className="text-xs text-gray-600">Resets on {stats.budget_resets}</p>
            )}
          </div>
        </div>

        {/* Bottom Section: Table + Chart side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Model Usage Breakdown Table */}
          <div className="dashboard-card p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">Model Usage Breakdown</h2>
              <p className="text-sm text-gray-500">Spend and usage by model</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600">
                    <th className="text-left text-gray-400 font-medium pb-3">Model Name</th>
                    <th className="text-right text-gray-400 font-medium pb-3">Spend</th>
                    <th className="text-right text-gray-400 font-medium pb-3">Tokens</th>
                    <th className="text-right text-gray-400 font-medium pb-3">Requests</th>
                    <th className="text-right text-gray-400 font-medium pb-3">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600">
                  {costByModel.length > 0 ? (
                    costByModel
                      .sort((a, b) => (b.cost || 0) - (a.cost || 0))
                      .map((row) => (
                        <tr key={row.model} className="hover:bg-dark-700/50">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{
                                  backgroundColor: MODEL_COLORS[row.model] || '#ef4444',
                                }}
                              />
                              <span className="text-gray-200 font-medium">{row.model}</span>
                            </div>
                          </td>
                          <td className="py-3 text-right text-gray-300">
                            {formatCurrency(row.cost || 0)}
                          </td>
                          <td className="py-3 text-right text-gray-300">
                            {formatNumber(row.tokens || 0)}
                          </td>
                          <td className="py-3 text-right text-gray-300">
                            {formatNumber(row.requests || 0)}
                          </td>
                          <td className="py-3 text-right text-gray-300">
                            {totalSpend > 0
                              ? (((row.cost || 0) / totalSpend) * 100).toFixed(1) + '%'
                              : '0%'}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No usage data yet. Make some API calls to see stats here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Spend by Model Chart */}
          <div className="dashboard-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Daily Spend by Model</h2>
                <p className="text-sm text-gray-500">Model usage breakdown per day</p>
              </div>
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="bg-dark-700 border border-dark-600 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All models</option>
                {allModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-64">
              {dailySpend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySpend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={{ stroke: '#374151' }}
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => '₹' + val}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#e5e7eb',
                      }}
                      formatter={(value, name) => [`₹${value.toFixed(2)}`, name]}
                      labelFormatter={(label) => {
                        const d = new Date(label);
                        return d.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });
                      }}
                    />
                    {(modelFilter === 'all' ? allModels : [modelFilter]).map((model) => (
                      <Bar
                        key={model}
                        dataKey={model}
                        stackId="spend"
                        fill={MODEL_COLORS[model] || '#ef4444'}
                        radius={[2, 2, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  No daily data yet. Usage will appear here over time.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
