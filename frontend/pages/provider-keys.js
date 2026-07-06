import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { useAuth, getToken } from '../lib/auth';
import {
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  ArrowPathIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const API_BASE = '';

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini',
    placeholder: 'sk-...',
    color: 'from-green-500/20 to-green-600/5',
    border: 'border-green-500/30',
    icon: '🟢',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet, Claude Haiku',
    placeholder: 'sk-ant-...',
    color: 'from-orange-500/20 to-orange-600/5',
    border: 'border-orange-500/30',
    icon: '🟠',
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini 1.5 Pro, Gemini Flash',
    placeholder: 'AIza...',
    color: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/30',
    icon: '🔵',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral Large, Mistral Small',
    placeholder: 'your-mistral-key...',
    color: 'from-purple-500/20 to-purple-600/5',
    border: 'border-purple-500/30',
    icon: '🟣',
  },
];

export default function ProviderKeys() {
  useAuth();

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // provider being saved
  const [testing, setTesting] = useState(null); // provider being tested
  const [testResults, setTestResults] = useState({}); // {provider: {status, message}}

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalProvider, setModalProvider] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [labelInput, setLabelInput] = useState('');

  const fetchKeys = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/v1/provider-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch provider keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const getKeyForProvider = (providerId) => {
    return keys.find((k) => k.provider === providerId);
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim() || !modalProvider) return;
    setSaving(modalProvider.id);

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/v1/provider-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: modalProvider.id,
          api_key: keyInput.trim(),
          label: labelInput.trim() || null,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setKeyInput('');
        setLabelInput('');
        await fetchKeys();
      }
    } catch (err) {
      console.error('Failed to save key:', err);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteKey = async (providerId) => {
    if (!confirm(`Remove your ${providerId} key? Requests will use the platform key instead.`)) return;

    try {
      const token = getToken();
      await fetch(`${API_BASE}/api/v1/provider-keys/${providerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchKeys();
      setTestResults((prev) => ({ ...prev, [providerId]: null }));
    } catch (err) {
      console.error('Failed to delete key:', err);
    }
  };

  const handleTestKey = async (providerId) => {
    setTesting(providerId);
    setTestResults((prev) => ({ ...prev, [providerId]: null }));

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/v1/provider-keys/${providerId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTestResults((prev) => ({ ...prev, [providerId]: data }));
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: { status: 'error', message: 'Network error' },
      }));
    } finally {
      setTesting(null);
    }
  };

  const openModal = (provider) => {
    setModalProvider(provider);
    setKeyInput('');
    setLabelInput('');
    setShowModal(true);
  };

  return (
    <Layout>
      <Head>
        <title>Provider Keys - Routiq</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Provider Keys (BYOK)</h1>
          <p className="text-sm text-gray-400 mt-1">
            Bring Your Own Keys — use your own API keys with Routiq's caching, security, and observability
          </p>
        </div>

        {/* Info banner */}
        <div className="dashboard-card p-4 border-l-4 border-l-red-500">
          <div className="flex items-start gap-3">
            <KeyIcon className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-gray-300 font-medium">How BYOK works</p>
              <p className="text-gray-500 mt-1">
                Add your own provider keys below. When you make API calls, Routiq will use YOUR key
                instead of the platform key — you still get caching, PII redaction, prompt injection
                detection, and full observability. If no key is set, the platform key is used automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Provider Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROVIDERS.map((provider) => {
            const existingKey = getKeyForProvider(provider.id);
            const testResult = testResults[provider.id];
            const isConfigured = !!existingKey;

            return (
              <div
                key={provider.id}
                className={`dashboard-card p-5 bg-gradient-to-br ${provider.color} border ${
                  isConfigured ? provider.border : 'border-dark-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <div>
                      <h3 className="text-white font-semibold">{provider.name}</h3>
                      <p className="text-gray-500 text-xs">{provider.description}</p>
                    </div>
                  </div>

                  {/* Status badge */}
                  {isConfigured ? (
                    <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-full">
                      <CheckCircleIcon className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600 bg-dark-700 px-2 py-1 rounded-full">
                      Not configured
                    </span>
                  )}
                </div>

                {/* Key info */}
                {isConfigured && (
                  <div className="mt-4 bg-dark-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">
                          {existingKey.key_label || 'API Key'}
                        </p>
                        <p className="text-sm text-gray-300 font-mono mt-0.5">
                          ••••••••{existingKey.key_suffix}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Test result */}
                {testResult && (
                  <div
                    className={`mt-3 text-xs px-3 py-2 rounded-lg ${
                      testResult.status === 'valid'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {testResult.status === 'valid' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        {testResult.message}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircleIcon className="w-3.5 h-3.5" />
                        {testResult.message}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  {isConfigured ? (
                    <>
                      <button
                        onClick={() => openModal(provider)}
                        className="text-xs bg-dark-700 hover:bg-dark-600 text-gray-300 px-3 py-1.5 rounded-lg border border-dark-600 transition-colors"
                      >
                        Update Key
                      </button>
                      <button
                        onClick={() => handleTestKey(provider.id)}
                        disabled={testing === provider.id}
                        className="text-xs bg-dark-700 hover:bg-dark-600 text-gray-300 px-3 py-1.5 rounded-lg border border-dark-600 transition-colors disabled:opacity-50"
                      >
                        {testing === provider.id ? (
                          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin inline" />
                        ) : (
                          'Test'
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteKey(provider.id)}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openModal(provider)}
                      className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      Add Key
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Update Key Modal */}
      {showModal && modalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1">
              {getKeyForProvider(modalProvider.id) ? 'Update' : 'Add'} {modalProvider.name} Key
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Your key is encrypted and stored securely. It's never exposed in API responses.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">API Key</label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={modalProvider.placeholder}
                  className="w-full bg-dark-700 border border-dark-600 text-gray-200 text-sm rounded-lg px-3 py-2.5 focus:ring-red-500 focus:border-red-500 font-mono"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="e.g., Production Key"
                  className="w-full bg-dark-700 border border-dark-600 text-gray-200 text-sm rounded-lg px-3 py-2.5 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveKey}
                disabled={!keyInput.trim() || saving === modalProvider.id}
                className="text-sm bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {saving === modalProvider.id ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
