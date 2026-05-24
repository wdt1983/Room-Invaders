@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm**. All commands run from `room-invaders/`.

- `pnpm dev` — start Next.js dev server at http://localhost:3000
- `pnpm build` — production build
- `pnpm start` — run built app
- `pnpm lint` — ESLint (flat config in `eslint.config.mjs`)

No test runner is configured. `tests/` is referenced in `docs/architecture.md` as a planned directory but does not yet exist.

### Supabase

Schema lives in `supabase/migrations/` (numbered SQL files, applied sequentially) plus `supabase/seed.sql` for the items catalog. Edge Functions go in `supabase/functions/<name>/index.ts` (Deno). Local dev expects a Supabase project — copy `.env.example` to `.env.local` and fill in URL + anon key.

## Architecture

### Next.js 16 + React 19 + Phaser 4 — not your training data

See `AGENTS.md`: this uses Next.js 16, React 19.2, and Phaser **4** (not 3, despite what `docs/architecture.md` says — docs are stale). Consult `node_modules/next/dist/docs/` before assuming any Next.js API behaves as you remember. Heed deprecation notices.

### React ↔ Phaser bridge

Phaser runs in a single `<canvas>` inside a React wrapper. The two worlds communicate **only** through:

1. **Zustand stores** (`src/lib/store/`) — shared state. React reads/writes; Phaser scenes read on init and write back on state changes.
2. **EventBus** (`src/game/EventBus.ts`) — typed one-off commands (e.g., "enter edit mode").

Rules: React never calls Phaser scene methods directly; Phaser never calls React setState directly. All cross-boundary data flows through Zustand or the EventBus.

### Directory layout

- `src/app/` — Next.js App Router. Route groups: `(auth)` for login/register, `(game)` for the authenticated game shell (room, map; raid/quests/profile planned).
- `src/components/` — React. `ui/` is shadcn primitives; `game/` holds the Phaser canvas wrapper; `layout/` and `store/` hold shells and store-backed components.
- `src/game/` — pure Phaser code, no React imports. `PhaserGame.ts` is the factory; `scenes/` (Boot, Room, RoomEditor), `objects/` (sprites), `systems/` (GridSystem, IsometricEngine), `utils/`, plus `config.ts` and `EventBus.ts`.
- `src/lib/supabase/` — browser and server Supabase clients (`@supabase/ssr`). `src/middleware.ts` runs auth middleware at the edge.
- `supabase/` — migrations, edge functions, seed. Auth, RLS, and server-authoritative logic (raid resolution, defense validation) live here; the client is **not** trusted for game outcomes.

### Isometric engine

Tile is 64×32. World-to-screen: `screenX = (x - y) * 32 + offsetX`, `screenY = (x + y) * 16 + offsetY`. Z-layers: 0 floor, 1 ground objects, 2 wall-mounted, 3 ceiling, 4 VFX. See `src/game/systems/IsometricEngine.ts`.

### Docs

`docs/architecture.md`, `docs/gdd.md`, `docs/Planning.md`, `docs/tasks.md`, `docs/changelog.md`, `docs/handoff.md` — design/planning docs. Architecture doc predates the Next 16 / Phaser 4 / React 19 upgrade in places; treat code as source of truth when it disagrees.
