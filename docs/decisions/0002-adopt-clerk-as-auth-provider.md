---
status: proposed
date: 2026-02-17
decision-makers: "Kuba Szwajka"
---

# Adopt Clerk as authentication provider

## Context and Problem Statement

Lucy currently uses a fully custom authentication system: email/password registration with bcrypt hashing, self-managed JWT signing/verification, and manual login/register/verify API routes. This works but carries maintenance burden and security responsibility.

The app is being prepared for sharing with friends and family. This requires:
1. **Easy login** — users expect Google/GitHub social login, not yet-another-password.
2. **Offloaded security** — password storage, token management, rate limiting, and OAuth complexity should be handled by a dedicated auth provider rather than maintained in-house.

Current auth footprint:
- `backend/src/lib/auth/` — JWT utilities (`jwt.ts`), middleware (`middleware.ts`), types
- `backend/src/app/api/auth/` — register, login, verify routes with bcrypt + rate limiting
- `backend/src/lib/db/schema.ts` — `users` table with `passwordHash` column
- `desktop/renderer/src/hooks/useAuth.tsx` — AuthProvider managing tokens in localStorage
- `desktop/renderer/src/app/login/` and `/register/` — custom login/register pages
- `desktop/renderer/src/lib/api/client.ts` — Bearer token injection from manual storage

No existing users need to be migrated — the user base can start fresh on Clerk.

## Decision

Replace the entire custom auth system with **Clerk** (hosted authentication platform).

**Login methods**: Google, GitHub, and email/password — all managed by Clerk.

**Scope**:
- Remove all custom auth code (bcrypt, JWT signing, login/register routes)
- Integrate Clerk SDK on backend (token verification) and frontend (login UI, session management)
- Simplify the `users` table — Clerk provides user IDs; no `passwordHash` needed
- Keep the existing `requireAuth` middleware contract (`userId` + `email`) but back it with Clerk token verification instead of custom JWT

**Non-goals**:
- Offline/local auth for desktop (always connects to cloud backend)
- Custom OAuth implementation
- Migrating existing user accounts
- Multi-tenancy or organization-level access control (may revisit later)

## Consequences

* Good, because auth security (password hashing, token rotation, OAuth flows, MFA) is offloaded to a dedicated provider
* Good, because Google/GitHub login is available out of the box with minimal code
* Good, because Clerk provides pre-built UI components for login/register, reducing frontend work
* Good, because the existing `requireAuth(request) -> { userId, email }` contract stays the same — downstream code doesn't change
* Bad, because introduces vendor dependency on Clerk (hosted SaaS)
* Bad, because Clerk free tier has limits (10,000 MAU) — paid plan needed at scale
* Bad, because Electron/desktop app needs to handle Clerk's browser-based auth flow (likely open system browser for OAuth callback)

## Implementation Plan

* **Dependencies**:
  - Add: `@clerk/nextjs` (backend), `@clerk/clerk-react` (desktop renderer)
  - Remove: `bcryptjs`, `jsonwebtoken` (and their `@types/*`)
  - Keep: `zod` (still used elsewhere)

