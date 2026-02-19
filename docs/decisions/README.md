# Architecture Decision Records (ADR)

An Architecture Decision Record (ADR) captures an important architecture decision along with its context and consequences.

## Conventions

- Directory: `docs/decisions`
- Naming:
  - Prefer numbered files when starting fresh: `0001-choose-database.md`
  - If the repo already uses slug-only names, keep that: `choose-database.md`
- Status values: `proposed`, `accepted`, `rejected`, `deprecated`, `superseded`

## Workflow

- Create a new ADR as `proposed`.
- Discuss and iterate.
- When the team commits: mark it `accepted` (or `rejected`).
- If replaced later: create a new ADR and mark the old one `superseded` with a link.

## ADRs

- [Adopt architecture decision records](0001-adopt-architecture-decision-records.md) (accepted, 2026-02-17)
- [Adopt Clerk as authentication provider](0002-adopt-clerk-as-auth-provider.md) (proposed, 2026-02-17)
- [Add cancel generation to stop in-flight AI responses](0003-add-cancel-generation.md) (proposed, 2026-02-18)
- [Split continuity into memory-read and memory-write tools](0004-split-continuity-into-memory-read-and-memory-write-tools.md) (proposed, 2026-02-18)
- [Replace fixed memory extraction with agent-config-driven reflection](0005-agent-driven-memory-reflection.md) (accepted, 2026-02-18)
- [Add system-initiated triggers (cron jobs and webhooks)](0006-add-system-initiated-triggers.md) (proposed, 2026-02-19)
- [Adopt recursive sessions and unified agent execution](0007-adopt-recursive-sessions-and-unified-agent-execution.md) (accepted, 2026-02-19)
- [Persist incomplete plans across page refreshes](0008-persist-incomplete-plans-across-page-refreshes.md) (proposed, 2026-02-19)
- [Add light mode with three-way theme toggle](0009-add-light-mode-with-three-way-theme-toggle.md) (proposed, 2026-02-19)
- [Replace direct AI providers with OpenRouter](0010-replace-direct-providers-with-openrouter.md) (proposed, 2026-02-19)