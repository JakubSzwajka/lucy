# Lucy Landing Page - Design Specification

## Overview

This directory contains the landing page for Lucy, an AI assistant with multi-agent orchestration, persistent memory, and tool integration. The landing page serves as both a marketing page and documentation hub for the project.

## Design Philosophy

**Dark Terminal / Architect Aesthetic** - The landing page matches Lucy's core UI aesthetic: a sophisticated, minimal dark interface that feels like a terminal meets a design tool. Professional, focused, code-forward.

### Core Principles
- **Clarity over decoration**: Every element has a purpose
- **Performance**: Fast, lightweight, no framework bloat
- **Accessibility**: WCAG AA compliant, keyboard navigable
- **Responsive**: Mobile-first, works beautifully on all screen sizes

## Color Palette

### Core Colors (from Lucy's UI)
```css
--background-primary: #0a0a0a;    /* Main background */
--background-secondary: #121212;  /* Card backgrounds */
--border-primary: #262626;        /* Borders, dividers */
--text-primary: #d9d9d9;          /* Main text */
--text-secondary: #8a8a8a;        /* Secondary text, labels */
--text-muted: #525252;            /* Disabled, placeholder */
```

### Accent Colors
```css
--accent-blue: #3b82f6;           /* Primary CTA, links */
--accent-blue-hover: #2563eb;     /* Hover states */
--accent-green: #10b981;          /* Success, active states */
--accent-purple: #8b5cf6;         /* Premium features */
--accent-orange: #f59e0b;         /* Warnings, highlights */
```

### Status Colors
```css
--status-success: #10b981;        /* Running, active */
--status-warning: #f59e0b;        /* Waiting, pending */
--status-error: #ef4444;          /* Error states */
--status-idle: #525252;           /* Idle, inactive */
```

## Typography

### Font Stack
1. **Inter (Sans Serif)** — The Human Layer
   - Use for: Natural language, UI navigation, prose, buttons, headers
   - Loading: Via Google Fonts with `font-display: swap`
   - Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

2. **JetBrains Mono (Monospace)** — The Machine Layer
   - Use for: Code blocks, timestamps, metadata labels, system status, keyboard shortcuts
   - Loading: Via Google Fonts with `font-display: swap`
   - Weights: 400 (regular), 500 (medium), 700 (bold)

### Type Scale
```css
--text-xs: 0.75rem;    /* 12px - Labels, captions */
--text-sm: 0.875rem;   /* 14px - Body small, metadata */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Subheadings */
--text-xl: 1.25rem;    /* 20px - Card titles */
--text-2xl: 1.5rem;    /* 24px - Section headers */
--text-3xl: 1.875rem;  /* 30px - Page headers */
--text-4xl: 2.25rem;   /* 36px - Hero title */
--text-5xl: 3rem;      /* 48px - Hero tagline */
```

### Typography Rules
**Rule of thumb:** If you are *reading* it (like a story), it's Inter. If you are *parsing* it (like data), it's JetBrains Mono.

Examples:
- Chat message bubbles → Inter
- Timestamps, token counts → JetBrains Mono
- Navigation labels → Inter
- Keyboard shortcuts (⌘N, ENTER) → JetBrains Mono
- Feature descriptions → Inter
- Status labels (WAITING, MEMORY) → JetBrains Mono

## Page Structure

Single-page, scroll-based layout with distinct sections:

### 1. Hero Section
**Purpose**: Immediate impact, clear value proposition

**Content**:
- Main tagline: "AI that thinks in teams"
- Subtitle: "Multi-agent orchestration. Persistent memory. Production-grade tools."
- Animated terminal typing effect showing example interaction
- Primary CTA: "Get Started" (links to GitHub)
- Secondary CTA: "View Demo" (scrolls to demo section)

**Visual Elements**:
- Full viewport height on desktop
- Animated terminal window showing typing effect
- Subtle grid background pattern
- Floating particles/dots animation (optional, performance-permitting)

**Animation**:
- Terminal typing effect: Character-by-character reveal with blinking cursor
- Fade-in on load for tagline
- Gentle pulse on CTA button

### 2. Features Grid
**Purpose**: Showcase 6 core capabilities

**Layout**: 2-column grid (3x2) on desktop, single column on mobile

**Features**:
1. **Multi-Agent Orchestration**
   - Icon: Network/graph icon
   - Description: Delegate tasks to specialized agents. Parallel execution. Automatic coordination.
   - Keyword tags: `delegation`, `parallelization`, `coordination`

