import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { useAuth, getToken } from '../lib/auth';
import {
  KeyIcon,
  ClipboardDocumentIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const API_BASE = '';

export default function Keys() {
  const user = useAuth();

  const [keys, setKeys] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${API_BASE}/api/v1/keys`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          setKeys(
            data.data.map((k) => ({
              id: k.id,
              prefix: k.prefix,
              name: k.name,
              last_used: k.last_used_at || 'Never',
              status: k.is_active ? 'active' : 'revoked',
              created: k.created_at,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setError('');

    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newKeyName }),
      });

      const data = await res.json();

      if (res.ok) {
        setCreatedKey(data.key);
        setKeys((prev) => [
          {
            id: data.id,
            prefix: data.prefix,
            name: newKeyName,
            last_used: 'Never',
            status: 'active',
            created: data.created_at,
          },
          ...prev,
        ]);
      } else {
        setError(data?.detail?.error?.message || data?.error?.message || 'Failed to create key');
      }
    } catch {
      setError('Network error. Please try again.');
    }

    setNewKeyName('');
  };

  const handleRevokeKey = async (keyId) => {
    const token = getToken();
    if (token) {
      try {
        await fetch(`${API_BASE}/api/v1/keys/${keyId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {}
    }

    setKeys((prev) =>
      prev.map((k) => (k.id === keyId ? { ...k, status: 'revoked' } : k))
    );
    setShowRevokeModal(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout>
      <Head>
        <title>API Keys - Routiq</title>
      </Head>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">API Keys</h1>
            <p className="text-sm text-gray-400 mt-1">Manage your API keys for authentication</p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreatedKey(null);
            }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Create New Key
          </button>
        </div>

        {/* Keys Table */}
        <div className="dashboard-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Prefix
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600">
                {keys.length > 0 ? (
                  keys.map((key) => (
                    <tr key={key.id} className="hover:bg-dark-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm text-gray-300">
                          {key.prefix}...
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                        {key.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {key.last_used}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            key.status === 'active'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {key.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {key.status === 'active' && (
                          <button
                            onClick={() => setShowRevokeModal(key)}
                            className="text-sm text-red-400 hover:text-red-300 font-medium"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <KeyIcon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                      <p>No API keys yet. Create one to get started.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => {
              setShowCreateModal(false);
              setCreatedKey(null);
            }}
          />
          <div className="relative bg-dark-800 border border-dark-600 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {createdKey ? 'Key Created' : 'Create New API Key'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreatedKey(null);
                }}
                className="text-gray-400 hover:text-gray-200"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {!createdKey ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Key Name
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production App"
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 text-gray-200 placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateKey();
                      }}
                    />
                  </div>
                </div>
                {error && (
                  <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                    {error}
                  </div>
                )}
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-300 border border-dark-600 rounded-lg hover:bg-dark-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateKey}
                    disabled={!newKeyName.trim()}
                    className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Create Key
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-300">
                      This is the only time you will see this key. Copy it now
                      and store it securely.
                    </p>
                  </div>
                </div>

                <div className="bg-dark-700 border border-dark-600 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-green-400 break-all">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="p-2 hover:bg-dark-600 rounded-lg transition-colors shrink-0"
                      title="Copy to clipboard"
                    >
                      <ClipboardDocumentIcon className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                {copied && (
                  <p className="mt-2 text-sm text-green-400 font-medium">
                    ✓ Copied to clipboard!
                  </p>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreatedKey(null);
                    }}
                    className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowRevokeModal(null)}
          />
          <div className="relative bg-dark-800 border border-dark-600 rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-full border border-red-500/20">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Revoke API Key
              </h3>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to revoke{' '}
              <span className="font-medium text-white">{showRevokeModal.name}</span> (
              <code className="text-xs font-mono text-gray-300">{showRevokeModal.prefix}...</code>
              )? This action cannot be undone and any applications using this
              key will stop working immediately.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRevokeModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-300 border border-dark-600 rounded-lg hover:bg-dark-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevokeKey(showRevokeModal.id)}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Revoke Key
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