* **Affected paths**:

  ### Backend
  - `backend/src/lib/auth/middleware.ts` — Replace `verifyToken()` with Clerk's `verifyToken()` or `clerkClient.verifyToken()`. Keep the `requireAuth` / `optionalAuth` function signatures returning `{ user: { userId, email } }`.
  - `backend/src/lib/auth/jwt.ts` — Delete entirely. Clerk handles token issuance.
  - `backend/src/lib/auth/types.ts` — Keep `AuthUser` and `AuthResult` interfaces (contract unchanged).
  - `backend/src/app/api/auth/login/route.ts` — Delete. Clerk handles login.
  - `backend/src/app/api/auth/register/route.ts` — Delete. Clerk handles registration.
  - `backend/src/app/api/auth/verify/route.ts` — Delete or replace with a thin proxy to Clerk's session check.
  - `backend/src/lib/db/schema.ts` — Remove `passwordHash` from `users` table. Add `clerkId` column (text, unique). User records are created on first authenticated request (upsert by Clerk ID).
  - `backend/.env.local` — Add `CLERK_SECRET_KEY`. Remove `JWT_SECRET`.
  - `backend/src/lib/rate-limit.ts` — Keep for non-auth endpoints; remove auth-specific rate limiting (Clerk handles it).

  ### Desktop Frontend
  - `desktop/renderer/src/hooks/useAuth.tsx` — Replace manual JWT/localStorage management with Clerk's `useAuth()` / `useUser()` hooks via `@clerk/clerk-react`.
  - `desktop/renderer/src/app/login/page.tsx` — Replace with Clerk's `<SignIn />` component.
  - `desktop/renderer/src/app/register/page.tsx` — Replace with Clerk's `<SignUp />` component.
  - `desktop/renderer/src/components/auth-guard.tsx` — Simplify using Clerk's `<SignedIn>` / `<SignedOut>` components or `useAuth()`.
  - `desktop/renderer/src/lib/api/client.ts` — Get Bearer token from `clerk.session.getToken()` instead of localStorage.
  - `desktop/renderer/.env.local` — Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

* **Patterns to follow**:
  - Keep the `requireAuth(request) -> AuthResult` middleware contract. All 16+ API routes call `requireAuth` — this abstraction means they don't need to change.
  - User upsert pattern: on first authenticated request, if no `users` row exists for the Clerk ID, create one. This replaces the explicit register route.
  - Singleton service pattern (existing convention) for any Clerk client wrapper.

* **Patterns to avoid**:
  - Do NOT use Clerk's Next.js middleware (`clerkMiddleware()`) on the backend — Lucy's backend is a standalone API server, not a pages-based Next.js app. Verify tokens manually in `requireAuth`.
  - Do NOT store Clerk tokens in localStorage manually — use Clerk's SDK session management.
  - Do NOT keep any bcrypt or JWT signing code "just in case" — clean removal.

### Verification

- [ ] Clerk dashboard shows the application configured with Google and GitHub OAuth providers
- [ ] Email/password signup works via Clerk's `<SignUp />` component
- [ ] Google OAuth login works end-to-end (desktop app -> Clerk -> callback -> session)
- [ ] GitHub OAuth login works end-to-end
- [ ] `requireAuth` middleware correctly extracts `userId` and `email` from Clerk session tokens
- [ ] All existing API routes (sessions, chat, settings, etc.) work with Clerk auth — no changes needed beyond the middleware swap
- [ ] `users` table rows are auto-created on first authenticated request (upsert by Clerk ID)
- [ ] Old auth routes (`/api/auth/login`, `/api/auth/register`) are removed
- [ ] `bcryptjs` and `jsonwebtoken` packages are removed from `backend/package.json`
- [ ] Desktop app handles OAuth redirect flow correctly in Electron context
- [ ] `npm run lint` passes on both desktop and backend

## Alternatives Considered

* **Auth.js (NextAuth)**: Open-source, self-hosted, good Next.js integration. Rejected because it still requires managing session storage, database adapters, and OAuth configuration manually — doesn't meet the "hand it off and don't bother" goal.
* **Custom OAuth with `arctic`**: Maximum control over OAuth flows. Rejected because it increases maintenance burden rather than reducing it — the opposite of what's needed.
* **Supabase Auth**: Good hosted option, but Lucy doesn't use Supabase for anything else, so it would add an unnecessary platform dependency without broader benefit.

## More Information

- Clerk docs: https://clerk.com/docs
- Clerk React SDK: https://clerk.com/docs/references/react/overview
- Clerk token verification (backend): https://clerk.com/docs/references/backend/overview
- Revisit this decision if: Clerk pricing becomes prohibitive, Clerk has reliability issues, or Lucy needs to support self-hosted/on-premise deployments where a hosted auth provider isn't viable.
