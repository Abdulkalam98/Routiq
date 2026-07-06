import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { useAuth, getToken } from '../lib/auth';
import {
  FunnelIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const API_BASE = '';

// Status badge colors
const STATUS_STYLES = {
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  cached: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
};

// Time range options
const TIME_RANGES = [
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.success;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {status}
    </span>
  );
}

function CacheTypeBadge({ cacheType }) {
  if (!cacheType) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
      {cacheType}
    </span>
  );
}

function LatencyIndicator({ ms }) {
  let color = 'text-green-400';
  if (ms > 3000) color = 'text-red-400';
  else if (ms > 1000) color = 'text-yellow-400';
  return <span className={`${color} font-mono text-xs`}>{ms}ms</span>;
}

export default function Logs() {
  useAuth();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 50;

  // Filters
  const [timeRange, setTimeRange] = useState('7d');
  const [modelFilter, setModelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [availableModels, setAvailableModels] = useState([]);

  // Expanded row
  const [expandedId, setExpandedId] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        range: timeRange,
      });
      if (modelFilter) params.set('model', modelFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`${API_BASE}/api/v1/dashboard/logs?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setHasMore(data.has_more || false);

        // Extract unique models for filter
        const models = [...new Set((data.logs || []).map((l) => l.model))];
        setAvailableModels((prev) => {
          const all = new Set([...prev, ...models]);
          return [...all].sort();
        });
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }, [offset, timeRange, modelFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [timeRange, modelFilter, statusFilter]);

  const handleExportCSV = () => {
    if (!logs.length) return;
    const headers = [
      'Timestamp',
      'Model',
      'Status',
      'Prompt Tokens',
      'Completion Tokens',
      'Cost (₹)',
      'Latency (ms)',
      'Cache Type',
      'Stream',
    ];
    const rows = logs.map((log) => [
      log.created_at,
      log.model,
      log.status,
      log.prompt_tokens,
      log.completion_tokens,
      log.cost_inr,
      log.latency_ms,
      log.cache_type || '',
      log.is_stream ? 'Yes' : 'No',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inferix-logs-${timeRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <Layout>
      <Head>
        <title>Request Logs - Inferix</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Request Logs</h1>
            <p className="text-sm text-gray-400 mt-1">
              Full observability — every request, cached response, and error
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
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
              Export
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="dashboard-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <FunnelIcon className="w-4 h-4 text-gray-500" />

            {/* Time range */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-dark-700 border border-dark-600 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:ring-red-500 focus:border-red-500"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Model filter */}
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="bg-dark-700 border border-dark-600 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">All models</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-dark-700 border border-dark-600 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="cached">Cached</option>
              <option value="error">Error</option>
            </select>

            {/* Results count */}
            <span className="text-xs text-gray-500 ml-auto">
              {total.toLocaleString()} requests
            </span>
          </div>
        </div>

        {/* Logs Table */}
        <div className="dashboard-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600 bg-dark-800/50">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Time</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Model</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Status</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Tokens</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Cost</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Latency</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">Cache</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      No requests found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="hover:bg-dark-700/30 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-gray-300 text-xs">{log.time_ago}</span>
                            <span className="text-gray-600 text-[10px] font-mono">
                              {log.created_at ? new Date(log.created_at).toLocaleTimeString() : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-200 font-medium text-xs">{log.model}</span>
                            {log.is_stream && (
                              <span className="text-[10px] text-gray-500 bg-dark-600 px-1.5 py-0.5 rounded">
                                stream
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-gray-300 font-mono text-xs">
                            {(log.total_tokens || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-gray-300 font-mono text-xs">
                            ₹{(log.cost_inr || 0).toFixed(4)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <LatencyIndicator ms={log.latency_ms || 0} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CacheTypeBadge cacheType={log.cache_type} />
                        </td>
                      </tr>

                      {/* Expanded row details */}
                      {expandedId === log.id && (
                        <tr key={`${log.id}-detail`} className="bg-dark-800/50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <span className="text-gray-500 block mb-1">Request ID</span>
                                <span className="text-gray-300 font-mono">
                                  {log.completion_id || log.id.slice(0, 12)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 block mb-1">Provider</span>
                                <span className="text-gray-300">{log.provider || 'unknown'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block mb-1">Prompt Tokens</span>
                                <span className="text-gray-300 font-mono">
                                  {(log.prompt_tokens || 0).toLocaleString()}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 block mb-1">Completion Tokens</span>
                                <span className="text-gray-300 font-mono">
                                  {(log.completion_tokens || 0).toLocaleString()}
                                </span>
                              </div>
                              {log.error_message && (
                                <div className="col-span-full">
                                  <span className="text-gray-500 block mb-1">Error</span>
                                  <span className="text-red-400 font-mono text-xs bg-red-500/5 px-2 py-1 rounded">
                                    {log.error_message}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700">
              <span className="text-xs text-gray-500">
                Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="p-1.5 rounded-lg bg-dark-700 border border-dark-600 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={!hasMore}
                  className="p-1.5 rounded-lg bg-dark-700 border border-dark-600 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary Stats Bar */}
        {logs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="dashboard-card p-3 text-center">
              <p className="text-xs text-gray-500">Avg Latency</p>
              <p className="text-lg font-bold text-white">
                {Math.round(logs.reduce((s, l) => s + (l.latency_ms || 0), 0) / logs.length)}ms
              </p>
            </div>
            <div className="dashboard-card p-3 text-center">
              <p className="text-xs text-gray-500">Cache Hits</p>
              <p className="text-lg font-bold text-blue-400">
                {logs.filter((l) => l.status === 'cached').length}/{logs.length}
              </p>
            </div>
            <div className="dashboard-card p-3 text-center">
              <p className="text-xs text-gray-500">Total Cost</p>
              <p className="text-lg font-bold text-white">
                ₹{logs.reduce((s, l) => s + (l.cost_inr || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="dashboard-card p-3 text-center">
              <p className="text-xs text-gray-500">Errors</p>
              <p className="text-lg font-bold text-red-400">
                {logs.filter((l) => l.status === 'error').length}
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