2. **Persistent Memory**
   - Icon: Brain/storage icon
   - Description: Long-term context retention. Graph-based knowledge. Semantic search across conversations.
   - Keyword tags: `memory graphs`, `context`, `RAG`

3. **Tool Integration**
   - Icon: Wrench/plugin icon
   - Description: Built-in tools + MCP server support. Bash, file operations, web search, custom integrations.
   - Keyword tags: `MCP`, `extensible`, `integrations`

4. **Agent Configurations**
   - Icon: Sliders/config icon
   - Description: Pre-configured agent roles with custom tools, prompts, and models. Reusable across sessions.
   - Keyword tags: `templates`, `presets`, `workflows`

5. **Plan Management**
   - Icon: Checklist/roadmap icon
   - Description: Multi-step task tracking. Dependency management. Visual progress indicators.
   - Keyword tags: `planning`, `tasks`, `orchestration`

6. **Multi-Provider AI**
   - Icon: Cloud/AI icon
   - Description: OpenAI, Anthropic, Ollama, Gemini. Switch models per agent. Cost optimization.
   - Keyword tags: `providers`, `models`, `flexibility`

**Visual Style**:
- Cards with subtle border, background #121212
- Icon with accent color at top
- Feature title in Inter semibold
- Description in Inter regular
- Keyword tags in JetBrains Mono, smaller, muted color
- Hover effect: slight border color change, subtle lift

### 3. Live Demo Mock
**Purpose**: Show the product in action without requiring backend

**Content**:
- Fake chat UI matching Lucy's actual design
- Pre-scripted message sequence showing:
  - User message
  - Agent reasoning (collapsible)
  - Tool calls (with syntax highlighting)
  - Tool results (formatted JSON/text)
  - Agent delegation (parent → child agent)
  - Streaming response animation
  - Memory graph update notification

**Visual Elements**:
- Exact replica of chat UI from desktop app
- Message bubbles with timestamps
- Tool call blocks with syntax highlighting
- Status indicators (thinking, running, complete)
- Pulse animation on "streaming" messages

**Animation**:
- Auto-play on scroll into view
- Simulate typing/streaming effect
- Tool execution progress indicators
- Fade-in for new messages

### 4. Architecture Diagram
**Purpose**: Explain system architecture visually

**Content**:
- Flowchart showing:
  - Desktop App (Electron + Next.js)
  - ↕ API Client (JWT auth)
  - Cloud Backend (Next.js API)
  - ↕ Database (SQLite/Postgres)
  - ↕ AI Providers (OpenAI, Anthropic, etc.)
  - ↔ MCP Servers (external tools)

**Visual Style**:
- Simple boxes with labels
- Arrows with descriptive labels
- Color-coded by layer (UI, API, Storage, External)
- Monospace font for technical labels
- Dark theme matching overall design

### 5. Pricing / CTA Section
**Purpose**: Drive action, clarify licensing

**Content**:
- "Open Source" badge/callout
- Two options:
  1. **Self-Host** (Free)
     - Download desktop app
     - Run your own backend
     - Full feature access
     - CTA: "Download for macOS" / "View on GitHub"

  2. **Cloud Hosting** (Coming Soon)
     - Managed backend
     - Auto-updates
     - Team collaboration
     - CTA: "Join Waitlist"

**Visual Style**:
- Two-column cards with pricing tiers
- Clear CTA buttons
- Badge for "Open Source" with accent color
- Icons for each benefit

### 6. Footer
**Purpose**: Links, credits, tech stack

**Content**:
- Left: Lucy logo + tagline
- Center: Links (GitHub, Docs, Discord/Community)
- Right: Tech stack badges (Electron, Next.js, TypeScript, Anthropic, OpenAI)

**Visual Style**:
- Minimal, single row on desktop
- Stacked on mobile
- Muted text color
- Subtle top border

## Responsive Breakpoints

```css
/* Mobile first approach */
--mobile: 0px;           /* Default, single column */
--tablet: 768px;         /* 2-column features grid */
--desktop: 1024px;       /* Full layout, wider containers */
--wide: 1280px;          /* Max content width, centered */
```

