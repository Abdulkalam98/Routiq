# Auth Design — Routiq

**Date:** 2026-07-02  
**Scope:** Email + password authentication (JWT), with structure to support Google OAuth later

---

## Goals

- Allow users to sign up and log in with email + password
- Issue a JWT used by dashboard, keys, and billing pages
- Unblock all other protected frontend pages
- No email verification required at signup

---

## Database

Add `password_hash VARCHAR(255)` (nullable) to the existing `customers` table.

- Existing customers (created via `/keys/create`) have `password_hash = NULL`
- New signups set it at creation (bcrypt, 12 rounds)
- Migration: `backend/migrations/versions/002_add_password_hash.py`

---

## Backend

### New file: `backend/routers/auth.py`

**`POST /auth/signup`**
- Body: `{name, email, password}`
- Validates email is not already taken (409 if duplicate)
- Hashes password with bcrypt (12 rounds)
- Creates `Customer` row with `plan = "free"`
- Returns: `{access_token, token_type: "bearer"}`
- JWT payload: `{sub: customer_id, email}`, expires 7 days, signed HS256 with `jwt_secret`

**`POST /auth/login`**
- Body: `{email, password}`
- Looks up customer by email (401 if not found)
- Verifies bcrypt hash (401 if mismatch)
- Returns: same JWT format as signup

### `backend/main.py`
- Include the new auth router (one line)

### No other backend changes
- `get_current_user_jwt` in `keys.py` works unchanged — it already reads the same JWT format

---

## Frontend

### New files

**`frontend/pages/login.js`**
- Form: email, password
- POST to `/api/auth/login`
- On success: store JWT as `routiq_token` in localStorage, redirect to `/dashboard`
- Link to `/signup`

**`frontend/pages/signup.js`**
- Form: name, email, password, confirm password
- Client-side validation: passwords must match
- POST to `/api/auth/signup`
- On success: store JWT as `routiq_token` in localStorage, redirect to `/dashboard`
- Link to `/login`

**`frontend/lib/auth.js`**
- `useAuth()` hook: reads `routiq_token` from localStorage, decodes it, checks expiry
- If missing or expired: redirects to `/login`
- Exports `getToken()` helper for API calls

### Modified files

**`frontend/components/Navbar.js`**
- Add Logout button: clears `routiq_token`, redirects to `/login`

**`frontend/pages/keys.js`**
- Replace hardcoded `dev@routiq.io` email flow with `Authorization: Bearer <token>` header
- Use `getToken()` from `lib/auth.js`
- If `getToken()` returns null, redirect to `/login`

**`frontend/pages/dashboard.js`** and **`frontend/pages/billing.js`**
- Add `useAuth()` at the top to protect the page

---

## Error Handling

| Scenario | HTTP | Message |
|---|---|---|
| Email already exists (signup) | 409 | "Email already registered" |
| Email not found (login) | 401 | "Invalid email or password" |
| Wrong password (login) | 401 | "Invalid email or password" |
| Expired/invalid JWT | 401 | "Invalid or expired token" |

Note: login returns the same error for "not found" and "wrong password" to prevent email enumeration.

---

## Google OAuth (future)

When adding Google OAuth later:
- Add `google_id VARCHAR(255)` column to `customers`
- Add `POST /auth/google` endpoint that exchanges Google token for internal JWT
- Same JWT format — frontend doesn't need to change
- Users who signed up with email+password can link their Google account later

---

## Out of Scope

- Email verification
- Password reset flow
- Session invalidation / token blacklisting
- Rate limiting on auth endpoints (can add later)
