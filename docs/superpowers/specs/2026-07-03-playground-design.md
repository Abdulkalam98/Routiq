# Playground Design — Routiq

**Date:** 2026-07-03  
**Scope:** In-dashboard chat playground — multi-turn, model selector, token/cost display

---

## Goals

- Let authenticated users test any supported model directly in the browser
- Show token count and INR cost after each response
- Multi-turn conversation with a Clear button to reset
- No API key required — uses JWT auth like the rest of the dashboard

---

## Backend

### New file: `backend/routers/playground.py`

**`POST /v1/playground/chat`**
- Auth: JWT via `get_current_user_jwt` dependency (same as keys/billing)
- Body:
  ```json
  {
    "model": "gemini-flash",
    "messages": [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi!"}, ...]
  }
  ```
- Logic:
  1. Call `get_provider(model)` from `services/router.py`
  2. Call `provider.chat_completion(model, messages)` — non-streaming
  3. Extract content, usage tokens from response
  4. Call `calculate_cost(model, prompt_tokens, completion_tokens)` → `cost_inr`
  5. Log usage via `log_usage()` — counts toward token limit
- Returns:
  ```json
  {
    "content": "...",
    "model": "gemini-2.5-flash",
    "usage": {"prompt_tokens": 10, "completion_tokens": 42, "total_tokens": 52},
    "cost_inr": 0.02
  }
  ```
- Errors: 404 if model unknown, 503 if provider fails

### `backend/main.py`
- Add `from routers import ... playground`
- Add `app.include_router(playground.router, prefix="/v1")`

---

## Frontend

### New file: `frontend/pages/playground.js`

**Layout (full page, inside existing `<Layout>`):**

```
┌─────────────────────────────────────┐
│ Playground          [Model ▼] [Clear]│
├─────────────────────────────────────┤
│                                     │
│  [User message]              ████   │
│                                     │
│  ████ [Assistant message]           │
│       142 tokens · ₹0.02            │
│                                     │
│  [User message]              ████   │
│                                     │
│  ████ [typing...]                   │
│                                     │
├─────────────────────────────────────┤
│ [Textarea                    ] [Send]│
└─────────────────────────────────────┘
```

**Model selector dropdown:**
- Options: `gemini-flash`, `gpt-4o`, `gpt-4o-mini`, `claude-sonnet-4-6`, `claude-haiku`, `mistral-large`, `mistral-small`
- Default: `gemini-flash`

**Message list:**
- User messages: right-aligned, indigo background
- Assistant messages: left-aligned, gray background
- Each assistant message has a subtitle line: `{total_tokens} tokens · ₹{cost_inr}`
- Loading state: left-aligned gray bubble with animated "..." dots
- Auto-scrolls to bottom on new message

**Input area:**
- Textarea: Enter = send, Shift+Enter = newline
- Send button disabled while loading
- Clears after send

**Clear button:**
- Resets `messages` state to `[]`

**Auth:** `useAuth()` as first call in component — redirects to `/login` if not authenticated.

**API call:** `POST /api/v1/playground/chat` with `Authorization: Bearer <token>` header.

### Modified file: `frontend/components/Layout.js`

Add to the `navigation` array:
```js
{ name: 'Playground', href: '/playground', icon: ChatBubbleLeftRightIcon }
```
Import `ChatBubbleLeftRightIcon` from `@heroicons/react/24/outline`.

---

## Data Flow

```
User types message → hits Enter
→ message appended to local messages state (role: "user")
→ loading = true, typing indicator shown
→ POST /api/v1/playground/chat {model, messages}
    → backend: get_provider(model) → chat_completion(model, messages)
    → backend: calculate_cost → log_usage (async)
    → returns {content, model, usage, cost_inr}
→ assistant message appended to messages state with token/cost metadata
→ loading = false
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Provider error (503) | Show error bubble in chat: "Something went wrong. Please try again." |
| Model not found (404) | Show error bubble: "Model not available." |
| Network error | Show error bubble: "Network error. Please try again." |
| Empty input | Send button disabled, Enter does nothing |

---

## Out of Scope

- Streaming responses (non-streaming only for simplicity)
- Saving/exporting conversation history
- System prompt configuration
- Temperature / max_tokens controls
- Usage counting against plan limits enforcement (playground requests DO count toward monthly token limits, same as API calls — no special treatment)
