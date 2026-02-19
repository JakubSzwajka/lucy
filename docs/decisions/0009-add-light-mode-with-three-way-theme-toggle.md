---
status: proposed
date: 2026-02-19
decision-makers: kuba
---

# Add light mode with three-way theme toggle

## Context and Problem Statement

The app is currently dark-mode only. The `<html>` element has `class="dark"` hardcoded in `desktop/renderer/src/app/layout.tsx`, and all color values in `globals.css` are defined once in `:root` with dark aesthetics (backgrounds at 4-7% lightness, foregrounds at 85-96%). There is no light variant.

Users need a light mode option. The implementation must support three modes: **dark**, **light**, and **system** (follows OS preference). System should be the default.

### Current state

- **CSS variables**: All colors defined in `:root` as HSL values — no `.dark` override block exists.
- **Tailwind dark variant**: `@custom-variant dark (&:is(.dark *))` is configured but only used in ~60 places across 17 component files (mostly shadcn/ui components).
- **Hardcoded colors**: `globals.css` has ~10 hex values (`#1a1a1a`, `#121212`, `#262626`, etc.) for message bubbles, muted variants, and streamdown code blocks that bypass the CSS variable system.
- **Layout**: `layout.tsx` renders `<html lang="en" className="dark">` unconditionally.

## Decision

Add a three-way theme system (dark / light / system) using `next-themes`. Place a toggle in the sidebar footer (above the user info section). Default to **system** mode. Persist preference in `localStorage`.

### Scope

1. **Define light-mode CSS variables** — Current `:root` values become the `.dark` override. New `:root` values define the light palette.
2. **Replace hardcoded hex colors** in `globals.css` with CSS variable references so both themes are respected.
3. **Integrate `next-themes`** — wraps the app in `<ThemeProvider>`, manages `<html>` class toggling and `localStorage` persistence.
4. **Add theme toggle** to `Sidebar.tsx` footer — three-state cycle (system / light / dark) with icons. Works in both collapsed and expanded sidebar states.
5. **Fix `bold = brighter` rule** — the `b, strong { color: #ffffff }` rule must be conditional on dark mode.

### Non-goals

- Redesigning the color palette or adding accent color customization.
- Theming the backend landing page.
- Persisting theme preference server-side (localStorage is sufficient for a desktop app).
- Adding per-session or per-agent themes.

## Consequences

- Good, because users can choose their preferred mode and the app respects OS-level dark/light preference by default.
- Good, because `next-themes` handles SSR flash prevention, media query listeners, and localStorage — no custom code needed.
- Bad, because every hardcoded hex color in `globals.css` must be audited and converted to CSS variables.
- Bad, because the ~60 existing `dark:` utility usages in components may need review to ensure they still work correctly after the variable restructure.
- Neutral: adds one dependency (`next-themes`).

## Implementation Plan

### Dependencies

- **Add**: `next-themes` (to `desktop/renderer/package.json`)

### Affected paths

| File | Change |
|------|--------|
| `desktop/renderer/src/app/globals.css` | Restructure: light values in `:root`, dark values in `.dark`. Convert all hardcoded hex to CSS vars. |
| `desktop/renderer/src/app/layout.tsx` | Remove hardcoded `className="dark"`. Add `suppressHydrationWarning` to `<html>`. |
| `desktop/renderer/src/components/providers.tsx` | Wrap children with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`. |
| `desktop/renderer/src/components/sidebar/Sidebar.tsx` | Add theme toggle in footer area, above user info. |
| `desktop/renderer/src/components/sidebar/ThemeToggle.tsx` | New component: three-state toggle with sun/moon/monitor icons. |

### Step-by-step

1. **Install `next-themes`** in `desktop/`.

2. **Restructure `globals.css`**:
   - Define light-mode values in `:root` (invert the current dark palette — light backgrounds, dark foregrounds).
   - Move current dark values into a `.dark` selector block.
   - Replace all hardcoded hex values (`--user-bubble`, `--assistant-bubble`, `--muted-dark`, `--muted-darker`, `--muted-darkest`, `--accent-hover`, `--accent-muted`) with HSL vars that have both light and dark definitions.
   - Make the `b, strong { color: #ffffff }` rule conditional: only apply in `.dark`.
   - Audit streamdown overrides (`[data-streamdown="code-block-header"]` etc.) — replace hardcoded `hsla(0, 0%, 7%)` and `hsla(0, 0%, 4%)` with var references.

3. **Update `layout.tsx`**: Remove `className="dark"` from `<html>`, add `suppressHydrationWarning`.

4. **Update `providers.tsx`**: Add `next-themes` `ThemeProvider` wrapping the app with `attribute="class"`, `defaultTheme="system"`, `enableSystem`.

5. **Create `ThemeToggle.tsx`**:
   - Uses `useTheme()` from `next-themes`.
   - Three states: system (monitor icon), light (sun icon), dark (moon icon).
   - Clicking cycles: system -> light -> dark -> system.
   - Compact variant for collapsed sidebar (icon only), expanded variant shows icon + label.
   - Uses the existing sidebar styling conventions (`.label` mono font, `text-muted-dark`, hover states).

6. **Add toggle to `Sidebar.tsx`**:
   - Place `<ThemeToggle>` in the footer section, just above the user info block.
   - Pass `collapsed` prop for layout variant.

### Patterns to follow

- Sidebar footer uses `border-t border-border p-3` container pattern.
- Interactive sidebar elements use `text-muted-dark hover:text-foreground hover:bg-background/50` for inactive state.
- Labels use `mono text-[10px] uppercase tracking-wide`.
- All new CSS variables follow the existing HSL pattern: `--name: H S% L%` with `hsl(var(--name))` usage.

### Patterns to avoid

- Do NOT add raw hex colors — everything must go through CSS variables.
- Do NOT use `window.matchMedia` directly — let `next-themes` handle system preference detection.
- Do NOT create a separate settings page for theme — the sidebar toggle is sufficient.

### Light palette guidance

The light palette should maintain the "architect/terminal" aesthetic but inverted:
- Backgrounds: white to light gray range (95-100% lightness)
- Foregrounds: dark gray to near-black (10-20% lightness)
- Borders: light gray (~85-90% lightness)
- Muted text: medium gray (~45-55% lightness)
- Message bubbles: subtle off-white with light borders
- Code blocks: very light gray background

### Verification

- [ ] Three-way toggle visible in sidebar footer (both collapsed and expanded)
- [ ] Dark mode looks identical to current app appearance
- [ ] Light mode renders with light backgrounds and dark text throughout
- [ ] System mode follows OS dark/light preference and updates on OS change
- [ ] Theme persists across page reload
- [ ] No flash of wrong theme on initial load
- [ ] No hardcoded hex colors remain in `globals.css` (all converted to CSS vars)
- [ ] `bold = brighter` rule only applies in dark mode
- [ ] Streamdown code blocks render correctly in both themes
- [ ] All shadcn/ui components (buttons, inputs, dropdowns, tabs, badges) render correctly in both themes

## Alternatives Considered

- **Manual implementation (no library)**: Rejected because `next-themes` handles SSR hydration flash, media query listeners, localStorage sync, and `<html>` class management — reimplementing this is unnecessary effort for no benefit.
- **CSS `prefers-color-scheme` media query only (no class toggle)**: Rejected because this doesn't allow explicit user override independent of OS setting, and doesn't support a three-way toggle.
- **Storing theme in backend settings API**: Rejected as overkill for a desktop app where localStorage is sufficient and avoids an API round-trip on every page load.
