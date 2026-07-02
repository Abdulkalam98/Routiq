# Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-dashboard chat playground page where users can test any model with multi-turn conversation and see token/cost info.

**Architecture:** One new backend router (`playground.py`) with a JWT-authenticated endpoint that reuses the existing provider/cost/usage pipeline. One new frontend page (`playground.js`) with chat UI + model selector. One small edit to `Layout.js` to add the nav link.

**Tech Stack:** FastAPI, Next.js 14, Tailwind CSS, Heroicons

## Global Constraints

- All backend imports use flat paths: `from config import ...` (never `from backend.config`)
- Frontend `API_BASE = ''` (Vercel rewrites `/api/*` to Render)
- localStorage key: `routiq_token`
- JWT auth via `get_current_user_jwt` from `routers/keys.py` (reuse existing dependency)
- Non-streaming responses only
- Available models: `gemini-flash`, `gpt-4o`, `gpt-4o-mini`, `claude-sonnet-4-6`, `claude-haiku`, `mistral-large`, `mistral-small`
- Python 3.12.3

---

## File Map

**Create:**
- `backend/routers/playground.py` — playground chat endpoint
- `frontend/pages/playground.js` — playground chat UI

**Modify:**
- `backend/main.py` — register playground router
- `frontend/components/Layout.js` — add Playground nav link

---

### Task 1: Backend playground endpoint

