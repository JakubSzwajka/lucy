---
status: proposed
date: 2026-02-19
decision-makers: "Kuba Szwajka"
---

# Add user-level privacy mode with message encryption at rest

## Context and Problem Statement

Lucy stores all conversation messages (the `items` table) in plaintext in the database. Langfuse tracing also captures message content with userId attribution. As more users join, some will want a guarantee that **nobody — including the app operator — can read their stored messages**.

The challenge: messages must be plaintext at runtime because the LLM provider needs them. But once a response is complete, stored data should be unreadable without the user's key.

How do we offer a "we can't read your messages" privacy mode while keeping the system functional?

## Decision Drivers

* Users should be able to opt in to a mode where their stored messages are unreadable by the operator
* Messages must be plaintext at runtime (LLM providers require it)
* Server-side features (auto-reflection, memory extraction) run at request-time and need plaintext during execution — but historical data at rest should be encrypted
* Langfuse tracing should be fully disabled for privacy-mode users (no message content leaves the server to third-party observability)
* Key management must work with Clerk auth (ADR-0002) — we don't control user passwords
* The solution should be incrementally adoptable — existing users aren't forced into it

## Considered Options

* **Option A: Envelope encryption at rest (server-managed keys)**
* **Option B: Client-side encryption with user-held passphrase**
* **Option C: Tracing opt-out only (no DB encryption)**

## Decision Outcome

Chosen option: **"Option A: Envelope encryption at rest"**, because it provides real encryption of stored data without breaking server-side features at runtime, and doesn't require the user to manage a separate passphrase. It's the best balance of privacy guarantee vs. implementation complexity.

### Consequences

* Good, because message content in the DB is encrypted — a database dump or direct SQL access reveals nothing
* Good, because Langfuse tracing is disabled for privacy-mode users — no message content sent to third-party services
* Good, because server-side features (memory, auto-reflection) still work at runtime since they decrypt on-the-fly during the request
* Good, because incrementally adoptable — existing users unaffected, new users can opt in
* Bad, because the server still has access to the DEK at runtime — this is NOT end-to-end encryption; a compromised running server could read messages
* Bad, because adds complexity to the read/write path for items (encrypt on write, decrypt on read)
* Bad, because full-text search over encrypted messages is not possible without additional infrastructure (e.g., encrypted search index)
* Neutral, because the privacy guarantee is "at rest" — we can honestly say "we can't read your messages in the database" but not "we never see them" (the LLM provider and runtime do)

## Implementation Plan

### Architecture

**Envelope encryption** with two layers of keys:

1. **User KEK (Key Encryption Key)**: One per user, generated on privacy-mode opt-in. Stored in the `users` table, encrypted with a server-level master key (`MASTER_ENCRYPTION_KEY` env var). This means: without the master key, user KEKs are unreadable. Without the user KEK, message DEKs are unreadable.

2. **Session DEK (Data Encryption Key)**: One per session, generated on session creation. Stored in the `sessions` table, encrypted (wrapped) with the user's KEK. Used to encrypt/decrypt all `items.content` within that session.

**Encryption algorithm**: AES-256-GCM (authenticated encryption, built into Node.js `crypto`).

**Flow — writing a message**:
1. ChatService processes the message normally (plaintext at runtime)
2. Before persisting to `items`, check if user has `privacyMode: true`
3. If yes: load session DEK → decrypt DEK with user KEK → encrypt `items.content` with DEK → store ciphertext + IV + authTag
4. If no: store plaintext as today

**Flow — reading messages**:
1. Load items from DB
2. If user has `privacyMode: true`: decrypt each item's content using session DEK (unwrapped with user KEK)
3. Return plaintext to the runtime/client

**Flow — Langfuse**:
1. In `ChatService.runAgent()`, before calling `startActiveObservation`, check user's privacy setting
2. If privacy mode: skip all Langfuse tracing calls (no `startActiveObservation`, `updateActiveTrace`, `propagateAttributes`)
3. This is a simple conditional wrapping — no tracing data leaves the server

### Affected paths

