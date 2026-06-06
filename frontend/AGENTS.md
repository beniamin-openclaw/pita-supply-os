# Repository Guidelines

TypeScript + React SPA (Vite, Tailwind) for Pita Supply OS — the Captain and Manager screens that talk to the FastAPI backend. The framework imposes no layout, so these conventions are the contract.

## Local rules
- All API calls go through @./src/apiClient.ts — never call `fetch` from a component.
- All user-facing copy comes from @./src/i18n/ — no hardcoded strings in components.
- One page component per route in @./src/pages/ (e.g. `CaptainPage.tsx`, `ManagerPage.tsx`); routes are declared with react-router in @./src/App.tsx; sub-flows nest under `pages/manager/` and `pages/captain-mp/`.
- Auth is the token gate in @./src/auth.ts + @./src/AuthGate.tsx; shared types in @./src/types.ts; wrap route trees in @./src/ErrorBoundary.tsx.

## Build & run
`npm run dev` (Vite), `npm run build`, `npm run lint` (ESLint). Deploys to Vercel (@./vercel.json).
- **Use a standard Node toolchain** (Homebrew, nvm, Volta, or the official installer). `package-lock.json` is committed — install with `npm ci` for reproducible tool versions (it pins eslint + `eslint-plugin-react-hooks`, whose newer `react-hooks/set-state-in-effect` rule a floating install can otherwise surface). `.nvmrc` pins the Node line.
- **`vite build` gotcha — `ERR_DLOPEN_FAILED` "different Team IDs":** Rollup's native addon (`@rollup/rollup-darwin-arm64`) is ad-hoc signed, so a Node built with **macOS hardened-runtime library validation** (e.g. an *app-bundled* Node like `Codex.app/Contents/Resources/node`) refuses to `dlopen` it. `tsc -b` still passes; only the Vite/Rollup step fails. Reinstalling `node_modules` and `codesign --remove-signature` do **not** help (library validation rejects any non-same-team lib). Fix: run the build under a normal dev Node (`which -a node`; prefer `/opt/homebrew/bin/node` / nvm), not an app-bundled one. Last resort for a hardened-only host: override `rollup` → `@rollup/wasm-node`.

## Naming
Component files PascalCase; hooks and utilities camelCase.

## Tripwires
- No test runner exists yet — add Vitest before relying on the agent to verify UI changes.
- TypeScript `strict` is not enabled in @./tsconfig.app.json — prefer explicit types; do not lean on inference.

See @../AGENTS.md for the repo-wide operating constitution.
