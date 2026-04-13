# changelog.md — Room Invaders
## Applied Logic Technologies, LLC — ALT Games Division

---

## [0.0.2] — 2026-04-12 — Phase 0 Start: Project Initialization

### Added
- **Task 0.0.1 [DONE]:** Initialized Next.js 16.2.3 project with TypeScript 5.9,
  pnpm 10.33, App Router, TailwindCSS 4, ESLint 9, and `src/` directory structure.
- Installed pnpm globally.
- Relocated project docs (GDD, architecture, tasks, changelog, handoff, planning)
  to `docs/` directory per architecture spec.

### Verified
- `pnpm build` passes cleanly (Turbopack).
- Dev server boots and renders default Next.js page on localhost.
- TypeScript compilation succeeds with zero errors.

---

## [0.0.1] — 2025-07-10 — Pre-Production Initialization

### Added
- **Game Design Document v1.0:** Complete GDD covering core loop, mechanics
  (room building, fortification, async raids, resource economy, quests, map,
  safe mode), progression systems (player level, room level, tech tree,
  reputation), lore ("The Fracture"), UI/UX screen map, monetization framework
  (deferred), tech stack selection, asset requirements, MVP scope, expansion
  roadmap through v1.0, and risk assessment.
- **architecture.md v0.0.1:** System topology, tech stack table, full
  repository directory tree, PostgreSQL schema (6 core tables + indexes + RLS
  policy summary), React ↔ Phaser bridge specification, isometric engine
  parameters, PWA configuration spec.
- **tasks.md v0.0.1:** 8 development phases with 120+ granular tasks. Phase 0
  (Foundation) through Phase 8 (Polish & Launch Prep) plus future backlog.
- **changelog.md:** This file.

### Decisions Locked
- Platform: PWA (Next.js + Vercel)
- Engine: Phaser 3 (isometric 2.5D)
- Backend: Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- Art style: Stylized isometric, between Habbo Hotel and Roblox
- Combat: Asynchronous (attacker plays, defense is automated)
- Room system: Standardized grid (10×10 MVP), cosmetically customizable,
  structurally fair
- MVP scope: PvE only, single room, tutorial quest chain, no PvP

