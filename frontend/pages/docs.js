import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

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
        <span className="text-xs text-green-400">✓</span>
      ) : (
        <ClipboardDocumentIcon className="w-4 h-4" />
      )}
    </button>
  );
}

function CodeBlock({ code, language = 'python' }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-dark-600 bg-dark-800 my-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-600">
        <span className="text-xs text-gray-500 font-mono">{language}</span>
      </div>
      <CopyButton text={code} />
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-gray-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}

const sections = [
  {
    id: 'quickstart',
    title: 'Quick Start',
    content: `Get started with Routiq in under 30 seconds. No SDK changes needed — just swap your base URL and API key.`,
  },
  {
    id: 'authentication',
    title: 'Authentication',
    content: `All API requests require a valid API key passed via the Authorization header.`,
  },
  {
    id: 'chat-completions',
    title: 'Chat Completions',
    content: `Send messages to any supported model through a single OpenAI-compatible endpoint.`,
  },
  {
    id: 'models',
    title: 'Supported Models',
    content: `Routiq supports models from 4 providers. Use the model name in your requests.`,
  },
  {
    id: 'smart-routing',
    title: 'Smart Routing',
    content: `Set model to "auto" and Routiq will analyze your prompt complexity and pick the cheapest adequate model — zero extra LLM calls.`,
  },
  {
    id: 'caching',
    title: 'Response Caching',
    content: `Identical requests are cached for 1 hour. Cache hits return instantly with zero token cost.`,
  },
  {
    id: 'rate-limits',
    title: 'Rate Limits',
    content: `Rate limits depend on your plan. Exceeding limits returns a 429 status.`,
  },
];