**Files:**
- Create: `backend/routers/playground.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `get_current_user_jwt` from `routers/keys.py`, `get_provider` from `services/router.py`, `calculate_cost` from `services/cost.py`, `log_usage` from `services/usage.py`, `get_db` from `database.py`
- Produces: `POST /v1/playground/chat` — body `{model: str, messages: list[{role: str, content: str}]}` → `{content: str, model: str, usage: {prompt_tokens: int, completion_tokens: int, total_tokens: int}, cost_inr: float}`

- [ ] **Step 1: Create `backend/routers/playground.py`**

```python
"""
Playground chat router - POST /playground/chat
JWT-authenticated chat endpoint for in-dashboard testing.
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from routers.keys import get_current_user_jwt
from services.router import get_provider
from services.cost import calculate_cost
from services.usage import log_usage

router = APIRouter(prefix="/playground", tags=["Playground"])


class MessageItem(BaseModel):
    role: str
    content: str


class PlaygroundChatRequest(BaseModel):
    model: str
    messages: list[MessageItem]


class UsageInfo(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class PlaygroundChatResponse(BaseModel):
    content: str
    model: str
    usage: UsageInfo
    cost_inr: float


@router.post("/chat", response_model=PlaygroundChatResponse)
async def playground_chat(
    body: PlaygroundChatRequest,
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """
    Chat endpoint for the playground. Uses JWT auth (not API key).
    Sends messages to the selected model and returns response with cost info.
    """
    # Resolve provider
    try:
        provider, resolved_model = get_provider(body.model)
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "message": str(e),
                    "type": "invalid_request_error",
                    "code": "model_not_found",
                }
            },
        )

    # Convert messages to list of dicts for the provider
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    # Call provider
    try:
        result = await provider.chat_completion(
            model=resolved_model,
            messages=messages,
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "message": "Provider temporarily unavailable. Please try again.",
                    "type": "server_error",
                    "code": "provider_error",
                }
            },
        )

    # Extract response data
    choices = result.get("choices", [])
    choice = choices[0] if choices else {}
    content = choice.get("message", {}).get("content", "")
    usage_data = result.get("usage", {})
    prompt_tokens = usage_data.get("prompt_tokens", 0)
    completion_tokens = usage_data.get("completion_tokens", 0)
    total_tokens = usage_data.get("total_tokens", prompt_tokens + completion_tokens)

    # Calculate cost
    try:
        cost_usd, cost_inr = calculate_cost(body.model, prompt_tokens, completion_tokens)
    except ValueError:
        cost_usd, cost_inr = 0.0, 0.0

    # Log usage asynchronously
    asyncio.create_task(
        log_usage(
            customer_id=user["customer_id"],
            model=body.model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost_usd,
            cost_inr=cost_inr,
        )
    )

    return PlaygroundChatResponse(
        content=content,
        model=result.get("model", body.model),
        usage=UsageInfo(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        ),
        cost_inr=round(cost_inr, 4),
    )
```

- [ ] **Step 2: Register the router in `backend/main.py`**

Add `playground` to the import line:

```python
from routers import chat, models, keys, billing, auth, playground
```

Add this after the existing `app.include_router` calls:

```python
app.include_router(playground.router, prefix="/v1")
```

- [ ] **Step 3: Test the endpoint with curl**

Start the backend:
```bash
cd backend && uvicorn main:app --reload --port 8000
```

First get a JWT (use existing signup/login):
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@routiq.io", "password": "test1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

Test the playground endpoint:
```bash
curl -s -X POST http://localhost:8000/v1/playground/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"model": "gemini-flash", "messages": [{"role": "user", "content": "Say hello in one word"}]}' | python3 -m json.tool
```

Expected response shape:
```json
{
    "content": "Hello!",
    "model": "gemini-2.5-flash",
    "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7},
    "cost_inr": 0.0001
}
```

Test invalid model returns 404:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/v1/playground/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"model": "invalid-model", "messages": [{"role": "user", "content": "hi"}]}'
```

Expected: `404`

- [ ] **Step 4: Commit**

```bash
git add backend/routers/playground.py backend/main.py
git commit -m "feat: add /v1/playground/chat endpoint (JWT-authenticated)"
```

---

### Task 2: Frontend playground page

**Files:**
- Create: `frontend/pages/playground.js`

**Interfaces:**
- Consumes: `useAuth()`, `getToken()` from `frontend/lib/auth.js`; endpoint `POST /api/v1/playground/chat`
- Produces: `/playground` route — full chat UI with model selector, message list, cost display

- [ ] **Step 1: Create `frontend/pages/playground.js`**

```jsx
import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { useAuth, getToken } from '../lib/auth';
import { PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';

const API_BASE = '';

const MODELS = [
  { id: 'gemini-flash', name: 'Gemini Flash', provider: 'Google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet', provider: 'Anthropic' },
  { id: 'claude-haiku', name: 'Claude Haiku', provider: 'Anthropic' },
  { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral' },
  { id: 'mistral-small', name: 'Mistral Small', provider: 'Mistral' },
];

export default function Playground() {
  useAuth();

  const [model, setModel] = useState('gemini-flash');
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

    try {
      const res = await fetch(`${API_BASE}/api/v1/playground/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model,
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
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
        <title>Playground - Routiq</title>
      </Head>

      <div className="flex flex-col h-[calc(100vh-10rem)]">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Playground</h1>
          <div className="flex items-center gap-3">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl bg-white p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
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
                    ? 'bg-primary-500 text-white'
                    : msg.role === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && msg.tokens != null && (
                  <p className="mt-1 text-xs text-gray-500">
                    {msg.tokens} tokens · ₹{msg.cost_inr.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Verify the file parses without errors**

```bash
cd frontend && node --check pages/playground.js 2>&1 || echo "syntax error"
```

Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/playground.js
git commit -m "feat: add playground chat page with model selector and cost display"
```

---

### Task 3: Add Playground to sidebar navigation

**Files:**
- Modify: `frontend/components/Layout.js`

**Interfaces:**
- Consumes: Heroicons `ChatBubbleLeftRightIcon`
- Produces: "Playground" link in sidebar navigation, route `/playground`

- [ ] **Step 1: Add the icon import**

In `frontend/components/Layout.js`, find the existing heroicons import:

```js
import {
  ChartBarIcon,
  KeyIcon,
  CreditCardIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
```

Add `ChatBubbleLeftRightIcon` to it:

```js
import {
  ChartBarIcon,
  KeyIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
```

- [ ] **Step 2: Add the nav item**

Find the `navigation` array:

```js
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon },
  { name: 'API Keys', href: '/keys', icon: KeyIcon },
  { name: 'Billing', href: '/billing', icon: CreditCardIcon },
];
```

Add the Playground item after API Keys:

```js
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon },
  { name: 'Playground', href: '/playground', icon: ChatBubbleLeftRightIcon },
  { name: 'API Keys', href: '/keys', icon: KeyIcon },
  { name: 'Billing', href: '/billing', icon: CreditCardIcon },
];
```

- [ ] **Step 3: Verify in browser**

With `npm run dev` running, visit `http://localhost:3000/playground`. The sidebar should show "Playground" with a chat bubble icon. Clicking it navigates to the playground page.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Layout.js
git commit -m "feat: add Playground link to sidebar navigation"
```

---

## Self-Review

**Spec coverage:**
- ✅ JWT-authenticated endpoint (`get_current_user_jwt`) — Task 1
- ✅ Reuses `get_provider`, `calculate_cost`, `log_usage` — Task 1
- ✅ Returns `{content, model, usage, cost_inr}` — Task 1
- ✅ 404 on invalid model, 503 on provider failure — Task 1
- ✅ Registered in `main.py` at `/v1` — Task 1
- ✅ Model selector dropdown with all 7 models — Task 2
- ✅ Multi-turn conversation with Clear button — Task 2
- ✅ User messages right-aligned (indigo), assistant left-aligned (gray) — Task 2
- ✅ Token count + INR cost shown below assistant messages — Task 2
- ✅ Loading indicator (animated dots) — Task 2
- ✅ Enter to send, Shift+Enter for newline — Task 2
- ✅ Error shown as red bubble in chat — Task 2
- ✅ Auto-scroll to bottom on new message — Task 2
- ✅ `useAuth()` guard — Task 2
- ✅ Playground nav link with `ChatBubbleLeftRightIcon` — Task 3
- ✅ Empty input → send disabled — Task 2

**Placeholder scan:** None found.

**Type consistency:**
- `PlaygroundChatResponse.usage` has `{prompt_tokens, completion_tokens, total_tokens}` — frontend reads `data.usage.total_tokens` ✅
- `PlaygroundChatResponse.cost_inr` is `float` — frontend calls `.toFixed(4)` ✅
- `PlaygroundChatRequest.messages` is `list[MessageItem]` — frontend maps to `{role, content}` ✅
- `getToken()` returns `string | null` — checked with `if (!token) return` ✅