- `backend/src/lib/server/db/schema.ts` — Add `privacyMode` boolean to `settings` table. Add `encryptedKek` column to `users` table. Add `encryptedDek` + `dekIv` columns to `sessions` table. Add `contentIv` + `contentTag` columns to `items` table (or store as a single encrypted blob).
- `backend/src/lib/crypto/` — **New module**. Envelope encryption utilities: `generateDek()`, `wrapKey()`, `unwrapKey()`, `encryptContent()`, `decryptContent()`. Uses Node.js `crypto` (no external deps).
- `backend/src/lib/server/services/item/item.repository.ts` — Encrypt on write, decrypt on read. Add encryption/decryption layer around content persistence.
- `backend/src/lib/server/services/chat/chat.service.ts` — Conditional Langfuse tracing: wrap `startActiveObservation` calls with privacy check. Pass encryption context to item persistence.
- `backend/src/lib/server/memory/auto-reflection.service.ts` — Conditional Langfuse tracing (same pattern as ChatService).
- `backend/src/instrumentation.ts` — No change needed (span processor stays; privacy-mode users simply won't generate spans).
- `backend/src/app/api/settings/route.ts` — Expose `privacyMode` toggle in settings API.
- `desktop/renderer/src/` — Settings UI: add privacy mode toggle with clear explanation of what it does and doesn't guarantee.

### Dependencies

- No new packages. Node.js `crypto` module provides AES-256-GCM natively.
- **New env var**: `MASTER_ENCRYPTION_KEY` — 256-bit key for wrapping user KEKs. Generated once, stored securely. If lost, all encrypted data is unrecoverable.

### Patterns to follow

- Singleton service pattern for the crypto module (`CryptoService.getInstance()`)
- Repository pattern: encryption/decryption happens in the repository layer, transparent to services above
- Settings check pattern: load user settings once per request, pass `privacyMode` flag through the call chain

### Patterns to avoid

- Do NOT encrypt at the API route level — encryption is a persistence concern, not a transport concern
- Do NOT store DEKs in plaintext — always wrapped with KEK
- Do NOT use `crypto.createCipher` (deprecated) — use `crypto.createCipheriv` with AES-256-GCM
- Do NOT make privacy mode the default — it's opt-in to avoid breaking existing workflows
- Do NOT attempt to encrypt tool_call/tool_result metadata that the system needs to parse (e.g., tool names, status) — only encrypt the content/text payload

### Migration steps

1. Add new columns with `ALTER TABLE` (all nullable, no data migration needed)
2. Existing items remain plaintext — privacy mode only applies to new messages after opt-in
3. Optional future: offer "encrypt my history" action that retroactively encrypts existing items for a user

### Verification

- [ ] `CryptoService` can generate a DEK, wrap it with a KEK, unwrap it, and the round-trip matches
- [ ] A message stored with privacy mode ON is unreadable ciphertext in the `items` table when queried directly via SQL
- [ ] A message stored with privacy mode OFF is plaintext (no regression)
- [ ] Chat works end-to-end with privacy mode ON — messages encrypt on write, decrypt on read, LLM receives plaintext
- [ ] Langfuse dashboard shows NO traces for privacy-mode users after a chat session
- [ ] Langfuse dashboard still shows traces for non-privacy-mode users (no regression)
- [ ] Auto-reflection still runs for privacy-mode users (decrypts at runtime, but doesn't send to Langfuse)
- [ ] `MASTER_ENCRYPTION_KEY` env var missing causes a clear startup error, not silent failure
- [ ] Settings API accepts and returns `privacyMode` boolean
- [ ] `npm run lint` passes

## Pros and Cons of the Options

### Option A: Envelope encryption at rest (server-managed keys)

Server generates and manages all keys. User KEK wrapped with master key, session DEK wrapped with user KEK. Encryption/decryption is transparent — happens in the repository layer.

* Good, because no UX burden on users (no passphrase to remember)
* Good, because server-side features (memory, reflection) work normally at runtime
* Good, because standard envelope encryption pattern — well-understood, auditable
* Good, because incremental — only encrypts new data for opted-in users
* Bad, because server has runtime access to keys — not true E2E encryption
* Bad, because `MASTER_ENCRYPTION_KEY` is a single point of failure — lose it, lose all encrypted data
* Bad, because adds latency to every read/write for privacy-mode users (AES-256-GCM is fast, but it's extra work)

### Option B: Client-side encryption with user-held passphrase

User provides a passphrase on login. Client derives a key, encrypts messages before sending to backend. Server never sees plaintext (except it does — because it needs to forward to LLM).

* Good, because strongest privacy guarantee in theory
* Bad, because **fundamentally broken for this use case** — the server must see plaintext to call the LLM, so the encryption would have to happen *after* the LLM response, at which point the server already had plaintext
* Bad, because user must remember a separate passphrase (UX friction)
* Bad, because server-side features (memory, reflection) can't work without the user's key present
* Bad, because passphrase loss = data loss with no recovery

### Option C: Tracing opt-out only (no DB encryption)

Add a `disableTracing` setting. Skip Langfuse calls for opted-in users. Don't encrypt anything in the DB.

* Good, because trivial to implement (conditional around tracing calls)
* Good, because no performance impact on read/write path
* Bad, because **doesn't deliver the core promise** — messages are still plaintext in the DB, operator can read them
* Bad, because "we disabled tracing" is a weak privacy claim compared to "we encrypted your data"

## More Information

- This ADR interacts with ADR-0002 (Clerk auth): user KEK generation happens after Clerk authentication, not tied to a password
- This ADR interacts with ADR-0005 (agent-driven memory reflection): reflection still works because it runs at request-time with decrypted data, but reflection *output* (memories) should also be encrypted for privacy-mode users — this is a follow-up concern
- Node.js `crypto` AES-256-GCM docs: https://nodejs.org/api/crypto.html
- Envelope encryption pattern: https://cloud.google.com/kms/docs/envelope-encryption
- **Key rotation**: not addressed in v1. Future work: re-wrap DEKs with a new KEK without re-encrypting all items (envelope encryption makes this efficient)
- **Revisit if**: users request true E2E encryption where even runtime can't see messages (would require a fundamentally different architecture, e.g., client-side LLM calls)
- **Open question**: should the privacy mode setting itself be irreversible (once on, always on for that data)? Turning it off doesn't decrypt existing data, but new messages would be plaintext — could be confusing
