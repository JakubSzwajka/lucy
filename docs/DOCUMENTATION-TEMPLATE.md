# Documentation Template

## The Lego Rule

Each module README documents only its own contract. It never explains the internals of modules it depends on or that depend on it. Orchestration-layer docs link to child READMEs rather than duplicating their content. This keeps documentation local, composable, and maintainable.

## Template

Use this structure for every module README. Remove sections that do not apply.

```markdown
# <Module Name>

<One-line description of what this module does.>

## Purpose

<Why this module exists. What problem it solves. 2-3 sentences max.>

## Public API

- `functionOrClass()` - brief description
- `anotherExport()` - brief description

## Usage

<How callers should use this module. A sentence or short code snippet.>

## Responsibility Boundary

<What this module owns vs. what it delegates to others. 1-2 sentences.>

## Read Next

- [Child Module](./child/README.md)
- [Related Module](../related/README.md)
```

## Do's

- Keep the README under 30 lines when possible.
- Start with a single sentence that completes "This module...".
- Document the public contract, not internal implementation.
- Link to child/related READMEs instead of explaining them.
- Update the README when the public API changes.

## Don'ts

- Don't document private functions or internal data structures.
- Don't duplicate information that belongs in a child README.
- Don't add usage tutorials or walkthroughs -- keep it reference-level.
- Don't describe how callers work; only describe how they should call you.
