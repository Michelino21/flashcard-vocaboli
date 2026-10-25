# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

English ↔ Italian flashcard app (UI and docs are in Italian). Qwik City app deployed as a Cloudflare Worker, with a D1 (SQLite) database bound as `DB`. There is no auth and no test suite. `README.md` has the user-facing description and `qwikguide.md` is a React→Qwik primer (read it before touching `$()` closures).

## Commands

```bash
npm install
npm run db:migrate:local   # apply migrations/ to the local D1 (.wrangler/)
npm run db:seed:local      # optional sample words (seed.sql)
npm run dev                # vite --mode ssr, http://localhost:5173 (D1 via wrangler getPlatformProxy)
npm run build              # qwik build (client + type check + worker build)
npm run serve              # wrangler dev against the built worker
npm run lint               # eslint "src/**/*.ts*"
npm run fmt                # prettier --write .
npm run build.types        # tsc --noEmit
npm run cf-typegen         # regenerate worker-configuration.d.ts after changing wrangler.jsonc bindings
npm run deploy             # build + wrangler deploy
```

Remote DB: `npm run db:migrate` / `db:seed`. `wrangler.jsonc` still has the placeholder `database_id` until `wrangler d1 create vocaboli` is run.

## Architecture

- **Data access**: `src/lib/db.ts` exports the `Word` type and `getDB(ev)`, which pulls the D1 binding from `ev.platform.env`. It accepts a `RequestEvent` or `this` inside `server$`.
- **Reads** use `routeLoader$` (e.g. `useWords` in `src/routes/index.tsx` loads only `visible = 1` rows). **Writes** go through either `routeAction$` (re-runs loaders) or `server$` (does not; the page updates its own state). The study page deliberately uses `server$` for `recordAnswer` and keeps a local `useStore` copy of the list, re-synced from the loader via `useTask$`.
- **Scheduling**: `src/lib/scheduler.ts` does weighted random card selection (`0.2 + 4·(1 − p)²`, `p = (correct+1)/(shown+2)`), so missed words appear more often.
- **Routes**: `src/routes/layout.tsx` (top bar + global "Aggiungi" action), `src/routes/index.tsx` (study), `src/routes/parole/index.tsx` (list/edit/delete/toggle visibility).
- **Schema**: `words(id, en, it, shown, correct, visible 0/1)`. Change it only by adding a new `migrations/000N_*.sql`; never edit an applied migration.

## Gotchas

- `src/entry.cloudflare-pages.tsx` keeps its "pages" name even though the target is Workers (same Qwik adapter); do not rename it. The Worker build config lives in `adapters/cloudflare-workers/vite.config.ts`.
- Helpers used inside `$()` closures must be module-level functions (e.g. `chooseDir`) or serializable values; see "Le regole di $" in `qwikguide.md`.
