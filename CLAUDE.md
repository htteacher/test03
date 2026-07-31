# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — typecheck (`tsc -b`, all three project references) then `vite build`
- `npm test` — run the full Vitest suite once (`vitest run`)
- `npm run test:watch` — Vitest in watch mode
- `npx vitest run <path>` — run a single test file (e.g. `npx vitest run src/quiz/quizReducer.test.ts`)
- `npm run lint` — oxlint
- `npx tsc -b --noEmit` — typecheck only, no build output

There is no local Supabase/Vercel dev loop wired up in this repo (no `vercel dev` usable in most agent sandboxes — it requires an interactive browser login). To exercise `api/*.ts` handlers against the real Supabase project without Vercel's dev server, invoke the handler functions directly from a script run with `npx tsx --env-file=.env <script>.ts` (loads `.env`, resolves extensionless TS imports). Handlers take plain `{ method, body }` / `{ status(), json() }` objects, so no Vercel-specific mocking is needed.

## Architecture

This is a classroom history-quiz SPA: React 19 + TypeScript + Vite frontend, deployed on Vercel, with a Supabase Postgres table for score storage accessed only through three Vercel serverless functions.

### Screen flow has no router

`src/quiz/QuizApp.tsx` owns a single `useReducer` (`src/quiz/quizReducer.ts`) and switches between five screen components based on `state.screen: 'intro' | 'question' | 'result' | 'teacherGate' | 'teacherResults'`. There is no routing library — adding one would fight this pattern. Each screen component (`IntroScreen`, `QuestionCard`, `ResultScreen`, `TeacherGate`, `TeacherResults`, all in `src/quiz/`) is a plain props-in/callbacks-out component with no `fetch` calls of its own; `QuizApp.tsx` is the only module that calls `fetch`, via a shared `postJson`/`ApiError` helper that throws on non-2xx and carries the HTTP status code (used to distinguish e.g. a 403 "attempt limit reached" from other failures — branch on `error.status`, not on the error message string).

### Backend is layered for testability, not just organized by folder

`api/_lib/{attempts,submit,results}Logic.ts` contain pure decision functions (attempt counting, the 3-attempt cap, password check) written against small storage interfaces (`AttemptCounter`, `SubmissionStore`, `ResultsStore`) — no Supabase/HTTP code, unit-tested with in-memory fakes. `api/_lib/supabaseAdmin.ts` is the only file that talks to Supabase; it implements those same interfaces against the real `quiz_submissions` table and maps between the app's camelCase fields (`className`, `studentNumber`, `createdAt`) and the table's snake_case columns. `api/attempts.ts` / `api/submit.ts` / `api/results.ts` are thin Vercel handlers: validate the request, call the logic layer, map the result to an HTTP status. When changing backend behavior, prefer editing the logic layer (testable) over the handlers (not unit-tested by design — see below).

### Security model: the table has no client-reachable path

`quiz_submissions` has RLS enabled with **zero policies** — the anon key (used by nothing in this codebase; `src/lib/supabaseClient.ts` exists but is unused/dead code) cannot read or write it under any circumstance. All reads and writes go through the three serverless functions using `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. This means the 3-attempt cap is enforced with an atomic-per-request check-then-insert in `submitLogic.ts`, not trusted to the client. Keep this boundary intact: never give the browser a code path to the table, and never let a server-only env var (`SUPABASE_SERVICE_ROLE_KEY`, `TEACHER_PASSWORD`) get a `VITE_` prefix — only `VITE_`-prefixed vars are exposed to the client bundle.

### Two separate TypeScript projects with different module resolution — a real gotcha

`tsconfig.app.json` (covers `src/`) uses bundler-style resolution: relative imports have no file extension (`from './quizReducer'`). `tsconfig.api.json` (covers `api/`, referenced from `tsconfig.json` alongside the other two) uses `nodenext` resolution, which is a **hard TypeScript error** without one: relative imports under `api/` must end in `.js` even though the files are `.ts` (e.g. `from './attemptsLogic.js'`) — this is the standard, correct NodeNext convention, not a typo. If you add a new file under `api/` or `api/_lib/`, its relative imports need this suffix or `npx tsc -b --noEmit` will fail with `TS2835`. `npm run build` runs `tsc -b` across all three project references, so this is caught before `vite build`.

### Testing conventions

Vitest + `@testing-library/react`, environment `jsdom` (`vite.config.ts`). `test.globals` is **not** enabled, so `@testing-library/react`'s automatic per-test `cleanup()` doesn't self-register — it's called once, centrally, via `afterEach` in `src/setupTests.ts`. Don't add a local `afterEach(cleanup)` in individual test files; it's redundant. `api/_lib/*Logic.ts` are tested with hand-written fake stores (see any `*Logic.test.ts` for the pattern); the Vercel handlers themselves and `supabaseAdmin.ts` have no automated tests by design (thin I/O glue — verified by exercising them against the real Supabase project, see the `tsx --env-file` approach above) — don't treat that gap as an oversight to "fix" without cause.

### Question data and extensibility

`src/data/questions.ts` is hardcoded (no CMS/DB for question content). `Question.category` is typed `'world' | 'korea'` but only `'world'` questions exist today — `src/quiz/QuizApp.tsx` filters to `category === 'world'` before sampling; adding Korean-history questions means appending to the array and deciding how/whether the UI should let students choose a category (currently there's no such picker).

### Env vars

`.env` (gitignored) holds four vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client-side, inlined into the Vite bundle), `SUPABASE_SERVICE_ROLE_KEY`, `TEACHER_PASSWORD` (server-only, read via `process.env` inside `api/`). All four must also be set in the Vercel project's Environment Variables for production/preview — adding or changing them there requires a redeploy to take effect for that deployment's functions, they aren't picked up live by an already-built deployment.

### Design tokens

`src/index.css` defines the app's only design-token set (`--text`, `--text-h`, `--bg`, `--border`, `--accent`, `--accent-bg`, `--accent-border`, `--code-bg`, plus font vars) for light/dark themes. `src/quiz/QuizApp.css` is the single stylesheet for all five quiz screens, scoped under `.quiz-app-screen`, and reuses these tokens rather than introducing new colors (the correct/incorrect answer highlight colors are the one intentional exception — they're hardcoded rgba green/red since no semantic success/error token exists yet).

### Design history

`docs/superpowers/specs/` and `docs/superpowers/plans/` contain the point-in-time design spec and implementation plan for the quiz feature. Useful for understanding *why* a decision was made, but treat them as historical record, not living documentation — the code is authoritative for current behavior.
