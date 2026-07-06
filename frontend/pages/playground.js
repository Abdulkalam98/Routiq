import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { useAuth, getToken } from '../lib/auth';
import { PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';

const API_BASE = '';

const MODELS = [
  { id: 'auto', name: 'Auto (Smart)', provider: 'Inferix' },
  { id: 'gemini-flash', name: 'Gemini Flash', provider: 'Google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet', provider: 'Anthropic' },
  { id: 'claude-haiku', name: 'Claude Haiku', provider: 'Anthropic' },
  { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral' },
  { id: 'mistral-small', name: 'Mistral Small', provider: 'Mistral' },
];

const PRESETS = [
  { id: 'none', name: 'No Preset', prompt: '' },
  { id: 'summarizer', name: 'Summarizer', prompt: 'You are a concise summarizer. Respond with bullet points only.' },
  { id: 'translator', name: 'Translator', prompt: "Translate the user's text to English. If already English, translate to Hindi." },
  { id: 'code-helper', name: 'Code Helper', prompt: 'You are a coding assistant. Give concise code examples with comments. No fluff.' },
  { id: 'explainer', name: 'Explainer', prompt: "Explain like I'm 5. Use simple language and analogies." },
  { id: 'grammar-fixer', name: 'Grammar Fixer', prompt: "Fix the grammar and spelling in the user's text. Return only the corrected version." },
];

export default function Playground() {
  useAuth();

  const [model, setModel] = useState('auto');
  const [preset, setPreset] = useState('none');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const token = getToken();
    if (!token) return;

    const userMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    // Build messages to send (prepend system preset if active)
    const activePreset = PRESETS.find((p) => p.id === preset);
    const messagesToSend = activePreset && activePreset.prompt
      ? [{ role: 'system', content: activePreset.prompt }, ...updatedMessages.map((m) => ({ role: m.role, content: m.content }))]
      : updatedMessages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/playground/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model,
          messages: messagesToSend,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.content,
            tokens: data.usage.total_tokens,
            cost_inr: data.cost_inr,
            model: data.model,
            cached: data.cached || false,
          },
        ]);
      } else {
        const err = await res.json().catch(() => null);
        const errMsg = err?.detail?.error?.message || 'Something went wrong. Please try again.';
        setMessages((prev) => [
          ...prev,
          { role: 'error', content: errMsg },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'error', content: 'Network error. Please try again.' },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <Layout>
      <Head>
        <title>Playground - Inferix</title>
      </Head>

      <div className="flex flex-col h-[calc(100vh-10rem)]">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-white">Playground</h1>
          <div className="flex items-center gap-3">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-dark-700 border border-dark-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:ring-red-500 focus:border-red-500 outline-none"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="bg-dark-700 border border-dark-600 text-gray-300 text-sm rounded-lg px-3 py-2 focus:ring-red-500 focus:border-red-500 outline-none"
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-white border border-dark-600 rounded-lg hover:bg-dark-700 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Active preset badge */}
        {preset !== 'none' && (
          <div className="mb-2">
            <span className="inline-flex items-center px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-medium">
              🎯 Preset: {PRESETS.find((p) => p.id === preset)?.name}
            </span>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto border border-dark-600 rounded-xl bg-dark-800 p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Send a message to start testing
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-red-600 text-white'
                    : msg.role === 'error'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-dark-700 text-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && msg.tokens != null && (
                  <p className="mt-1 text-xs text-gray-500">
                    {msg.cached && <span className="text-amber-400 font-medium mr-1">⚡ Cached</span>}
                    {msg.tokens} tokens · ₹{msg.cost_inr.toFixed(4)}
                    {msg.cached && <span className="ml-1 text-green-400">(saved!)</span>}
                    {msg.model && <span className="ml-2 text-gray-500">via {msg.model}</span>}
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-dark-700 rounded-xl px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="mt-4 flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 px-4 py-3 bg-dark-800 border border-dark-600 text-gray-200 placeholder-gray-500 rounded-xl resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Layout>
  );
}
