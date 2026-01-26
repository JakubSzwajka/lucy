# Next.js Development Guidelines

## Project Structure

- Use the App Router (`/app`) for all new features
- Organize by feature/domain, not by file type
- Keep components close to where they're used
- Use `@/` path alias for imports from the root

## Components

- Default to Server Components; use `'use client'` only when necessary (interactivity, hooks, browser APIs)
- Extract client interactivity into small leaf components to maximize server-rendered content
- Co-locate component, styles, and tests in the same directory
- Use named exports for components (easier refactoring and tree-shaking)

## Data Fetching

- Fetch data in Server Components whenever possible
- Use `fetch` with appropriate caching strategies (`cache: 'force-cache'`, `cache: 'no-store'`, or `next: { revalidate: N }`)
- Implement loading states with `loading.tsx` and Suspense boundaries
- Handle errors gracefully with `error.tsx` boundaries
- Use Server Actions for mutations; avoid API routes for internal data operations

## Performance

- Use `next/image` for all images with explicit `width` and `height`
- Use `next/font` for font optimization
- Implement dynamic imports (`next/dynamic`) for heavy client components
- Add appropriate `loading` and `placeholder` props to images
- Avoid layout shifts by reserving space for dynamic content

## TypeScript

- Enable strict mode in `tsconfig.json`
- Define explicit types for API responses, props, and state
- Use `satisfies` operator for type-safe object literals
- Prefer interfaces for public APIs, types for unions/intersections
- Never use `any`; use `unknown` and narrow with type guards

## Error Handling

- Implement `error.tsx` at appropriate route segments
- Use `notFound()` for 404 scenarios
- Log errors server-side with contextual information
- Show user-friendly error messages; never expose stack traces in production

## Security

- Validate all user input on the server (Server Actions, API routes)
- Use environment variables for secrets (`NEXT_PUBLIC_` prefix only for client-safe values)
- Implement proper CSRF protection for mutations
- Sanitize data before rendering to prevent XSS
- Use `headers()` and `cookies()` functions for secure header/cookie access

## State Management

- Prefer URL state (`useSearchParams`, `usePathname`) for shareable/bookmarkable state
- Use React Context sparingly; prefer Server Components data flow
- Keep client state minimal and close to where it's used
- Consider Zustand or Jotai for complex client state (avoid Redux unless necessary)

## API Design

- Use Route Handlers (`/app/api/`) only for external API consumption or webhooks
- Return consistent response shapes with proper HTTP status codes
- Implement rate limiting for public endpoints
- Use `NextResponse.json()` for responses

## Testing

- Write unit tests for utilities and business logic
- Use React Testing Library for component tests
- Implement E2E tests with Playwright for critical user flows
- Test Server Components by testing their rendered output

## Code Quality

- Run `next lint` and fix all warnings before committing
- Use Prettier for consistent formatting
- Keep components under 200 lines; extract logic into hooks or utilities
- Write self-documenting code; add comments only for non-obvious logic

## Deployment

- Use `output: 'standalone'` for containerized deployments
- Configure proper caching headers for static assets
- Set up health check endpoints
- Use ISR (Incremental Static Regeneration) for semi-dynamic content
- Monitor Core Web Vitals in production
