# Repository Guidelines

TypeScript + React SPA (Vite, Tailwind) for Pita Supply OS — the Captain and Manager screens that talk to the FastAPI backend. The framework imposes no layout, so these conventions are the contract.

## Local rules
- All API calls go through @./src/apiClient.ts — never call `fetch` from a component.
- All user-facing copy comes from @./src/i18n/ — no hardcoded strings in components.
- One page component per route in @./src/pages/ (e.g. `CaptainPage.tsx`, `ManagerPage.tsx`); routes are declared with react-router in @./src/App.tsx; sub-flows nest under `pages/manager/` and `pages/captain-mp/`.
- Auth is the token gate in @./src/auth.ts + @./src/AuthGate.tsx; shared types in @./src/types.ts; wrap route trees in @./src/ErrorBoundary.tsx.

## Build & run
`npm run dev` (Vite), `npm run build`, `npm run lint` (ESLint). Deploys to Vercel (@./vercel.json).

## Naming
Component files PascalCase; hooks and utilities camelCase.

## Tripwires
- No test runner exists yet — add Vitest before relying on the agent to verify UI changes.
- TypeScript `strict` is not enabled in @./tsconfig.app.json — prefer explicit types; do not lean on inference.

See @../AGENTS.md for the repo-wide operating constitution.