### Mobile Adjustments
- Hero: Smaller text, full-width CTA
- Features: Single column stack
- Demo: Narrower chat UI, hide sidebar
- Architecture: Vertical flow diagram
- Pricing: Stacked cards
- Footer: Stacked, centered

## Animation Guidelines

### Performance
- Use CSS transforms and opacity (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left`
- Use `will-change` sparingly
- Respect `prefers-reduced-motion`

### Effects
1. **Terminal Typing Effect** (Hero)
   - JavaScript-driven character reveal
   - Blinking cursor with CSS animation
   - 50ms per character

2. **Scroll Fade-Ins**
   - Intersection Observer API
   - Fade + translate up on reveal
   - 300ms easing

3. **Status Pulse** (Demo)
   - Dot with pulse animation
   - 2s infinite loop
   - Opacity 0.5 → 1 → 0.5

4. **Hover Effects**
   - 200ms transition
   - Border color shift
   - Subtle lift (transform: translateY(-2px))

## File Structure

```
landing_page/
├── README.md           # This file (design spec)
├── index.html          # Main landing page (single file)
├── styles.css          # All styles (embedded in HTML for simplicity)
├── script.js           # Minimal JS (typing effect, scroll animations)
└── assets/             # Optional: logos, icons, demo screenshots
    ├── lucy-logo.svg
    └── icons/
        ├── network.svg
        ├── brain.svg
        ├── wrench.svg
        └── ...
```

**Note**: For initial version, embed CSS and JS directly in `index.html` to keep it as a single, self-contained file. Extract to separate files if it grows beyond ~500 lines.

## Content Guidelines

### Voice & Tone
- **Technical but approachable**: Assume developer audience, but don't over-engineer explanations
- **Confident, not boastful**: Show capabilities, let features speak for themselves
- **Clear over clever**: Avoid jargon unless it's standard terminology (e.g., "multi-agent" is fine, "synergistic AI orchestration" is not)

### Writing Style
- Short sentences for scanability
- Bullet points over paragraphs
- Active voice
- Specific examples over abstract claims

### Example Copy Snippets

**Hero Tagline Options**:
- "AI that thinks in teams"
- "Multi-agent AI for developers"
- "Your AI thinks in parallel"

**Feature Descriptions** (keep to 1-2 sentences):
- "Delegate complex tasks to specialized agents. They coordinate automatically, work in parallel, and share context seamlessly."
- "Every conversation builds a knowledge graph. Search across sessions, recall context, and never lose important details."

## Accessibility Checklist

- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Keyboard navigation for all interactive elements
- [ ] ARIA labels for icons and animations
- [ ] `alt` text for all images
- [ ] Skip navigation link
- [ ] Focus indicators visible and clear
- [ ] No animation if `prefers-reduced-motion`
- [ ] Semantic HTML (header, nav, main, section, footer)
- [ ] Heading hierarchy (h1 → h2 → h3, no skips)

## Performance Targets

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Total Page Size**: < 500KB (including fonts)
- **JavaScript**: < 50KB minified
- **CSS**: < 30KB minified

### Optimization Strategies
- Inline critical CSS
- Load fonts with `font-display: swap`
- Lazy load demo section images
- Minify HTML/CSS/JS for production
- Use modern image formats (WebP, AVIF fallback)

## Implementation Notes

### Phase 1: Static HTML/CSS
- Single `index.html` with embedded styles
- No JavaScript (除了 typing effect)
- Focus on layout and design

### Phase 2: Add Interactivity
- Typing animation
- Scroll-triggered fade-ins
- Demo auto-play

### Phase 3: Polish
- Optimize performance
- Add analytics (optional)
- A11y audit

### Future Enhancements (Optional)
- Dark/light theme toggle (if user demand)
- Interactive demo (actual chat playground)
- Video walkthrough embed
- Testimonials/case studies section

## Related Files

- Color palette source: `desktop/renderer/src/app/globals.css`
- Typography rules: `CLAUDE.md` Typography Rules section
- Architecture overview: `CLAUDE.md` Architecture Overview section

## Questions for Team Lead

1. Should we include a video demo or keep it text/image only?
2. Analytics tracking (Google Analytics, Plausible, none)?
3. Community links (Discord, GitHub Discussions) - are these set up yet?
4. Download links - where should they point (GitHub Releases, website hosting)?
5. Cloud waitlist - is there a form/service already set up?

---

**Status**: Specification complete, ready for implementation.
**Next Step**: Implement `index.html` based on this spec.