export default function Docs() {
  return (
    <>
      <Head>
        <title>Documentation - Routiq</title>
        <meta name="description" content="Routiq API documentation. OpenAI-compatible endpoint for multiple LLM providers." />
      </Head>

      <div className="min-h-screen bg-dark-900">
        <Navbar />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Documentation</h1>
            <p className="mt-3 text-lg text-gray-400">
              Everything you need to integrate Routiq into your application.
            </p>
          </div>

          {/* Table of Contents */}
          <div className="dashboard-card p-5 mb-10">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">On this page</h2>
            <nav className="space-y-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-gray-300 hover:text-red-400 transition-colors py-1"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </div>

          {/* Quick Start */}
          <section id="quickstart" className="mb-14">
            <h2 className="text-2xl font-bold text-white mb-3">Quick Start</h2>
            <p className="text-gray-400 mb-4">
              Get started with Routiq in under 30 seconds. No SDK changes needed — just swap your base URL and API key.
            </p>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">1. Get your API key</h3>
            <p className="text-gray-400 mb-2">
              Create a key from the <Link href="/keys" className="text-red-400 hover:text-red-300">API Keys page</Link> or via the API:
            </p>
            <CodeBlock language="bash" code={`curl -X POST https://routiq-api.onrender.com/v1/keys/create \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My App", "email": "you@example.com"}'`} />

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">2. Make your first request</h3>
            <CodeBlock language="python" code={`from openai import OpenAI

client = OpenAI(
    api_key="rq_your_key_here",
    base_url="https://routiq-api.onrender.com/v1"
)

response = client.chat.completions.create(
    model="gemini-flash",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`} />

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">3. That's it!</h3>
            <p className="text-gray-400">
              Your existing OpenAI SDK code works with zero other changes. Switch models by changing the <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">model</code> parameter.
            </p>
          </section>

          {/* Authentication */}
          <section id="authentication" className="mb-14">
            <h2 className="text-2xl font-bold text-white mb-3">Authentication</h2>
            <p className="text-gray-400 mb-4">
              All API requests require a valid API key. Pass it via the <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">Authorization</code> header:
            </p>
            <CodeBlock language="bash" code={`Authorization: Bearer rq_your_key_here`} />
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
              <p className="text-sm text-amber-300">
                <strong>Important:</strong> API keys start with <code className="text-amber-200">rq_</code>. Keep your key secret — never expose it in client-side code.
              </p>
            </div>
          </section>

          {/* Chat Completions */}
          <section id="chat-completions" className="mb-14">
            <h2 className="text-2xl font-bold text-white mb-3">Chat Completions</h2>
            <p className="text-gray-400 mb-4">
              OpenAI-compatible endpoint. Supports streaming, temperature, max_tokens, and all standard parameters.
            </p>

            <div className="dashboard-card p-4 mb-4">
              <code className="text-sm font-mono">
                <span className="text-green-400">POST</span>{' '}
                <span className="text-gray-300">/v1/chat/completions</span>
              </code>
            </div>

            <CodeBlock language="bash" code={`curl -X POST https://routiq-api.onrender.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer rq_your_key" \\
  -d '{
    "model": "gemini-flash",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is Routiq?"}
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
    "message": {
      "role": "assistant",
      "content": "Routiq is an AI API gateway..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 42,
    "total_tokens": 67
  }
}`} />

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">Streaming</h3>
            <p className="text-gray-400 mb-2">Add <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">"stream": true</code> to get Server-Sent Events:</p>
            <CodeBlock language="python" code={`stream = client.chat.completions.create(
    model="gemini-flash",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`} />
          </section>

          {/* Supported Models */}
          <section id="models" className="mb-14">
            <h2 className="text-2xl font-bold text-white mb-3">Supported Models</h2>
            <p className="text-gray-400 mb-4">Use these model names in your requests:</p>

            <div className="dashboard-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600">
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Model</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Provider</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Best For</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600">
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-red-400">auto</td>
                    <td className="px-4 py-3 text-gray-300">Routiq</td>
                    <td className="px-4 py-3 text-gray-400">Smart routing — picks cheapest model</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-gray-300">gemini-flash</td>
                    <td className="px-4 py-3 text-gray-300">Google</td>
                    <td className="px-4 py-3 text-gray-400">Fast, cheap, general tasks</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-gray-300">gemini-1.5-pro</td>
                    <td className="px-4 py-3 text-gray-300">Google</td>
                    <td className="px-4 py-3 text-gray-400">Long context, complex reasoning</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-gray-300">gpt-4o</td>
                    <td className="px-4 py-3 text-gray-300">OpenAI</td>
                    <td className="px-4 py-3 text-gray-400">Best overall quality</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-gray-300">gpt-4o-mini</td>
                    <td className="px-4 py-3 text-gray-300">OpenAI</td>
                    <td className="px-4 py-3 text-gray-400">Balanced speed & quality</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-gray-300">claude-sonnet-4-6</td>
                    <td className="px-4 py-3 text-gray-300">Anthropic</td>
                    <td className="px-4 py-3 text-gray-400">Code, analysis, long text</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-gray-300">claude-haiku</td>
                    <td className="px-4 py-3 text-gray-300">Anthropic</td>
                    <td className="px-4 py-3 text-gray-400">Fast, concise responses</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-gray-300">mistral-large</td>
                    <td className="px-4 py-3 text-gray-300">Mistral</td>
                    <td className="px-4 py-3 text-gray-400">Multilingual, reasoning</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 font-mono text-gray-300">mistral-small</td>
                    <td className="px-4 py-3 text-gray-300">Mistral</td>
                    <td className="px-4 py-3 text-gray-400">Quick tasks, low cost</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Smart Routing */}
          <section id="smart-routing" className="mb-14">
            <h2 className="text-2xl font-bold text-white mb-3">Smart Routing</h2>
            <p className="text-gray-400 mb-4">
              Set <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">model: "auto"</code> and Routiq analyzes your prompt to pick the cheapest adequate model. Zero extra LLM calls — it's a rule-based classifier.
            </p>

            <div className="dashboard-card overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600">
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Complexity</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Routes To</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Examples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600">
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 text-green-400 font-medium">Simple</td>
                    <td className="px-4 py-3 font-mono text-gray-300">gemini-flash</td>
                    <td className="px-4 py-3 text-gray-400">"Hi", "Translate this", short factual</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 text-amber-400 font-medium">Medium</td>
                    <td className="px-4 py-3 font-mono text-gray-300">gpt-4o-mini</td>
                    <td className="px-4 py-3 text-gray-400">Code generation, moderate analysis</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 text-red-400 font-medium">Complex</td>
                    <td className="px-4 py-3 font-mono text-gray-300">gpt-4o</td>
                    <td className="px-4 py-3 text-gray-400">Multi-step reasoning, long code, multi-question</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <CodeBlock language="python" code={`# Smart routing example
response = client.chat.completions.create(
    model="auto",  # Routiq picks the best model
    messages=[{"role": "user", "content": "What's 2+2?"}]
)
# Routes to gemini-flash (cheapest) for simple questions`} />
          </section>

          {/* Caching */}
          <section id="caching" className="mb-14">
            <h2 className="text-2xl font-bold text-white mb-3">Response Caching</h2>
            <p className="text-gray-400 mb-4">
              Identical requests (same model + messages) are cached for 1 hour. Cache hits are free — zero tokens charged.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              <div className="dashboard-card p-4 text-center">
                <p className="text-2xl font-bold text-white">1 hr</p>
                <p className="text-xs text-gray-500">Cache TTL</p>
              </div>
              <div className="dashboard-card p-4 text-center">
                <p className="text-2xl font-bold text-white">0 tokens</p>
                <p className="text-xs text-gray-500">On cache hit</p>
              </div>
              <div className="dashboard-card p-4 text-center">
                <p className="text-2xl font-bold text-white">₹0.00</p>
                <p className="text-xs text-gray-500">Cost on hit</p>
              </div>
            </div>

            <p className="text-gray-400 mb-2">
              Cache hits include the header <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">X-Routiq-Cached: true</code>.
            </p>
            <p className="text-gray-400">
              Caching is automatic for non-streaming requests. No configuration needed.
            </p>
          </section>

          {/* Rate Limits */}
          <section id="rate-limits" className="mb-14">
            <h2 className="text-2xl font-bold text-white mb-3">Rate Limits</h2>
            <p className="text-gray-400 mb-4">Rate limits depend on your plan:</p>

            <div className="dashboard-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600">
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Plan</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Requests/min</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">Tokens/month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600">
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 text-gray-300">Free</td>
                    <td className="px-4 py-3 text-gray-300">10</td>
                    <td className="px-4 py-3 text-gray-300">100K</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 text-gray-300">Starter</td>
                    <td className="px-4 py-3 text-gray-300">60</td>
                    <td className="px-4 py-3 text-gray-300">2M</td>
                  </tr>
                  <tr className="hover:bg-dark-700/50">
                    <td className="px-4 py-3 text-gray-300">Pro</td>
                    <td className="px-4 py-3 text-gray-300">300</td>
                    <td className="px-4 py-3 text-gray-300">20M</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-gray-400 mt-4 text-sm">
              When rate limited, the API returns <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">429 Too Many Requests</code> with a <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">Retry-After</code> header.
            </p>
          </section>

          {/* CTA */}
          <div className="dashboard-card p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2">Ready to start?</h2>
            <p className="text-gray-400 mb-6">Create your API key and make your first request in seconds.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/keys"
                className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors inline-block"
              >
                Get API Key
              </Link>
              <Link
                href="/playground"
                className="bg-dark-600 hover:bg-dark-500 text-gray-300 font-medium px-6 py-2.5 rounded-lg transition-colors inline-block"
              >
                Try in Playground
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-8 border-t border-dark-600 mt-12">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} Routiq. Built for Indian developers.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
