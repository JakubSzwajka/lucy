---
title: Landing Page
section: Gateway
subsection: Extensions
order: 11
---

# agents-landing-page

Separate Astro module for the Lucy landing page, intended to deploy to GitHub Pages.

## Local usage

```bash
cd agents-landing-page
npm install
npm run dev
```

## Production build

```bash
cd agents-landing-page
npm run build
```

GitHub Pages sets `SITE_URL` and `BASE_PATH` during the workflow so the generated asset paths match the repository URL.
