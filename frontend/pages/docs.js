import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { ClipboardDocumentIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-1.5 rounded-md bg-dark-600 hover:bg-dark-500 text-gray-400 hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? (
        <span className="text-xs text-green-400">✓ Copied</span>
      ) : (
        <ClipboardDocumentIcon className="w-4 h-4" />
      )}
    </button>
  );
}

function CodeBlock({ code, language = 'python' }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-dark-600 bg-[#0d0d14] my-4 group">
      <div className="flex items-center justify-between px-4 py-2 bg-dark-800 border-b border-dark-600">
        <span className="text-[11px] text-gray-500 font-mono uppercase tracking-wider">{language}</span>
      </div>
      <CopyButton text={code} />
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="text-gray-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}

function EndpointBadge({ method, path }) {
  const colors = {
    GET: 'bg-green-500/10 text-green-400 border-green-500/20',
    POST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <div className="flex items-center gap-2 bg-dark-800 border border-dark-600 rounded-lg px-4 py-2.5 my-4 font-mono text-sm">
      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${colors[method] || colors.GET}`}>
        {method}
      </span>
      <span className="text-gray-300">{path}</span>
    </div>
  );
}

const NAV_SECTIONS = [
  { id: 'quickstart', title: 'Quick Start', icon: '🚀' },
  { id: 'authentication', title: 'Authentication', icon: '🔑' },
  { id: 'chat-completions', title: 'Chat Completions', icon: '💬' },
  { id: 'streaming', title: 'Streaming', icon: '⚡' },
  { id: 'models', title: 'Models', icon: '🤖' },
  { id: 'smart-routing', title: 'Smart Routing', icon: '🧠' },
  { id: 'caching', title: 'Caching', icon: '💾' },
  { id: 'context-compression', title: 'Context Compression', icon: '📦' },
  { id: 'rate-limits', title: 'Rate Limits', icon: '🚦' },
  { id: 'errors', title: 'Errors', icon: '⚠️' },
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState('quickstart');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px' }
    );

    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Head>
        <title>Documentation - Inferix</title>
        <meta name="description" content="Inferix API documentation. OpenAI-compatible endpoint for multiple LLM providers." />
      </Head>

      <div className="min-h-screen bg-dark-900">
        <Navbar />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">

            {/* Sidebar Navigation */}
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-24">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dark-600">
                  <BookOpenIcon className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">API Reference</span>
                </div>
                <nav className="space-y-0.5">
                  {NAV_SECTIONS.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                        activeSection === section.id
                          ? 'bg-red-500/10 text-red-400 font-medium'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
                      }`}
                    >
                      <span className="text-xs">{section.icon}</span>
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 max-w-3xl">

              {/* Quick Start */}
              <section id="quickstart" className="mb-16">
                <h1 className="text-3xl font-bold text-white mb-2">Quick Start</h1>
                <p className="text-gray-400 mb-6">
                  Get running with Inferix in 30 seconds. No SDK changes needed.
                </p>

                <div className="space-y-6">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Get your API key</h3>
                      <p className="text-gray-400 text-sm mb-2">
                        Create one from the <Link href="/keys" className="text-red-400 hover:text-red-300 underline">dashboard</Link> or via curl:
                      </p>
                      <CodeBlock language="bash" code={`curl -X POST https://inferix-api.onrender.com/v1/keys/create \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My App", "email": "you@example.com"}'`} />
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Make your first request</h3>
                      <CodeBlock language="python" code={`from openai import OpenAI

client = OpenAI(
    api_key="rq_your_key_here",
    base_url="https://inferix-api.onrender.com/v1"
)

response = client.chat.completions.create(
    model="gemini-flash",  # or "auto" for smart routing
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`} />
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">That&apos;s it!</h3>
                      <p className="text-gray-400 text-sm">
                        Your existing OpenAI code works with zero other changes. Switch models by changing the <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">model</code> parameter.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Authentication */}
              <section id="authentication" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-3">Authentication</h2>
                <p className="text-gray-400 mb-4">
                  Pass your API key in the <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">Authorization</code> header:
                </p>
                <CodeBlock language="http" code={`Authorization: Bearer rq_your_key_here`} />
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4 flex items-start gap-3">
                  <span className="text-amber-400 text-lg">⚠️</span>
                  <p className="text-sm text-amber-300">
                    Keys start with <code className="text-amber-200 font-mono">rq_</code>. Never expose them in client-side code or public repositories.
                  </p>
                </div>
              </section>

              {/* Chat Completions */}
              <section id="chat-completions" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-3">Chat Completions</h2>
                <p className="text-gray-400 mb-2">
                  OpenAI-compatible. Supports all standard parameters.
                </p>
                <EndpointBadge method="POST" path="/v1/chat/completions" />

                <h3 className="text-lg font-semibold text-white mt-6 mb-2">Request</h3>
                <CodeBlock language="bash" code={`curl -X POST https://inferix-api.onrender.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer rq_your_key" \\
  -d '{
    "model": "gemini-flash",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is Inferix?"}
    ],
    "temperature": 0.7,
    "max_tokens": 500
  }'`} />

                <h3 className="text-lg font-semibold text-white mt-6 mb-2">Response</h3>
                <CodeBlock language="json" code={`{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1719900000,
  "model": "gemini-flash",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "Inferix is an AI API gateway..."},
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 42,
    "total_tokens": 67
  }
}`} />

                <h3 className="text-lg font-semibold text-white mt-6 mb-2">Parameters</h3>
                <div className="border border-dark-600 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-dark-800 border-b border-dark-600">
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">Parameter</th>
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">Type</th>
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">Description</th>
                    </tr></thead>
                    <tbody className="divide-y divide-dark-600">
                      <tr><td className="px-4 py-2 font-mono text-red-400">model</td><td className="px-4 py-2 text-gray-400">string</td><td className="px-4 py-2 text-gray-300">Model ID or &quot;auto&quot;</td></tr>
                      <tr><td className="px-4 py-2 font-mono text-red-400">messages</td><td className="px-4 py-2 text-gray-400">array</td><td className="px-4 py-2 text-gray-300">Conversation messages</td></tr>
                      <tr><td className="px-4 py-2 font-mono text-gray-400">stream</td><td className="px-4 py-2 text-gray-400">boolean</td><td className="px-4 py-2 text-gray-300">Enable SSE streaming</td></tr>
                      <tr><td className="px-4 py-2 font-mono text-gray-400">temperature</td><td className="px-4 py-2 text-gray-400">float</td><td className="px-4 py-2 text-gray-300">0.0 to 2.0 (default: 1.0)</td></tr>
                      <tr><td className="px-4 py-2 font-mono text-gray-400">max_tokens</td><td className="px-4 py-2 text-gray-400">int</td><td className="px-4 py-2 text-gray-300">Max response tokens</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Streaming */}
              <section id="streaming" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-3">Streaming</h2>
                <p className="text-gray-400 mb-4">Add <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">&quot;stream&quot;: true</code> for Server-Sent Events:</p>
                <CodeBlock language="python" code={`stream = client.chat.completions.create(
    model="gemini-flash",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`} />
              </section>

              {/* Models */}
              <section id="models" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-3">Supported Models</h2>
                <div className="border border-dark-600 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-dark-800 border-b border-dark-600">
                      <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Model</th>
                      <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Provider</th>
                      <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Best For</th>
                    </tr></thead>
                    <tbody className="divide-y divide-dark-600">
                      <tr className="hover:bg-dark-800/50"><td className="px-4 py-2.5 font-mono text-red-400 font-medium">auto</td><td className="px-4 py-2.5 text-gray-300">Inferix</td><td className="px-4 py-2.5 text-gray-400">Smart routing — cheapest model for your prompt</td></tr>
                      <tr className="hover:bg-dark-800/50"><td className="px-4 py-2.5 font-mono text-gray-300">gemini-flash</td><td className="px-4 py-2.5 text-gray-300">Google</td><td className="px-4 py-2.5 text-gray-400">Fast, cheap, general tasks</td></tr>
                      <tr className="hover:bg-dark-800/50"><td className="px-4 py-2.5 font-mono text-gray-300">gemini-1.5-pro</td><td className="px-4 py-2.5 text-gray-300">Google</td><td className="px-4 py-2.5 text-gray-400">Long context, complex reasoning</td></tr>
                      <tr className="hover:bg-dark-800/50"><td className="px-4 py-2.5 font-mono text-gray-300">gpt-4o</td><td className="px-4 py-2.5 text-gray-300">OpenAI</td><td className="px-4 py-2.5 text-gray-400">Best overall quality</td></tr>
                      <tr className="hover:bg-dark-800/50"><td className="px-4 py-2.5 font-mono text-gray-300">gpt-4o-mini</td><td className="px-4 py-2.5 text-gray-300">OpenAI</td><td className="px-4 py-2.5 text-gray-400">Balanced speed & quality</td></tr>
                      <tr className="hover:bg-dark-800/50"><td className="px-4 py-2.5 font-mono text-gray-300">claude-sonnet-4-6</td><td className="px-4 py-2.5 text-gray-300">Anthropic</td><td className="px-4 py-2.5 text-gray-400">Code, analysis, writing</td></tr>
                      <tr className="hover:bg-dark-800/50"><td className="px-4 py-2.5 font-mono text-gray-300">claude-haiku</td><td className="px-4 py-2.5 text-gray-300">Anthropic</td><td className="px-4 py-2.5 text-gray-400">Fast, concise responses</td></tr>
                      <tr className="hover:bg-dark-800/50"><td className="px-4 py-2.5 font-mono text-gray-300">mistral-large</td><td className="px-4 py-2.5 text-gray-300">Mistral</td><td className="px-4 py-2.5 text-gray-400">Multilingual, reasoning</td></tr>
                      <tr className="hover:bg-dark-800/50"><td className="px-4 py-2.5 font-mono text-gray-300">mistral-small</td><td className="px-4 py-2.5 text-gray-300">Mistral</td><td className="px-4 py-2.5 text-gray-400">Quick tasks, low cost</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Smart Routing */}
              <section id="smart-routing" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-3">Smart Routing</h2>
                <p className="text-gray-400 mb-4">
                  Use <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">model: &quot;auto&quot;</code> — Inferix classifies your prompt and picks the cheapest adequate model. Zero extra LLM calls.
                </p>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-dark-800 border border-dark-600 rounded-lg p-4 text-center">
                    <p className="text-green-400 font-bold text-lg mb-1">Simple</p>
                    <p className="text-gray-400 text-xs mb-2">&quot;Hi&quot;, &quot;Translate this&quot;</p>
                    <p className="text-white font-mono text-sm">→ gemini-flash</p>
                  </div>
                  <div className="bg-dark-800 border border-dark-600 rounded-lg p-4 text-center">
                    <p className="text-amber-400 font-bold text-lg mb-1">Medium</p>
                    <p className="text-gray-400 text-xs mb-2">Code, moderate analysis</p>
                    <p className="text-white font-mono text-sm">→ gpt-4o-mini</p>
                  </div>
                  <div className="bg-dark-800 border border-dark-600 rounded-lg p-4 text-center">
                    <p className="text-red-400 font-bold text-lg mb-1">Complex</p>
                    <p className="text-gray-400 text-xs mb-2">Multi-step, long code</p>
                    <p className="text-white font-mono text-sm">→ gpt-4o</p>
                  </div>
                </div>

                <CodeBlock language="python" code={`# Smart routing — Inferix picks the best model
response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "What's 2+2?"}]
)
# → Routes to gemini-flash (cheapest) for simple questions`} />
              </section>

              {/* Caching */}
              <section id="caching" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-3">Response Caching</h2>
                <p className="text-gray-400 mb-4">Two layers of caching — both automatic, zero configuration needed:</p>

                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="bg-dark-800 border border-dark-600 rounded-lg p-4">
                    <h4 className="text-white font-semibold mb-1">Exact-Match Cache</h4>
                    <p className="text-gray-400 text-sm">Same model + same messages = instant cached response. 1hr TTL.</p>
                  </div>
                  <div className="bg-dark-800 border border-dark-600 rounded-lg p-4">
                    <h4 className="text-white font-semibold mb-1">Semantic Cache</h4>
                    <p className="text-gray-400 text-sm">Similar meaning (cosine similarity &gt; 0.92) = cached response. Embedding-based.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-dark-800 border border-dark-600 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white">0</p>
                    <p className="text-xs text-gray-500">tokens on hit</p>
                  </div>
                  <div className="bg-dark-800 border border-dark-600 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white">₹0</p>
                    <p className="text-xs text-gray-500">cost on hit</p>
                  </div>
                  <div className="bg-dark-800 border border-dark-600 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white">&lt;5ms</p>
                    <p className="text-xs text-gray-500">latency on hit</p>
                  </div>
                </div>

                <p className="text-gray-400 text-sm">
                  Cache hit header: <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">X-Inferix-Cached: true</code>
                </p>
              </section>

              {/* Context Compression */}
              <section id="context-compression" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-3">Context Compression</h2>
                <p className="text-gray-400 mb-4">
                  Long conversations are automatically trimmed and summarized to reduce token usage by 50-80%.
                </p>

                <div className="bg-dark-800 border border-dark-600 rounded-lg p-5 mb-4">
                  <h4 className="text-white font-semibold mb-3">How it works:</h4>
                  <ol className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2"><span className="text-red-400 font-bold">1.</span> Messages exceed 6,000 token estimate</li>
                    <li className="flex items-start gap-2"><span className="text-red-400 font-bold">2.</span> Old messages trimmed (system prompt + last 4 turns kept)</li>
                    <li className="flex items-start gap-2"><span className="text-red-400 font-bold">3.</span> Dropped messages summarized via Gemini Flash (~100 words)</li>
                    <li className="flex items-start gap-2"><span className="text-red-400 font-bold">4.</span> Summary injected as system context for the LLM</li>
                  </ol>
                </div>

                <p className="text-gray-400 text-sm">
                  Tokens saved header: <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">X-Inferix-Tokens-Saved: 1240</code>
                </p>
              </section>

              {/* Rate Limits */}
              <section id="rate-limits" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-3">Rate Limits</h2>
                <div className="border border-dark-600 rounded-lg overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-dark-800 border-b border-dark-600">
                      <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Plan</th>
                      <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Requests/min</th>
                      <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Tokens/month</th>
                      <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Price</th>
                    </tr></thead>
                    <tbody className="divide-y divide-dark-600">
                      <tr><td className="px-4 py-2.5 text-gray-300">Free</td><td className="px-4 py-2.5 text-gray-300">10</td><td className="px-4 py-2.5 text-gray-300">100K</td><td className="px-4 py-2.5 text-gray-300">₹0</td></tr>
                      <tr><td className="px-4 py-2.5 text-gray-300">Starter</td><td className="px-4 py-2.5 text-gray-300">60</td><td className="px-4 py-2.5 text-gray-300">2M</td><td className="px-4 py-2.5 text-gray-300">₹999/mo</td></tr>
                      <tr><td className="px-4 py-2.5 text-gray-300">Pro</td><td className="px-4 py-2.5 text-gray-300">300</td><td className="px-4 py-2.5 text-gray-300">20M</td><td className="px-4 py-2.5 text-gray-300">₹2,999/mo</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-gray-400 text-sm">
                  Returns <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">429 Too Many Requests</code> with <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">Retry-After</code> header when exceeded.
                </p>
              </section>

              {/* Errors */}
              <section id="errors" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-3">Error Handling</h2>
                <p className="text-gray-400 mb-4">Errors follow OpenAI&apos;s format:</p>
                <CodeBlock language="json" code={`{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}`} />
                <div className="border border-dark-600 rounded-lg overflow-hidden mt-4">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-dark-800 border-b border-dark-600">
                      <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Status</th>
                      <th className="px-4 py-2.5 text-left text-gray-400 font-medium">Meaning</th>
                    </tr></thead>
                    <tbody className="divide-y divide-dark-600">
                      <tr><td className="px-4 py-2.5 font-mono text-gray-300">401</td><td className="px-4 py-2.5 text-gray-400">Invalid or missing API key</td></tr>
                      <tr><td className="px-4 py-2.5 font-mono text-gray-300">404</td><td className="px-4 py-2.5 text-gray-400">Model not found</td></tr>
                      <tr><td className="px-4 py-2.5 font-mono text-gray-300">429</td><td className="px-4 py-2.5 text-gray-400">Rate limit exceeded</td></tr>
                      <tr><td className="px-4 py-2.5 font-mono text-gray-300">503</td><td className="px-4 py-2.5 text-gray-400">Provider unavailable (fallback attempted)</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* CTA */}
              <div className="bg-dark-800 border border-dark-600 rounded-xl p-8 text-center">
                <h2 className="text-xl font-bold text-white mb-2">Ready to start?</h2>
                <p className="text-gray-400 mb-6">Create your API key and make your first request in seconds.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/keys" className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors inline-block">
                    Get API Key
                  </Link>
                  <Link href="/playground" className="bg-dark-600 hover:bg-dark-500 text-gray-300 font-medium px-6 py-2.5 rounded-lg transition-colors inline-block">
                    Try Playground
                  </Link>
                </div>
              </div>

            </main>
          </div>
        </div>
      </div>
    </>
  );
}
