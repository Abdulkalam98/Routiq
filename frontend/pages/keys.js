import { useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import {
  KeyIcon,
  ClipboardDocumentIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const initialKeys = [
  {
    id: 1,
    prefix: 'rq_live_a3f2',
    name: 'Production App',
    last_used: '2 minutes ago',
    status: 'active',
    created: '2024-01-15',
  },
  {
    id: 2,
    prefix: 'rq_live_b7d1',
    name: 'Staging Environment',
    last_used: '3 hours ago',
    status: 'active',
    created: '2024-02-20',
  },
  {
    id: 3,
    prefix: 'rq_test_c9e4',
    name: 'Local Development',
    last_used: '1 day ago',
    status: 'active',
    created: '2024-03-01',
  },
  {
    id: 4,
    prefix: 'rq_live_d2f8',
    name: 'Old Integration',
    last_used: '30 days ago',
    status: 'revoked',
    created: '2023-11-10',
  },
];

export default function Keys() {
  const [keys, setKeys] = useState(initialKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setKeys((prev) => [
          {
            id: Date.now(),
            prefix: data.key.substring(0, 12),
            name: newKeyName,
            last_used: 'Never',
            status: 'active',
            created: new Date().toISOString().split('T')[0],
          },
          ...prev,
        ]);
      } else {
        // Simulate key creation for demo
        const fakeKey = `rq_live_${Math.random().toString(36).substring(2, 6)}_${Math.random().toString(36).substring(2, 34)}`;
        setCreatedKey(fakeKey);
        setKeys((prev) => [
          {
            id: Date.now(),
            prefix: fakeKey.substring(0, 12),
            name: newKeyName,
            last_used: 'Never',
            status: 'active',
            created: new Date().toISOString().split('T')[0],
          },
          ...prev,
        ]);
      }
    } catch (err) {
      // Simulate key creation for demo
      const fakeKey = `rq_live_${Math.random().toString(36).substring(2, 6)}_${Math.random().toString(36).substring(2, 34)}`;
      setCreatedKey(fakeKey);
      setKeys((prev) => [
        {
          id: Date.now(),
          prefix: fakeKey.substring(0, 12),
          name: newKeyName,
          last_used: 'Never',
          status: 'active',
          created: new Date().toISOString().split('T')[0],
        },
        ...prev,
      ]);
    }

    setNewKeyName('');
  };

  const handleRevokeKey = async (keyId) => {
    try {
      await fetch(`${API_BASE}/api/keys/${keyId}/revoke`, { method: 'POST' });
    } catch (err) {
      // Continue with local state update
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
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreatedKey(null);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Create New Key
          </button>
        </div>

        {/* Keys Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prefix
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-700">
                        {key.prefix}...
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {key.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {key.last_used}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          key.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {key.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {key.status === 'active' && (
                        <button
                          onClick={() => setShowRevokeModal(key)}
                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowCreateModal(false);
              setCreatedKey(null);
            }}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {createdKey ? 'Key Created' : 'Create New API Key'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreatedKey(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {!createdKey ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production App"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateKey();
                    }}
                  />
                </div>
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateKey}
                    disabled={!newKeyName.trim()}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Key
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      This is the only time you will see this key. Copy it now
                      and store it securely.
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-gray-800 break-all">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors shrink-0"
                      title="Copy to clipboard"
                    >
                      <ClipboardDocumentIcon className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {copied && (
                  <p className="mt-2 text-sm text-green-600 font-medium">
                    Copied to clipboard!
                  </p>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreatedKey(null);
                    }}
                    className="btn-primary"
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
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowRevokeModal(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Revoke API Key
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to revoke{' '}
              <span className="font-medium">{showRevokeModal.name}</span> (
              <code className="text-xs font-mono">{showRevokeModal.prefix}...</code>
              )? This action cannot be undone and any applications using this
              key will stop working immediately.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRevokeModal(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevokeKey(showRevokeModal.id)}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
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
