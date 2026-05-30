# tasks.md — Room Invaders
## Version: 0.26.0 | Last Updated: 2026-05-29

## Milestone 9J: Volumetric Color Shading & Direct Move Relocation Tool (v0.26.0)
**Goal:** Implement dynamic 3D wall shading based on player cosmetics, and build a secure, zero-cost free relocation Move Tool for room customization.

### Stage 3: Dynamic Range Resizing, Wall Snapping & Breathing Grid
- `[x]` Update `rangeTilesFor` in `defense.ts` to support multi-tile footprint parameters and exclude interior cells.
- `[x]` Update `drawRangeOverlay` in `RoomEditorScene.ts` to calculate and pass ghost footprint dimensions.
- `[x]` Update `drawDefenseViewOverlay` in `RoomScene.ts` to pass placed items' rotated footprint dimensions.
- `[x]` Implement visual boundary snapping offsets in `updateIsometricPosition` in `FurnitureSprite.ts`.
- `[x]` Implement the GPU-accelerated pulsing alpha grid tween inside `RoomEditorScene.ts` `drawEditorGrid`.
- `[x]` Compile and test all modifications.

### Stage 2: Footprint Relocation, Neon Grid & Holographic Pop Effects
- `[x]` Select `footprint` in `catalogData` query inside `page.tsx`.
- `[x]` Extend `CatalogItem` interface to support `footprint` in `useRoomStore.ts`.
- `[x]` Pass `footprint` in the `item-selected` event emission in `ItemPanel.tsx`.
- `[x]` Fix the `ContextMenu.tsx` Move button to extract catalog data (type, stats, footprint) and emit the correct object payload to `item-selected`.
- `[x]` Implement multi-tile occupancy tracking in `RoomScene.ts` (loading items, placing items, relocating items).
- `[x]` Rewrite `isPlaceableFor` in `RoomScene.ts` to support multi-tile footprint checks and bypass the item's own original footprint.
- `[x]` Rewrite `movePlacedItem` Server Action in `actions.ts` to execute multi-tile bounds, perimeter, entry-point, and non-self occupancy checks.
- `[x]` Build the double-pass glowing neon grid in `RoomEditorScene.ts` utilizing the active `wallColor`.
- `[x]` Listen for `cosmetics-changed` in `RoomEditorScene.ts` to dynamically refresh the neon grid.
- `[x]` Program beveled cybernetic pop particles in `RoomScene.ts` `handleMoveSuccess` matching the customized preset color.
- `[x]` Compile and test all modifications.

### Stage 1: Dynamic Wall Shading & Relocation Foundation
- `[x]` Implement the secure `movePlacedItem` Server Action in `actions.ts` with bounds, occupancy, turret, and entry-point validation.
- [x] Add the `movingItem` state and `setMovingItem` setter in `useUIStore.ts` to manage active relocation.
- [x] Add the `movePlacedItemAt` action in `useRoomStore.ts` to update Cartesian coordinates in the Zustand store.
- [x] Upgrade `ContextMenu.tsx` with a cyan-accented **Move Furniture** button that hooks into state transitions.
- [x] Integrate placement/move interception inside `GameBridge.tsx` to handle free movements or fallback to standard purchase.
- [x] Implement `adjustColor(color, factor)` in `RoomScene.ts` to scale RGB channels.
- [x] Update procedural 3D wall rendering in `drawWalls()` to dynamically shade face panels and glowing neon top tubings using the active `wallColor`.
- [x] Implement the `'move-success'` EventBus listener in `RoomScene.ts` with coordinate updates, grid state registration, and a spring pop tween scale animation.
- [x] Add the `isOriginalSpot` bypass in `isPlaceableFor` to permit placing items back on their original tile during a move.
- [x] Automatically clear `movingItem` state in `useUIStore.ts` whenever the user exits Edit Mode.
- [x] Verify production build (`pnpm build`) and all 55 tests (`pnpm test`) pass successfully.

## Bedroom Defense Placement & Faction Boss Locks (v0.25.2)
**Goal:** Resolve defense placement errors, register advanced Phaser assets, and enforce secure boss locks.

- [x] Deduplicate Circuit's EMP Mine `sprite_key` to `'trap_circuit_emp_mine'` in `seed.sql`, `boss-rooms.ts`, `resolve-raid/index.ts`, and `TrapSystem.ts` to fix placement.
- [x] Register missing visual assets (`turret_power_node`, `guard_drone`, `guard_dog`, `guard_decoy`, `trap_circuit_emp_mine`) in Phaser `BootScene.ts`.
- [x] Implement database-to-Zustand client state hydration of completed boss clears (`clearedBosses`).
- [x] Implement gorgeous cybernetic padlocks and descriptive clear tooltips (e.g. `Defeat Circuit to unlock`) in the shop panel `ItemPanel.tsx`.
- [x] Enforce secure server-side validation in `buyAndPlaceFurniture` Server Action to reject unauthorized placement of locked boss reward items.

## Console Error & Hydration Fixes (Polishing & Stability)
**Goal:** Address runtime and build-time console errors to achieve a flawless Next.js 16 / React 19 / Phaser 4 application runtime and clean compilation.

- [x] Synchronized remote database schema with all 29 migrations (`supabase db push`) to resolve column mismatches (e.g., `rooms.room_size_tier` column missing, which caused `roomError` on `page.tsx`).
- [x] Refactored `StoreInitializer.tsx` state updates from the inline render cycle into standard React `useEffect()` hooks, permanently eliminating React 19's "Cannot update a component while rendering a different component" hydration warning.
- [x] Added `"use client";` boundary directive to `StoreInitializer.tsx` to resolve Next.js Turbopack Server Component compilation failures, ensuring a 100% clean production build compile (`pnpm build`).
- [x] Verified build compilation, lint rules compliance, and execution of all 55 automated unit tests with 100% success.

## High-Fidelity 3D Volumetric Procedural Asset Overhaul (Aesthetic Refinement)
**Goal:** Address user feedback by replacing basic geometric flat vector drawings with highly polished, multi-layered 3D isometric sub-block assemblies for all main catalog items.

- [x] Develop a 3D isometric sub-block rendering helper (`drawVolumetricSubBlock`) supporting local footprint and height coordinate mapping
- [x] Implement 3D layered components for Twin Bed (wooden frame base, headboard, footboard, raised mattress, blanket layer, volumetric neon pillow)
- [x] Implement 3D layered components for Wooden Desk (individual volumetric leg pillars, wood top slab, drawer unit cabinet, standing monitor with support neck, keyboard)
- [x] Implement 3D layered components for Office Chair (star base spokes, riser cylinder, thick black fabric seat cushion, steel back bar, black backrest)
- [x] Implement 3D layered components for Metal Shelf (tall vertical poles, wireframe shelves, cardboard storage box, toolboxes, glowing gas canisters)
- [x] Implement 3D layered components for TV Flatscreen (wooden console cabinet base, middle compartment, deck receiver, volumetric TV neck, beveled screen panel)
- [x] Implement 3D layered components for Dresser (dresser box frame, three separately inset drawer compartments)
- [x] Implement 3D layered components for folding tables, potted plants (terracotta pot, soil, plant stem, leafy voxel green layers), and floor lamps (base, vertical rod, glowing lamp shade dome)
- [x] Implement 3D layered components for Barricades (flipped bookshelf with vertical shelves and spilled colorful books, table shield with horizontal legs, sandbag canvas blocks)
- [x] Implement 3D layered components for turrets (pyramid armor bases, swivel collars, gun housings, twin volumetric gun barrels, condenser coils, taser brass spikes, energy coil rings)
- [x] Ground entities and stash chests (hovering central drone chassis, quad arms, neon discs, gold armored lockbox chest with steel reinforcement straps)

## Volumetric Isometric Voxel/Pixel Art Upgrade (Aesthetic Polish)
**Goal:** Upgrade the procedural asset rendering to create high-fidelity, polished, 3D volumetric voxel/pixel art assets with correct coordinate rotations and contact shadows.

- [x] Pre-generate 4 distinct directional textures (`_dir_0` to `_dir_3`) in `BootScene.ts`
- [x] Implement soft contact floor shadows under all blocks in `generateIsoBlock()`
- [x] Add volumetric gradients (overhead/side lighting) for Top, Left, Right faces
- [x] Add neon rim bevels and shadow seams to emphasize volumetric forms
- [x] Program unit-basis coordinate mappings (`getPoint()`) for all sub-feature layouts on the Top face
- [x] Enable 4-way rotation for wood grains (desks, tables), pillows/mattress (beds), and office base Spokes (chairs)
- [x] Refactor `FurnitureSprite.ts` to swap textures based on rotation step (eliminating 2D setAngle hack)
- [x] Hydrate correct starting textures in `RoomScene.ts` and `RaidScene.ts`
- [x] Fix Windows TypeScript excludes for `supabase/functions/` Deno files in `tsconfig.json`

---

> **Reconciliation note (2026-04-13):** Task ledger was re-aligned against the actual
> code state after drift accumulated across sessions. Tasks that were implemented in
> code but never checked off were marked DONE. Duplicated Phase 3 tasks (squad unit /
> movement / pathfinding) that had been re-implemented under 3.0.1–3.0.4 were removed.
> Phase 4 goal was restored to "Economy & Quests" (the Global Recon Map work belongs
> to Phase 5 and is now tracked as 5.0.1). A critical sprite-key bug was fixed
> (BootScene keys now match `items.sprite_key` in seed.sql).

---

> Execute task [X.Y].
> 0. Read CLAUDE.md, TASKS.md, and HANDOFF.md
> 1. [Any specific requirements for the task]
> 2. [Additional context if needed]
> 3. Update docs:
>    - ARCHITECTURE.md if any structural/directory changes
>    - CHANGELOG.md for any milestone completions
>    - HANDOFF.md for session-specific context worth preserving
>    - TASKS.md: check off completed tasks, add new tasks if spawned, note blockers
> When done, summarize:
> 1. Files created/changed
> 2. [Task-specific deliverable]
> 3. [Task-specific verification]
> 4. Verification results (build, lint, runtime)
> 5. Exact next task to run
> ```

## Phase 0: Foundation
**Goal:** Bootable project with auth, database, and empty game canvas.

- [DONE] 0.0.1 — Initialize Next.js 16 project with TypeScript, pnpm, App Router
- [DONE] 0.0.2 — Configure TailwindCSS + shadcn/ui (button, card, input, dialog, sheet)
- [DONE] 0.0.3 — Configure PWA: native manifest.ts, service worker, PWA icons
- [DONE] 0.0.4 — Set up Supabase: install `@supabase/supabase-js` + `@supabase/ssr`, env config, DB types placeholder
- [DONE] 0.0.5 — Create Supabase client helpers (`client.ts`, `server.ts`, `middleware.ts`)
- [DONE] 0.0.6 — Implement auth flow: register (email/password), login, logout, session persistence
- [DONE] 0.0.7 — Create auth middleware — redirect unauthenticated users to `/login`
- [DONE] 0.0.8 — Run migration `00001_profiles.sql` — profiles table + trigger on auth signup
- [DONE] 0.0.9 — Run migration `00002_rooms.sql` — rooms table, auto-create room on profile insert
- [DONE] 0.0.10 — Run migration `00003_items_inventory.sql` — items + player_items + inventories
- [DONE] 0.0.11 — Create `seed.sql` — populate items table with starter furniture + traps
- [DONE] 0.0.12 — Create game layout: `(game)/layout.tsx` with BottomNav + TopBar (resource display)
- [DONE] 0.0.13 — Install Phaser 3, create `PhaserGame.ts` factory, create `GameCanvas.tsx` React wrapper
- [DONE] 0.0.14 — Create `BootScene.ts` that loads a single placeholder tile and renders it
- [DONE] 0.0.15 — Verify Phaser ↔ React bridge: Zustand store updates propagate to React HUD
- [DONE] 0.0.16 — Set up Sentry error tracking (client-side)
- [DONE] 0.0.17 — Create `.env.example`, update README with setup instructions
- [DONE] 0.0.18 — Deploy to Vercel, verify PWA installable on mobile Chrome/Safari

> **Phase 0: Foundation is COMPLETED.** All exit criteria have been met.

**Exit Criteria:** User can register, log in, see a game layout with bottom nav and a Phaser canvas rendering a single tile. PWA installable. Database seeded.

---

## Phase 1: The Room
**Goal:** Fully functional isometric room editor. Place, move, remove furniture. Save/load.

- [DONE] 1.0.1 — Implement `IsometricEngine.ts`: worldToScreen, screenToWorld coordinate transforms
- [DONE] 1.0.2 — Implement `GridSystem.ts`: 10×10 grid data structure, tile state management (empty, occupied, entry_point)
- [DONE] 1.0.3 — Implement `RoomScene.ts`: render floor tiles in isometric grid, draw wall boundaries
- [DONE] 1.0.4 — Implement camera controls: pan (touch drag / mouse drag), zoom (pinch / scroll wheel)
- [DONE] 1.0.5 — Implement 4-rotation camera (rotate grid 90° CW/CCW) with smooth transition
- [DONE] 1.0.6 — Create placeholder sprite set: 10 furniture items (bed, desk, chair, shelf, table, lamp, TV, rug, plant, dresser) as colored isometric blocks
- [DONE] 1.0.7 — Implement `FurnitureSprite.ts`: isometric game object with footprint, z-sorting, placement validation
- [DONE] 1.0.8 — Implement `RoomEditorScene.ts`: enter edit mode from RoomScene
- [DONE] 1.0.9 — Room editor: item selection panel (React overlay) — browse available furniture
- [DONE] 1.0.10 — Room editor: place item on grid (tap to select tile, validate footprint fits, snap to grid)
- [DONE] 1.0.11 — Room editor: move item (tap placed item → drag to new position → validate → snap)

- [DONE] 1.0.12 — Room editor: remove item. Edit-mode tap on occupied tile opens context menu with "Remove (50% refund)" action. `removePlacedItem` server action deletes the `player_items` row, refunds `floor(cost.scrap * 0.5)`, and GameBridge emits `removal-success` so RoomScene destroys the sprite + clears the tile + syncs `useRoomStore`.
- [DONE] 1.0.13 — Room editor: rotate item. Edit-mode ContextMenu gains a secondary "Rotate 90°" button (RotateCw icon) alongside Remove. `request-rotation` → GameBridge → `rotatePlacedItem(x, y)` server action reads current `player_items.rotation` and writes `(r + 1) % 4`. `rotation-success` → RoomScene calls `sprite.setFurnitureRotation(r)` which `setAngle(r*90)` for visual spin and swaps `footprintW`/`footprintH` on odd rotations. Persisted via new migration `00004_player_item_rotation.sql` (NOT NULL DEFAULT 0, CHECK IN (0,1,2,3)). Rotation reapplied on SSR rehydrate via `placedItems.forEach`.
- [DONE] 1.0.14 — Z-sorting: `FurnitureSprite.setDepth(gridX + gridY + 1)` renders items back-to-front correctly
- [DONE] 1.0.15 — `useRoomStore.ts` tracks `gridSize`, `placedItems`, `catalog`; hydrated on page SSR
- [DONE] 1.0.16 — Room persistence (save): `buyAndPlaceFurniture` server action inserts into `player_items` with `placed_in_room=true`
- [DONE] 1.0.17 — Room persistence (load): SSR joins `player_items` ↔ `items` in `room/page.tsx`, RoomScene rehydrates on `create()`
- [DONE] 1.0.18 — Wall rendering + entry-point indicators. Each of the 4 outer walls is drawn as `grid_size` thick colored line segments via a dedicated `wallGraphics`; segments at entry-point positions are tinted per type (door=sienna, window=sky, vent=slate). Each entry tile gets a floor-level diamond sprite (`entry_door` / `entry_window` / `entry_vent`) with a pulsing alpha tween. Grid state at each entry tile is set to `'entry_point'` before placed-item hydration, and `removal-success` restores `'entry_point'` rather than `'empty'` via `baseTileStateFor()`. Walls + entry sprites rotate with the grid on Q/E.
- [DEFERRED → Phase 8] 1.0.19 — Cosmetic: wall color picker (saves to `rooms.cosmetics`). *Deferred 2026-04-14: walls currently render as procedural colored line segments in `RoomScene.drawWalls()`; a color picker on placeholder art is throw-away work. Bundle with 8.0.1 (final art pass) when walls get real sprite segments.*
- [DEFERRED → Phase 8] 1.0.20 — Cosmetic: floor type selector (wood, carpet, tile, concrete — saves to `rooms.cosmetics`). *Deferred 2026-04-14: floor is a single `iso-tile` placeholder sprite. Floor-variant selector needs real tile textures first. Bundle with 8.0.1.*
- [DONE] 1.0.21 — Input handling: touch + mouse handled inline in `RoomScene`/`RoomEditorScene` pointermove/pointerdown. No dedicated `InputManager.ts` — revisit if complexity grows.
- [DONE] 1.0.22 — Performance: implement tile culling (only render tiles within camera viewport)

> **Phase 1 interactive-editor capabilities are complete.** Remaining Phase 1 items are 1.0.22 (tile culling — premature perf work until 14×14 rooms land at room-level 20) plus 1.0.19/1.0.20 which have been **deferred to Phase 8.0.1 (final art pass)** because they're cosmetic toggles on top of placeholder art. Phase 1 is effectively closed for the purpose of downstream work.

**Exit Criteria:** Player opens the room page, sees their 10×10 isometric room. Can enter edit mode, place/move/remove/rotate furniture from a catalog, change wall color and floor type. Room persists across sessions.

---

## Phase 2: Economy + Fortification
**Goal:** DB hydration, inventory/catalog wiring, resource ticks, and defense placement rules. Bridges the pure-client editor of Phase 1 to a persistent, rule-checked economy.

- [DONE] 2.0.1 — Database to Zustand Hydration (Inventory Sync): Fetch SSR inventories and hydrate `usePlayerStore`.
- [DONE] 2.0.2 — Implement `useRoomStore.ts` and hydrate from DB in `page.tsx` + `StoreInitializer.tsx`. Translate db `player_items` via `RoomScene.ts` instantiation loop.
- [DONE] 2.0.3 — Persistent Placement and Economy Deduction: Implemented Server Action and GameBridge syncing EventBus to backend validations.
- [DONE] 2.0.4 — Player Progression and Catalog Hydration: Fetched profile player_level & items catalog passing to Zustand store + overlaying UI lock validations.
- [DONE] 2.0.5 — Implement Client-Side Tick and Periodic Database Sync: Created TickManager running asynchronous data generation and syncing server payloads seamlessly natively securely.
- [DONE] 2.0.6 — Placement rules: new `RoomScene.isPlaceableFor(type, x, y)` predicate. Traps/furniture/barricades/cosmetic/consumable/guard = any empty non-entry tile (already enforced by `isTileWalkable`). Turrets = empty tile AND on outer perimeter (`x==0 || x==N-1 || y==0 || y==N-1`). Ghost-sprite tint + editor pointerdown placement both gate on the predicate. ItemPanel's `item-selected` EventBus payload widened from `string` to `{ key, type }`. Mirrored server-side in `buyAndPlaceFurniture`: rejects out-of-bounds, on-entry-tile (via shared `entryTileFor` util in `src/lib/game/entryPoints.ts`), turret-off-perimeter, and same-tile double-placement before charging scrap. First concrete step toward the 2.0.9 `validate-defense` Edge Function.
- [DONE] 2.0.7 — Defense slot system: track placed defenses against room-level cap. *Previously marked DONE but not enforced in code — corrected 2026-04-14 as part of 2.0.8.* Now live: `slotsForLevel(room_level)` in `src/lib/game/defense.ts` returns caps per GDD §5.1 table (L1→8 slots, L5→16, L10→28, L15→40, L20→55). `buyAndPlaceFurniture` counts placed defense-category rows (types: trap/turret/barricade/guard) server-side before charging scrap and rejects with `Defense slots full (N max at room level L)` when the insert would exceed cap. Client state (`useRoomStore.defenseSlotsUsed/Cap`) is hydrated on SSR and refreshed from server responses on every placement/removal. HUD pill in TopBar shows `defenseSlotsUsed / defenseSlotsCap` with a destructive tint when full. Furniture cap not yet enforced (follow-up).
- [DONE] 2.0.8 — Defense rating calculation. New `defenseValueFor(type, stats)` in `src/lib/game/defense.ts` computes per-item contribution: `trap = damage + stun*5 + immobilize*3 + alert*2`, `turret = damage * max(1, range)`, `barricade = floor(hp/10)`, `guard = damage*2`, others = 0. Shared `recomputeDefenseState(supabase, userId, roomLevel)` runs a full SELECT-sum over all placed items after every `buyAndPlaceFurniture` and `removePlacedItem`, then `UPDATE rooms.defense_rating`. Server actions return fresh `{defenseRating, defenseSlotsUsed, defenseSlotsCap}` which `GameBridge` pipes into `useRoomStore.setDefenseStats`. TopBar HUD shows `Def: N`. Formula tuning target: balance pass (4.0.2).
- [DONE] 2.0.9 — Implement `validate-defense` Edge Function: verify layout legality server-side on save
- [DONE] 2.0.10 — Visual: defense items show range/trigger zones when selected in editor. New pure `rangeTilesFor(type, stats, originX, originY, gridSize)` in `src/lib/game/defense.ts` returns `{primary, alert}` tile lists. Chebyshev disk of `stats.range` for turrets (primary band, orange `0xf97316`), Chebyshev disk of `stats.alert_radius` for traps (alert band, yellow `0xeab308`). Origin excluded; out-of-bounds auto-clipped. Rendered as filled iso-diamonds by a new `rangeGraphics` `Phaser.GameObjects.Graphics` at scene depth 0 on `RoomEditorScene`, repainted every `pointermove` anchored at the current ghost tile. `stats` propagated catalog → store → `item-selected` EventBus payload → editor scene. Cleared on item deselect and `change-mode → view`. Unblocks 2.0.11 (same overlay primitives + defense-view trigger). Rotation refresh: redraws on next `pointermove` after Q/E, matching existing ghost-sprite behavior.
- [DONE] 2.0.11 — Visual: defense items pulse/glow when room is in "defense view" mode. New UI mode `'defense-view'` added to `useUIStore.mode` (now `'view' | 'edit' | 'defense-view'`). TopBar gains a `Radar`-icon "Defense View" toggle button (cyan border when active); existing Edit toggle now lives next to it and still works from any mode (edit→view→defense-view transitions are reachable in one click). `RoomScene` owns defense-view state: `defenseViewActive` + `defenseViewGraphics` (depth 0.25 — above floor, below entry-point markers + furniture) + `defenseViewTweens[]`. Mode listener branches on `'defense-view'` to call `enterDefenseView()` (drop pulse tweens `α 0.5↔1.0` at 1000ms Sine.easeInOut on every `furnitureItems` sprite; draw coverage overlay via `rangeTilesFor` + shared `paintRangeBand`) / `exitDefenseView()` (kill tweens, reset α to 1, clear overlay). `rotateGrid()` redraws overlay if active. Pathfinding pointerdown already guarded by `currentMode === 'view'`, so defense-view is read-only automatically. Editor-scene sleep predicate widened from `mode === 'view'` to `mode !== 'edit'` so defense-view doesn't leave editor listeners running. Paint primitive (`paintRangeBand`) extracted to `src/game/utils/rangeDraw.ts` + shared `RANGE_FILL_COLOR` constants — one source of truth for both edit-mode ghost range and defense-view coverage map, so tint / geometry changes touch one file. Overlapping defense zones stack alpha intentionally (denser coverage reads as denser color). Unblocks no direct downstream task but closes the strategic-depth loop — players can now inspect current coverage and rebalance before a raid lands.
- [DONE] 2.0.12 — Resource cost: placing defenses deducts from inventory. Removing refunds 50%. **Core economy contract was already in place:** `buyAndPlaceFurniture` deducts `items.cost.scrap` and gates on sufficient funds (since 1.0.10 / 1.0.16); `removePlacedItem` returns `refund = floor(cost.scrap * 0.5)` and credits it back (since 1.0.12). This task closes the **UX seam** that was missing from the deduction/refund flow: installed `sonner` (2.0.7), new `Toaster` in `(game)/layout.tsx` (top-center, richColors, closeButton), new `src/components/ui/sonner.tsx` shadcn wrapper that binds sonner's `--normal-bg/text/border` to `--popover`/`--popover-foreground`/`--border`. `GameBridge` fires `toast.success`/`toast.error` on every placement / removal / rotation outcome, with catalog-sourced item names and server-returned `newScrap` / `refund` / `cost` numbers. Rotation success is intentionally silent (sprite visually rotates; toast would be noise). TopBar `upgradePlayerLevel` button also fires toasts. **Bundles coverage of the toast follow-up flagged across 2.0.6 / 2.0.7 / 2.0.8 handoffs** — every server-side rejection (wrong tile type, slots full, insufficient scrap, turret-off-perimeter) now surfaces its error string to the player instead of `console.error`.

**Exit Criteria:** Player can place traps, turrets, and barricades in their room. Defense rating updates. Server validates layout. Resources are deducted.

---

## Phase 3: The Raid (PvE)
**Goal:** Player can raid NPC rooms. Full attack flow: prep → execute → results.

- [DONE] 3.0.1 — Implement A* Pathfinding Logic: built deterministic A* into GridSystem.ts, Debug graphics into RoomScene, Shift+Click in Editor.
- [DONE] 3.0.2 — Implement Phase 3 Entity Instantiation and Dynamic Path Traversal (EntitySprite + walkPath).
- [DONE] 3.0.3 — Implement Phase 3 Camera Tracking, Adjacency Pathfinding for Occupied Tiles routines, and Interaction callbacks.
- [DONE] 3.0.4 — Implement Phase 3 Interactive Context Menus (Zustand state integration, React ContextMenu, and EventBus bridging).
- [MERGED] ~~3.0.5 squad unit~~ — covered by `EntitySprite.ts` in 3.0.2. HP/speed still TODO (fold into CombatSystem below).
- [MERGED] ~~3.0.6 tap-to-pathfind movement~~ — covered by RoomScene `pointerdown` + `EntitySprite.walkPath` in 3.0.2–3.0.3.
- [MERGED] ~~3.0.7 PathfindingSystem~~ — A* lives in `GridSystem.findPath` / `findPathToAdjacent` (3.0.1, 3.0.3). Keep A* co-located with grid until it needs to split out.
- [DONE] 3.0.8 — TrapSystem. New `src/game/systems/TrapSystem.ts` is the first real consumer of `CombatSystem` and the first in-game damage source; it replaces the `__raidDev` console hook from 3.0.9. `EntitySprite.walkPath` now emits `EventBus 'entity-entered-tile'` with `{ entityId, x, y }` at the end of each per-tile tween (single hook that 3.0.10 turret LOS and 3.0.12 stash-hold will also subscribe to). `TrapSystem` subscribes to that event, looks up an internal `Map<"x,y", DeployedTrap>`, decrements `usesRemaining`, applies damage via `applyDamage(target, damage, entityId)`, and emits `'trap-triggered'` with `{ gridX, gridY, spriteKey, entityId, damageDealt, stunSeconds, immobilizeSeconds, alertRadius, slow, usesRemaining, exhausted }`. Exhaustion emits `'defense-destroyed'` directly (traps are `hp === null`, so `applyDamageToPlaced` would `{ ignored: true }`) so RaidScene's existing sprite + tile cleanup listener runs with no new wiring. `TRAP_STATS_BY_SPRITE_KEY` mirrors `items.stats` in `supabase/seed.sql` for the 5 trap types (pressure plate, spike strip, shock pad, glue, tripwire alarm) — canonical client-side source until 3.0.16 / 6.0.8 hydrate stats from the DB. RaidScene fixture loop now skips `setTileState('occupied')` for `type === 'trap'` so A* routes the squad over the trap tile (step-on = trigger); other defense types still block movement. `RaidScene.handleTrapTriggered` owns scene-side consequences split from TrapSystem: kills the tween chain on stun/immobilize, pushes `stunnedUntilMs` forward, alpha-pulses the squad sprite for the freeze duration, flashes the trap sprite (1.0 → 0.25 → 1.0 yoyo × 2, 120ms), triggers `cameras.main.shake(180, 0.005)`, and appends a `'trap_triggered'` entry to `useRaidStore.actionLog` (partial 3.0.14 landing). `handlePointerDown` early-returns while `Date.now() < stunnedUntilMs` so clicks are ignored during freeze. Slow stat (spike strip) is echoed in the payload + log but NOT applied in MVP — tween-duration modification is deferred.
- [DONE] 3.0.9 — CombatSystem. New `src/game/systems/CombatSystem.ts` exposes `applyDamage(target, amount, entityId)` and `applyDamageToPlaced(placed, amount)` as the *authoritative* Phase 3 damage pipeline — every future damage source (trap / turret / barricade attack) flows through one of these. `HasHp` contract on targets; damage mutates the target's `hp` field in place, emits `EventBus 'entity-damaged'` on every non-zero hit and `'entity-killed'` exactly once on the kill frame (already-dead damage is a silent no-op). Symmetric `heal(target, amount, entityId)` helper; never revives (hp===0 is terminal). Nullable-HP variant for `PlacedTarget` so furniture / cosmetics / traps / turrets default indestructible while barricades (and future destructibles) opt in. `EntitySprite` extended with `entityId` + `hp` + `maxHp` (default 100 via `DEFAULT_SQUAD_HP`); `FurnitureSprite` extended with nullable `hp` + `maxHp` (null = indestructible). `useRaidStore` gains `squadHp` + `squadMaxHp` fields + `setSquadHp(hp, maxHp?)` mutator. `RaidScene` listens to `'entity-damaged'`/`'entity-killed'` (gated on `entityId === 'player'`) → mirrors HP to store → calls `finishRaid('defeat', 'Squad eliminated')` on kill; listens to `'defense-destroyed'` → destroys sprite + clears tile state. `finishRaid` now derives `damageTaken = squadMaxHp − squadHp` from the authoritative sprite HP. `RaidHUD` adds a rose-tinted HP bar (destructive below 30%) with `{hp} / {maxHp}` readout. `window.__raidDev = { damageSquad(amount), damagePlaced(x, y, amount), healSquad(amount) }` dev console surface exposed from RaidScene for manual verification until upstream damage sources (3.0.8 / 3.0.10 / 3.0.11) replace the need — uninstalled on scene teardown. All new EventBus listeners paired with off() in the SHUTDOWN/DESTROY teardown hook.
- [DONE] 3.0.10 — TurretAI. New `src/game/systems/DefenseAI.ts` exports `TurretAI` + `TURRET_STATS_BY_SPRITE_KEY` + `TurretFiredPayload`. Mirrors the TrapSystem pattern (pure w.r.t. Phaser, registers placements at scene start, emits a typed event on each action). `TurretAI` ticks off `RaidScene.update(time)`; per turret it checks (a) ammo remaining, (b) `time - lastFiredAtMs >= fire_rate * 1000` cooldown, (c) Chebyshev range to the target using the sprite's live `currentGridX/Y`. Effective range = `stats.range + (alerted ? ALERT_RANGE_BONUS : 0)` where alerted is `time < alertedUntilMs`. Fire path: `applyDamage(target, damage, entityId)` via CombatSystem → emit `'turret-fired'` with `{ gridX, gridY, spriteKey, targetEntityId, targetGridX, targetGridY, damageDealt, stunSeconds, ammoRemaining, exhausted, alerted }` → if ammo reaches 0, emit `'defense-destroyed'` (reuses existing sprite + tile cleanup, same pattern as trap exhaustion). Alert synergy: TurretAI subscribes to `'trap-triggered'` directly; on a trap event with `alertRadius > 0` (tripwire alarm), any turret within Chebyshev `alertRadius` of the trap origin gets `alertedUntilMs = now + ALERT_DURATION_MS` (5s default, +1 range). Stats mirror seed.sql: `turret_nailgun` (8 dmg / 3 range / 1.0s / 15 ammo), `turret_taser` (5 dmg / 2 range / 0.8s / 10 ammo / 1.0s stun). RaidScene wiring: new `turretAI` field instantiated after squad spawn + fixture turret registration loop; `update(time)` override gated on `phase === 'active'` calls `turretAI.tick(time)`; new `onTurretFired` bound listener handles scene-side consequences. `handleTurretFired` draws a short fading projectile line via Phaser `Graphics` (amber `0xfde047` for nailgun, cyan `0x67e8f9` for taser, 150ms alpha fade), applies the taser stun via a new shared `applySquadStun(seconds)` helper extracted from `handleTrapTriggered`, and appends a `turret_fired` entry to `useRaidStore.actionLog` (second 3.0.14 emitter). No camera shake on turret fire (would be disorienting at 1Hz). No LOS / facing-arc / rotation-aware firing — all deferred to polish passes.
- [DONE] 3.0.11 — Barricade attack. Clicking an occupied tile paths the squad adjacent via `findPathToAdjacent`, then `walkPath`'s `onComplete` calls `startBarricadeAttack(gridX, gridY)` if the sprite has non-null `hp`. Attack runs on a Phaser TimerEvent at `SQUAD_MELEE_RATE_MS` (1000ms = 1 hit/sec), dealing `SQUAD_MELEE_DAMAGE` (10) per tick via `applyDamageToPlaced`. First consumer of CombatSystem's placed-damage path — barricades get `hp` from `BARRICADE_HP_BY_SPRITE_KEY` (bookshelf=50, flipped_table=30, sandbags=75, mirroring seed.sql `items.stats.hp`) passed to `FurnitureSprite` constructor during fixture placement. Each attack tick: checks adjacency (Chebyshev 1), checks stun (skip-on-stun, resumes after), checks sprite alive, then calls `applyDamageToPlaced` → CombatSystem emits `'defense-damaged'`/`'defense-destroyed'`. VFX: brief alpha flash (1.0→0.5→1.0, 100ms yoyo) on each hit, no camera shake. Action log: appends `barricade_attacked` entry with `{ gridX, gridY, spriteKey, damage, hpRemaining, destroyed }`. Attack stops on: new click (`handlePointerDown` calls `stopBarricadeAttack`), barricade destruction, raid end (teardown). Stun doesn't stop the timer — just skips ticks, attack resumes after stun ends.
- [DONE] 3.0.12 — Loot stash. New `stash: { x, y }` field on `NpcRoomFixture`; all 3 fixtures get positions deep in the room near turrets. New `loot_stash` texture (gold, 6px tall) in BootScene. RaidScene renders a pulsing stash marker at the stash tile (depth x+y+0.5, alpha 0.5↔1.0, 800ms). New `onEntityEnteredTile` listener: when squad enters stash tile → `startStashHold()` starts a 10Hz Phaser timer that ticks `stashHoldProgress` (0→1) into `useRaidStore` over `STASH_HOLD_SECONDS[difficulty]` (easy=3, medium=5, hard=8). When progress reaches 1 → `finishRaid('victory', 'Loot stash secured')`. If squad enters any other tile or player clicks, hold cancels (`cancelStashHold`). Stun doesn't cancel (squad is still on the tile). New `stashHoldProgress` + `setStashHoldProgress` in useRaidStore. RaidHUD shows an amber capture progress bar (Package icon + "Capturing..." label) when `stashHoldProgress > 0`. Extract (dev) button **removed** — loot stash is the real victory trigger. Action log entries: `stash_entered`, `stash_secured`, `stash_cancelled`.
- [DONE] 3.0.13 — Raid timer scaffold. New `useRaidStore` (phase `'prep' | 'active' | 'results'`, `timeRemainingSeconds`, `durationSeconds`, `actionLog[]`, `results`, target/difficulty); `RAID_DURATION_SECONDS = { easy: 90, medium: 120, hard: 150 }` per GDD §3.2. New `RaidScene.ts` loads an {@link NpcRoomFixture}, renders floor / walls / entry markers / NPC furniture using the same isometric primitives as RoomScene, spawns the player entity one tile inside the first entry, and starts a 1Hz `time.addEvent` that calls `useRaidStore.tickTimer()`. When `timeRemainingSeconds → 0`, auto-completes with `outcome: 'defeat', reason: 'Time ran out'`. BootScene now branches on `window.location.pathname.startsWith('/raid/')` to pick RaidScene vs RoomScene. Fixture set seeded at `src/game/fixtures/npc-rooms/` (3 tier-1 rooms: Abandoned Apartment, Storage Unit, Corner Store). `/raid` route lists fixtures; `/raid/[id]` mounts the raid shell with the new `RaidInitializer` (mirror of `StoreInitializer`).
- [DONE] 3.0.14 — Implement `action_log` recording: every move, trap trigger, damage event logged to array. *All 10 emitters landed: `trap_triggered` (3.0.8), `turret_fired` (3.0.10), `barricade_attacked` (3.0.11), `stash_entered` / `stash_secured` / `stash_cancelled` (3.0.12), `move` / `damage` / `entity_killed` / `defense_destroyed` (3.0.14). Full raid timeline is now recorded for server-side replay validation (3.0.16).*
- [DONE] 3.0.15 — Raid results screen scaffold. New `RaidResults.tsx` React overlay mounts whenever `useRaidStore.phase === 'results'`. Reads the `RaidResults` payload committed by `RaidScene.finishRaid` and displays victory/defeat banner (color-coded green / destructive red), target name + difficulty, `reason` subtext, and five stat cards: Time used, XP gained, Scrap looted, Components, Damage taken. Two CTA links: "Raid Another" → `/raid`, "Return to Map" → `/map`. Reward numbers are scaffold placeholders — real economy wiring is owned by 3.0.16 (resolve-raid Edge Function) and 3.0.17 (LootSystem). Defeat branch is driven by timer expiry + the Abandon button in `RaidHUD`; victory branch is driven by a dev-labeled "Extract (dev)" button in the HUD until 3.0.12 (loot stash) lands the real trigger. Both outcomes flow through a single `EventBus.emit('raid-complete', { outcome, reason })` contract that future systems plug into without touching the scaffold. `RaidInitializer` resets the store on unmount so the next raid starts clean.
- [DONE] 3.0.16 — Implement `resolve-raid` Edge Function. First Deno Edge Function in the project. Lives at `supabase/functions/resolve-raid/` (`index.ts` + `fixtures.ts`). Receives `{ fixtureId, outcome, reason, secondsElapsed, squadHp, squadMaxHp, actionLog }` from the client, validates (fixture known, outcome enum, HP bounds, secondsElapsed bound by `MAX_RAID_SECONDS = 200`, victory must contain a `stash_secured` event in the log), computes rewards from a per-difficulty table (`REWARDS_BY_DIFFICULTY`: easy=50/25/5, medium=80/45/10, hard=120/75/20 xp/scrap/components on victory; defeat grants xpDefeat only), and commits loot to `inventories.scrap/components` + XP to `profiles.xp`. Returns fresh `{ xpGained, lootScrap, lootComponents, damageTaken, newScrap, newComponents, newXp, validated: true }`. Client wrapper: `src/lib/game/resolveRaid.ts` calls `supabase.functions.invoke('resolve-raid', { body })` with typed req/resp. Store wiring: `useRaidStore` gains `resultsValidation: 'idle'|'validating'|'validated'|'error'` + `resultsValidationError` + `beginValidation`/`completeValidation`/`failValidation` mutators. React glue: new `RaidResolver.tsx` (mounted on `/raid/[id]`) fires the call exactly once when phase transitions to `'results'` and `resultsValidation === 'idle'`; on success it overwrites scaffold rewards via `completeValidation` and credits `usePlayerStore.setInventory({ scrap, components })` so the TopBar reflects the new balance. RaidScene decoupled — `finishRaid` still writes scaffold rewards so the results screen renders instantly; the resolver upgrades them in the background. `RaidResults.tsx` gains a `ValidationNotice` footer showing spinner/validated-check/amber-error states (replaces the scaffold disclaimer). **Tsconfig + eslint config excludes** (`supabase/**`) added — Deno code doesn't get typechecked by Next or linted by the Node pipeline. Edge Function deploy: `supabase functions deploy resolve-raid` — until deployed, `resolveRaid()` returns `null`, `failValidation` fires, and the scaffold numbers remain visible (graceful degradation). Full replay validation (re-simulate action_log against fixture to detect impossible damage / traversals) is deferred to Phase 5 hardening when PvP raises the stakes; MVP validation is the structural gates listed above.
- [DONE] 3.0.17 — LootSystem. Server-side (not `LootSystem.ts` in client `src/game/` — the client must never see the loot table or roll logic; original task name predates the 3.0.16 security boundary). New `supabase/functions/resolve-raid/lootSystem.ts` exports `NPC_LOOT_TABLES` (per-fixture loot definitions: APARTMENT/STORAGE/CORNER_STORE) + seeded `mulberry32` PRNG + `cyrb53` string hash + `deriveSeed(userId, nowMs)` helper + `rollLoot(fixtureId, outcome, userId)` → `LootRoll = {scrap, components, credits, intel, contraband, xpGained, seed}`. Each `LootTableEntry` has `{resource, min, max, chance}` — independent per-resource drop gate then uniform `[min,max]` roll. Tables: apartment (easy) guaranteed 20-30 scrap + 3-7 components + 30% credits; storage (easy) 25-35 scrap + 3-7 components + 20% credits + 10% intel; corner_store (medium) 35-50 scrap + 8-12 components + 40% credits + 15% intel + 5% contraband. XP flat per outcome (no RNG). Edge Function swaps `REWARDS_BY_DIFFICULTY` (removed from `fixtures.ts`) for `rollLoot` call, selects `inventories.scrap/components/credits/intel/contraband` (3 new columns joined), commits all 5 on `anyLoot`, and echoes `lootSeed` in the response. Seed derivation: `cyrb53(`${userId}:${floor(nowMs/1000)}`)` — second-granularity so a PvP replay in Phase 5 can reproduce the roll, and two rapid-fire POSTs in the same second collide (cheap anti-doubling side-effect). Schema extensions end-to-end: `ResolveRaidResponse` adds `lootCredits/Intel/Contraband`, `lootSeed`, `newCredits/Intel/Contraband`. `RaidResults` in `useRaidStore` adds zero-defaulted `lootCredits/Intel/Contraband`. `RaidScene.finishRaid` scaffold writes zero for the new fields; server fills in via resolver. `RaidResolver` widens `completeValidation` + `setInventory` calls to cover all 5 currencies. `RaidResults.tsx` shows `Coins`/`Eye`/`Package` icon cards for credits/intel/contraband — conditionally rendered (`> 0` only) so defeat screens + unlucky victories don't show zero-value clutter. `usePlayerStore.setInventory` already accepted partial state, so TopBar picks up the new totals automatically.
- [DONE] 3.0.18 — Implement `useRaidStore.ts`: raid state management (target, phase, timer, results)
- [DONE] 3.0.19 — XP → level-up. New shared curve module (`src/lib/game/progression.ts`) with `xpForLevel(n) = 50 * n * (n - 1)`, `levelForXp`, and `levelProgress`. Mirrored server-side as `supabase/functions/resolve-raid/progression.ts` (stays in sync until a future task promotes the curve to a DB table). `resolve-raid` Edge Function now computes `levelForXp(newXp)` after crediting XP, bumps `profiles.player_level` when a threshold is crossed, and returns `previousPlayerLevel` / `newPlayerLevel` / `leveledUp` in the response. Never demotes — a scrap-purchased level from `upgradePlayerLevel` (4.0.13) that outpaces the XP threshold survives. `usePlayerStore` gains an `xp` field + `applyXpAndLevel(xp, level)` mutator that recomputes `maxScrap` / `maxComponents` on the new level and is idempotent w.r.t. identical inputs. `StoreInitializer` now requires an `xp` prop and seeds the store from `profiles.xp` on room-page SSR; `room/page.tsx` selects `xp` alongside `player_level`. `RaidResolver` calls `applyXpAndLevel(res.newXp, res.newPlayerLevel)` after the inventory write and fires a `toast.success("Level up! Lvl N")` (or `Lvl N → M` for multi-level jumps from hard-raid XP grants that cross multiple thresholds) when the server reports a delta. `TopBar` renders a translucent primary-tinted progress fill behind the Lvl button, clipped to `progress01 = xpIntoLevel / xpForNext`, with a tooltip carrying the raw numbers. Max level 100 (≈495,000 XP). Milestone unlock hooks from GDD §6.1 (L3 second trap, L5 PvP, L8 tech tree, etc.) are **not yet wired** — 3.0.19 delivers the XP → level promotion pipeline only; milestone-gated content lives with Phase 4 (4.0.13 / 4.0.14).
- [DONE] 3.0.20 — NPC room cooldowns: each NPC room has a 4-hour cooldown after being raided. Enforced on the server side via the `resolve-raid` Deno Edge Function, which queries `raid_history` for any raids completed by the player for the fixture in the last 4 hours and rejects them with a 400 error. Enforced on the client-side individual raid page (`src/app/(game)/raid/[id]/page.tsx`) by querying `raid_history` and redirecting users back to the list if the target is on cooldown.
- [DONE] 3.0.21 — Raid list: show cooldown timers, locked/unlocked state based on player level. Fully integrated into the raid target card component and general page view (which already computed lock/timer displays). Secured the individual raid page (`src/app/(game)/raid/[id]/page.tsx`) via a Next.js Server Component guard that queries the player's level from the database and redirects back to `/raid` if they do not meet the fixture's required level.
- [DONE] 3.0.22 — Authoritative Server-Side Replay Validation: Implement chronological replay verification inside the `resolve-raid` Deno Edge Function by executing client-sent `actionLog` payloads against our node-compatible TypeScript implementations of `CombatSystem`, `TrapSystem`, `DefenseAI`, and `BossAI`. Secures the PvP loop against client-side exploitation or spoofed logs before database commits are allowed.

**Exit Criteria:** Player can browse NPC targets, prep a raid, play through the room (move unit, dodge traps, destroy barricades, avoid turrets), reach the loot stash, and receive rewards. Server validates results with full chronological replay re-simulation.

---

## Phase 4: Economy & Quests
**Goal:** Resource display, quest system, level-up progression. Builds on Phase 2's economy foundation.

- [DONE] 4.0.1 — `ResourceBar` in TopBar: 5 resources (Scrap/Components/Credits/Contraband/Intel) with lucide icons + max caps. Implemented during Phase 0.0.12.
- [DONE] 4.0.2 — Complete Defense-Cost and Plundering Balance Pass. Performed a comprehensive balance pass on all 30+ placeable items (furniture, traps, turrets, barricades, advanced gated defenses, and boss rewards) in `supabase/seed.sql`. Balanced scrap/component ratios to ensure high player starting accessibility and strategic pacing, and synchronized stats maps across client systems (`TrapSystem.ts`, `DefenseAI.ts`, `RaidScene.ts`) and Deno-safe Edge Function files (`replaySystems.ts`, `replayValidator.ts`) to maintain 100% server-client validation parity. All 46 Vitest unit tests pass successfully.
- [DONE] 4.0.3 — Implement repair system: defenses damaged/triggered during PvP raids are authoritatively flagged as is_damaged. Restoring their operational status requires 40% of original Scrap cost (minimum 5 Scrap). Damaged items are visually greyed/rusty-red tinted and translucent in the editor, and contribute 0 to the defense rating. Replays and active raids filter them out server-side. Deployed migrations, Edge Functions, React UI ContextMenu, TopBar warning badge, and Phaser event loops successfully.
- [DONE] 4.0.4 — Passive resource generation: `TickManager` runs 5s client tick + 30s DB sync; `room/page.tsx` applies offline delta on SSR (capped to 24h).
- [DONE] 4.0.5 — Storage Caps & Overflow: Enforced `inventories.storage_capacity` as the protected resource cap (scrap cap = `storage_capacity`; components cap = `floor(storage_capacity * 0.25)`). Resources gathered above this cap (from passive offline tick or future raids) are allowed up to the player-level absolute limits (`maxScrap` / `maxComponents`), but accumulate as raidable "overflow" targets once Safe Mode expires. The TopBar resource HUD is styled in an amber/orange warning highlight with a pulsing animation and descriptive hover tooltips to alert the player of exactly how much overflow resource is currently at risk.
- [DONE] 4.0.6 — Create `quests.json`: full tutorial quest chain (8 quests) + 5 daily quest templates + 3 weekly templates. Created `src/game/fixtures/quests.json` (and matching Deno Edge Function copy) establishing static quest blueprints and parameters.
- [DONE] 4.0.7 — Implement quest board UI (`/quests` page): active quests, available quests, completed quests. Created Server Component route `/quests` that dynamically seeds level-unlocked dailies/weeklies on load, and mounts `QuestDashboard` Client Component using premium glassmorphism, Outfit styling, progress rings, checklists, and reward currency badges.
- [DONE] 4.0.8 — Implement quest tracking: `player_quests` table, progress updated on relevant events. Created database migration `00006_quests.sql` introducing `player_quests` tracking table, performance indices, and RLS policies. Successfully pushed to remote Supabase instance.
- [DONE] 4.0.9 — Implement quest event hooks: raid_completed, item_placed, defense_placed, level_up → check active quest progress. Created server-side `src/lib/game/quests.ts` progress tracking engine. Hooked progress triggers into room load (`view_room`), item placement actions (`place_furniture` / `place_defense`), Defense Rating recalculation (`reach_defense_rating` >= 50), player level upgrades (`upgrade_level`), and inline raid victories (`raid_fixture`) in the `resolve-raid` Edge Function.
- [DONE] 4.0.10 — Implement quest completion: validate via `process-quest` Edge Function, grant rewards. Created and deployed `process-quest` Deno Edge Function. Validates completed quests, transitions status to `'claimed'`, and credits resources (scrap, components, credits, intel, contraband) and XP authoritatively on the server, handling level promotions.
- [DONE] 4.0.11 — Implement tutorial quest sequence: gated progression, each quest unlocks next. Programmed the progression engine to automatically activate subsequent onboarding goals (from `tut-01` to `tut-08` in sequence) exactly upon completing a tutorial step.
- [DONE] 4.0.12 — Implement tutorial UI overlay: ceasefire briefing overlay. Created the **Safe Mode Briefing Card** on `/quests` that opens a custom dialogue explaining ceasefire terms and level 5 storage overflows. Confirming the briefing completes the final tutorial quest `tut-08`.
- [DONE] 4.0.13 — Player level-up progression curve milestones. Created secure scrap-upgrades, quests, and raid resolvers. Programmed the progression engine, XP thresholds (`src/lib/game/progression.ts`), and a gorgeous fullscreen glassmorphic `<LevelUpOverlay />` that maps unlocking defenses/furniture blueprints dynamically from the catalog and tracks systemic milestones (Level 3 secondary traps, Level 5 PvP matchmaking, Level 8 Tech tree, Level 10 second squad slot, etc.).
- [DONE] 4.0.14 — Room Level Upgrades: Implemented premium stronghold room level upgrades up to Level 20! Added the `upgradeRoomLevel` server action that validates resource upgrade costs (scrap and components scaling per tier), transactionally updates the `rooms` and `inventories` tables (adjusting `room_level`, `grid_size`, `entry_points`, and `storage_capacity`), and recomputes the player's defense slots and rating dynamically. Developed a gorgeous glassmorphic **Upgrade Stronghold** sheet dialogue highlighting current vs next stats (Grid Sizing, Defense Slots, Protected Capacity, and unlocked Entry Points like the L5 West Skylight, L10 North Breach Wall, L15 South Second Window, and L20 East Tunnel). Phaser's `RoomScene` and `RoomEditorScene` were upgraded to dynamically scale grids and trigger EventBus restarts upon upgrading, seamlessly expanding the player's canvas.
- [DONE] 4.0.15 — Daily quest refresh: server-side via pg_cron, 3 new dailies at midnight UTC. Created `public.refresh_daily_quests()` PL/pgSQL stored procedure, enabled the `pg_cron` extension, and scheduled midnight UTC refresh sweeps.
- [DONE] 4.0.16 — Weekly quest refresh: 3 new weeklies on Monday 00:00 UTC. Created `public.refresh_weekly_quests()` PL/pgSQL stored procedure and scheduled Monday 00:00 UTC refresh sweeps.

**Exit Criteria:** Player earns resources from raids, spends them on room upgrades and items. Quest board shows tutorial + daily + weekly quests. Completing quests grants rewards. Player can level up.

---

## Phase 5: PvP & Social (v0.2) Async PvP & Scouting
**Goal:** Async PvP raids. Safe mode expiration. Defense replays. Friends.
- [DONE] 5.0.1 — Global Recon Map (`/map`): SSR fetches `profiles` + joined `rooms.grid_size`, renders selectable base-target cards with Scout button. (Previously mis-numbered as 5.0.0 / 4.0.1 in earlier logs.)
- [DONE] 5.0.2 — Implement safe mode timer display in HUD, expiration logic
- [DONE] 5.0.3 — Implement manual safe mode deactivation (player choice)
- [DONE] 5.0.4 — Implement PvP matchmaking: `matchmaking` Edge Function — find opponent by room level bracket ±1
- [DONE] 5.0.5 — PvP target info screen: show defender's defense rating, room level, replay count (not layout)
- [DONE] 5.0.6 — Adapt `RaidScene.ts` to load player room layouts (from DB) instead of NPC JSON
- [DONE] 5.0.7 — Implement loot transfer: attacker gains % of defender's overflow resources
- [DONE] 5.0.8 — Implement post-raid shield: defender gets 8h shield after being raided
- [DONE] 5.0.9 — Implement raid notification: defender sees "You were raided by [username]" on next login
- [DONE] 5.0.10 — Implement replay system: store action_log, build replay viewer in `RaidScene.ts` (playback mode)
- [DONE] 5.0.11 — Implement replay UI: defense log screen showing all received raids, watch replay button
- [DONE] 5.0.12 — Implement revenge raid: button on raid notification → directly target that player
- [DONE] 5.0.13 — Run migration `00006_social.sql`: friendships table
- [DONE] 5.0.14 — Implement friends system: search by username, send/accept/decline friend requests
- [DONE] 5.0.15 — Implement room visiting: view friend's room (read-only, no defense info visible)
- [DONE] 5.0.16 — Implement raid cap: max 3 PvP raids received per day per player
- [DONE] 5.0.17 — Implement defense rating anti-sandbagging: snapshot rating before raid, compare to current
- [DONE] 5.0.18 — Implement reputation system: +RP for wins, -RP for losses, brackets

> **Phase 5 PvP & Social is COMPLETED.** All exit criteria have been met.

---

## Phase 6: The Neighborhood Map (v0.3)
**Goal:** Instanced neighborhood map. NPC variety. Visual target selection.

- [DONE] 6.0.1 — Design neighborhood map layout: player room center, surrounding NPC slots
- [DONE] 6.0.2 — Implement `MapScene.ts` (or React-based map): top-down neighborhood view
- [DONE] 6.0.3 — Render player room as central building on map
- [DONE] 6.0.4 — Render NPC buildings at surrounding positions (scaled difficulty by distance from center)
- [DONE] 6.0.5 — Render friend rooms on map (if friends exist)
- [DONE] 6.0.6 — Map interaction: tap building → info popup → raid button
- [DONE] 6.0.7 — NPC building visual variety: house, apartment, store, warehouse, military outpost
- [DONE] 6.0.8 — Implement NPC room procedural generation: `generate-npc-room` Edge Function
- [DONE] 6.0.9 — NPC difficulty tiers 1-10 (expand from initial 1-3)
- [DONE] 6.0.10 — Map refresh: NPC buildings change on daily reset
- [DONE] 6.0.11 — Map navigation: pan/zoom across neighborhood

> **Phase 6 The Neighborhood Map is COMPLETED.** All exit criteria have been met.

---

## Phase 7: Tech Tree & Loadouts (v0.4)
**Goal:** Strategic depth. Branching upgrades. Squad customization.

- [DONE] 7.0.1 — Create `tech-tree.json`: full tree structure with 3 branches, ~30 nodes (Created in game/fixtures/tech-tree.json with offense, defense, and utility nodes).
- [DONE] 7.0.2 — Implement tech tree UI: visual node graph, unlockable with tech points (Developed visual 3-column scrollable research branches under /squad tab).
- [DONE] 7.0.3 — Implement tech point earning: 1 per player level, trigger based (Implemented handle_player_level_up_tech DB trigger automatically awarding tech points).
- [DONE] 7.0.4 — Tech tree effects: unlock new items, stat boosts, new abilities (Successfully integrated all 19 passive and active Tech Tree modifiers across Phaser systems, Next.js Server Actions, shop gating, and resolve-raid Deno Edge Functions).
- [DONE] 7.0.5 — Implement expanded loadout system: equipment slots per squad member (Expanded individual squad loadouts by implementing persistent, individualized Weapons, Armor, and Utility slots, updating Next.js server actions, developing glassmorphic UI selectors, and simulating customized raider stats in Phaser.)
- [DONE] 7.0.6 — Implement squad member slots 2-4: Spawns 2–4 squad members dynamically in `RaidScene.ts` based on prep selections, integrated with camera tracking, dynamic in-game click-to-select, store-synced active indices, visual pulsing isometric selection rings, and a self-healing walkable-tile pathing fallback at starting entry points to prevent entity overlaps.
- [DONE] 7.0.7 — Implement raid abilities: Programmed the Medkit (targeted +40 HP heal with rising green cross particles), Breaching Charge (adjacent barricade destruction dealing 9999 dmg with orange blast waves and camera shake), and EMP Grenade (Chebyshev radius 1 turret disable for 6s with cyan electrical arc lines). Integrated pointers events interception inside Phaser and visual keybind hotkeys (Q, W, E) with feedback banners in the React HUD.
- [DONE] 7.0.8 — Implement multi-entry raids: split squad across 2+ entry points
- [DONE] 7.0.9 — Add 10+ new defense items gated behind tech tree nodes: Seeded 10 advanced defenses (Tesla Coil, Flame Vent, Laser Alarm, Heavy Autocannon, Patrol Drone, Guard Dog, Poison Trap, Gas Trap, Sound Alarm, and Decoy) into `supabase/seed.sql` with their `tech_tree_node` requirements, and integrated their operational stats into offline `DefenseAI.ts` and `TrapSystem.ts` simulation architectures.
- [DONE] 7.0.10 — Balance pass: defense values, raid difficulty, resource costs across all content

**Exit Criteria:** Player can invest tech points into branching specializations. Squad is customizable with gear and abilities. Raids have tactical depth with multiple entry points and abilities.

---

## Phase 8: Polish & MVP Launch Prep
**Goal:** The game feels finished. Onboarding is smooth. Performance is solid.

- [DONE] 8.0.1 — Art pass: replace ALL placeholder sprites with consistent final art. **Also folds in 1.0.19 (wall color picker) and 1.0.20 (floor type selector)**, which were deferred from Phase 1 pending real wall/floor sprites to customize.
- [DONE] 8.0.2 — Implement sound: background music (3 tracks), SFX (25+ sounds)
- [DONE] 8.0.3 — Implement `SoundManager.ts`: volume control, mute, contextual music switching
- [DONE] 8.0.4 — Onboarding flow polish: first-time user experience from register to first raid
- [DONE] 8.0.5 — Loading screen: branded, progress bar, tips/lore snippets
- [DONE] 8.0.6 — Performance audit: profile on low-end Android (budget phone), target 30fps minimum
- [DONE] 8.0.7 — PWA audit: Lighthouse score ≥90, offline functionality verified
- [DONE] 8.0.8 — Responsive design audit: test 320px–1440px widths
- [DONE] 8.0.9 — Security audit: RLS policies, Edge Function input validation, rate limiting
- [DONE] 8.0.10 — Accessibility pass: color contrast, font sizes, touch target sizes (48px min)
- [DONE] 8.0.11 — Error handling: graceful fallbacks, user-friendly error messages, Sentry coverage
- [DONE] 8.0.12 — Analytics: track key events (registration, first_raid, first_defense_placed, retention_d1/d7)
- [DONE] 8.0.13 — Create landing page (marketing): game description, screenshots, install CTA. Redesigned root page with glassmorphic Outfit typography, dynamic CTA session gates, generated gameplay mockups, and client-side PWA install controllers.
- [DONE] 8.0.14 — Write Terms of Service, Privacy Policy. Created `/terms` and `/privacy` Next.js sub-pages styled with clean cyber-retro aesthetics.
- [DONE] 8.0.15 — Beta test: invite 10-20 testers, collect feedback, iterate. Built a premium glassmorphic "Beta Operations Terminal" feedback dialogue overlay next to the TopBar's logout trigger. Attaches standard diagnostics (player level, path, resolution) and lets testers rate overall experience and write detailed bug/balance reports. Created backend server action `submitBetaFeedback` securely committing Sentry-telemetry events and Supabase database insertions. Applied RLS policies to database migrations.
- [DONE] 8.0.16 — Final bug fix sprint based on beta feedback. Implemented a highly robust auto-healing pipeline in Next.js `GameLayout` (`layout.tsx`) that transactionally auto-creates default inventories for users experiencing trigger race or signup latencies. Upgraded all `.single()` fetches on inventories, rooms, and profiles across `/room`, `/map`, and `/quests` page components to `.maybeSingle()`, preventing uncaught page crashes. Resolved pre-existing `react-hooks/set-state-in-effect` linting errors in `TopBar.tsx` using nested async IIFE wraps. Cleared `RaidScene.ts` compiler warnings by commenting out/removing unused constants (`SQUAD_MELEE_DAMAGE`, `DEFAULT_GRID_SIZE`). All checks compile cleanly with 0 typecheck and build errors.
- [DONE] 8.0.17 — Tech Debt: Refactor Next.js 16 middleware.ts to new proxy pattern. Renamed `src/middleware.ts` to `src/proxy.ts`, exporting public `proxy` function to satisfy Next.js 16 standards and clear Turbopack warnings.
- [DONE] 8.0.18 — Premium UI/UX Aesthetics & Animation Polish. Overhauled the React Room Editor drawer and cards with dedicated cyberpunk neon color schemes based on item type, integrated glowing Lucide icons (Target, Zap, Shield, Wrench) next to cards, and polished wall colors and floor materials preset buttons with glassmorphism and active rings. Implemented dynamic springy elastic Phaser animations in RoomScene: staggered cyber-pop cascade on room load, elastic squeeze placement pop, horizontal squash rotation, and shrink/spin-away removal before destruction.
- [DONE] 8.0.19 — Database Security & Relationship Hardening. Created migration 00016 enabling RLS INSERT policies on profiles so new users can auto-heal/create their own profiles, resolving foreign-key constraint violations on inventories and squad slots. Refactored raid_history(player_id) foreign key to reference profiles(id) directly instead of auth.users(id), which perfectly aligns PostgREST schema relationship caches and squashes 400 Bad Request query errors.
- [DONE] 8.0.20 — Passive Zoom, PWA SW Evaluation & Edge Function Synchronization. Bound imperative passive-safe zoom event listener to viewportRef, converted sw.js to valid vanilla JavaScript, and deployed all 5 Deno Edge Functions remote-side.

**Exit Criteria:** Game is publicly shippable. Smooth onboarding, consistent art, sound, solid performance on mobile, security hardened, analytics tracking, premium UI/UX feel, and schema alignment.

---

## Phase 9: Post-Launch Expansion (v0.6)
**Goal:** Geolocation integrations, regional Mapbox maps, and advanced social systems.

- [DONE] 9.0.1 — Geo-located map via Mapbox GL JS integration. Expanded map dashboards with a third navigation Compass tab, dynamic client-side Mapbox GL loaders with GPS lat/lng offset scattering, and a full interactive HTML5 Canvas Radar sonar sweep fallback when keys are missing, maintaining exact dialog overlays and raid integrations.
- [DONE] 9.0.2 — Real-time PvP breach coordination loop. Setup Supabase Realtime Broadcast Channels inside RaidScene.ts and BaseDefenseMonitor.tsx. Implemented live holographic blips mapping, active defender stuns, overcharged turrets, sentinel drone spawns, active guard drone AI tickers, simulated offline agents, and a self-contained local Sandbox breach simulator.
- [DONE] 9.0.8 — Interactive Global Recon Map Chat. Ephemeral real-time chat running via Supabase Broadcast channel. Side-by-side desktop layout, mobile Sheet drawer, and clickable coordinates to swoop map cameras.
- [DONE] 9.0.12 — Cooperative Stronghold Districts. Created migration 00017 and RPC scripts for districts. visual 3x3 stronghold block page route with shared boundary conduits. Deducts plundered overflow proportionally in resolve-raid Deno Edge Function.
- [DONE] 9.0.15 — Clan Banks & Shared District Vaults. Migrations 00018 (vault tables + RLS + auto-vault trigger), 00019 (notification INSERT policy), 00020 (transactional deposit/withdraw procedures with row-level locks and daily cap enforcement). Server Actions `depositToVault` and `withdrawFromVault` in `vault.ts` with automatic system-alert notifications on withdrawal events. Integrated glassmorphic Treasury dashboard into `/map/district` featuring vault balance cards, interactive deposit/withdrawal form with resource slider, daily cap progress meter, and live monospace transaction ledger.
- [DONE] 9.0.21 — Joint Raids (2-4 Player Cooperative Raids). Created database schema migration 00021 establishing public `joint_raid_lobbies` and `joint_raid_participants` tables with row-level security (RLS) rules and automated cleanups. Created server actions `createJointRaidLobby`, `joinJointRaidLobby`, `readyUpForJointRaid`, `launchJointRaid`, `cancelJointRaidLobby`, and `leaveJointRaidLobby` inside `joint-raid.ts` server actions. Formulated the client-side state hooks inside `useRaidStore.ts` tracking joint raid statuses. Devised a fully responsive glassmorphic lobby UI, `JointRaidLobby.tsx`, embedded into the districts console above the treasury displaying ready status, stat pooling summaries (+50 HP / +10 Damage per member), and a live operation monitoring terminal for observing allies powered by Supabase Broadcast channels. Expanded `RaidPrepContainer.tsx`, `RaidScene.ts` and `RaidResolver.tsx` to apply stat boosts to spawned squads, broadcast live action telemetry feeds, and trigger split rewards inside Deno edge functions where base loot and XP are divided evenly among participants and individually processed with active tech tree multipliers.
- [DONE] 9.0.24 — Expanded Room Sizes: full apartment/house. Created a database migration mapping sizes to room upgrade tiers. Configured base upgrade panel with a tabbed Stronghold and Grid Sizing upgrade HUD. Enabled Phaser coordinate transformations and camera zoom auto-scaling to dynamically support grid sizes up to 18x18, preserving isometric z-sorting, pathfinding, wall boundaries, and item validation checks seamlessly.
- [DONE] 4.0.13 — Player Level-Up Polish (Milestone 4L). Created useUIStore state triggers, a fullscreen glassmorphic `<LevelUpOverlay />` that maps unlocking defenses/furniture blueprints dynamically from the catalog, tracks systemic milestones (Level 3 secondary traps, Level 5 PvP matchmaking, Level 8 Tech tree, Level 10 second squad slot, etc.), registers Sentry telemetry analytics breadcrumbs, and hooks into scrap upgrades, quests, and raid resolvers securely.
- [DONE] 9.0.27 — Community Event Framework. Created migrations `00026_community_events.sql` establishing tables, seeded active blackout events, created app server actions to pull events and log contributions, built dynamic blinking `<CommunityEventBanner />` components, procedurally adjusted Phaser image/tile tints (`0x222233`) and camera edge fog bounds under sector blackouts, injected 20% random jam skips and spark VFX inside `RaidScene.ts`, and doubled combat rewards autoritatively in edge resolutions.
- [DONE] 9.0.28 — District / Territory Control System. Built database migration `00027_district_territory.sql` mapping grid outposts on a 19-hex board, established RLS and transactional pg procedures (`record_skirmish_and_update_influence`, `distribute_territory_dividends`) for secure tug-of-war influence offsets and passive daily resource rewards. Authored server actions for coordinates fetching and raid simulation results, built responsive interactive hex-grid SVG map boards with Selection rings and live influence meters, and deployed central tabbed `<DistrictDashboard>` war-rooms embedded inside the district page grids.
- [DONE] 9.0.29 — Achievement System with Cosmetic Rewards (Milestone 9L). Created database schema migration `00028_achievements.sql` establishing catalog and progress tables, profile cosmetics slots, and spent tracking metrics. Authored secure Server Actions `getAchievementsAction` and `equipCosmeticAction` with locks validation. Developed the server-authoritative `recordScrapSpend` helper and injected hooks into all room actions. Built a stunning glassmorphic Trophy Room tab panel in the Squad dashboard, rendering live squad slots wrapped in custom animated pulsing neon-green glowing borders. Formulated procedural `floor_neon_glitch` tile preloading in Phaser `BootScene.ts` and automated floor tile overrides in `RoomScene.ts` when equipped. Verified local Supabase database reset, clean linter outputs, and Next.js Turbopack production builds with 0 errors.
- [DONE] 9.0.30 — Trading System between Players (Milestone 9M). Created database schema migration 00029 establishing trade_offers and trade_items with Row-Level Security (RLS). Implemented secure plpgsql transaction procedures (propose_trade, accept_trade, withdraw_trade, decline_trade) with FOR UPDATE row locks. Developed Next.js Server Actions and a glassmorphic Trading Terminal sub-panel embedded in the Social panel.

## Phase 10: Automated Testing & Continuous Integration (v0.7)
**Goal:** High-fidelity automated test coverage for core systems and user flow paths.

- [DONE] 10.0.1 — Establish TypeScript-native unit test suite for game systems. Configured `vitest.config.ts` mapping path aliases and created tests verifying pure isometric transformations (`IsometricEngine.test.ts`) and A* pathfinding obstacles navigation (`GridSystem.test.ts`).
- [DONE] 10.0.2 — Establish automated E2E browser integration tests. Configured `playwright.config.ts` running Chromium and verified landing, registration, and login screens rendering and redirects (`auth.spec.ts` and `navigation.spec.ts`).
- [DONE] 10.0.3 — Configure test script execution endpoints. Added `"test": "vitest run"` and `"test:e2e": "playwright test"` to `package.json` for easy dev/CI orchestration.
- [DONE] 10.0.4 — Expand Core Game Unit Tests. Implemented comprehensive TypeScript-native unit test suites under `tests/game/` for `CombatSystem.test.ts` (HP tracking, damage, healing, destructible barricades), `TrapSystem.test.ts` (trap triggers, stun states, uses, and active store multipliers), `DefenseAI.test.ts` (turret Chebyshev ranges, reload tickers, alert buffs, and active event penalties), and `BossAI.test.ts` (phase shift triggers, enrage abilities, and GridSystem-based movement AI). Verified 100% test completion and clean linter outputs.

## Future Phases (Post-Launch Backlog)

- [x] Clan system: creation, management, clan bank, clan chat
- [x] Joint raids: 2-4 player cooperative raids
- [x] Seasonal battle pass framework: Designed and created the seasonal battle pass database schema, including battle_pass_tiers, player_battle_pass_progress, and battle_pass_rewards. Wrote secure atomic Postgres database functions for XP progression, reward claiming, skipped tiers, and premium pass unlocking. Integrated the battle pass XP awards dynamically inside the resolve-raid and process-quest Deno Edge Functions. Built a gorgeous glassmorphic reward track progress dashboard in /battle-pass and integrated it into /squad and the TopBar header.
- [x] Real-time PvP mode (WebSocket-based): Integrated Supabase Broadcast channel telemetry sync, active defender drone dispatches, overcharge turret boosts, door lockdown stuns, and active intruder path markers in RoomScene.
- [x] Chat system (text): global, friends, clan channels: Developed high-fidelity, translucent glassmorphic multi-channel ChatConsole client component with dynamic tabs (Global, cooperative District, and private deterministic Friend-to-Friend DM scoping). Mounted inside page grids and globally in the game layout shell as a floating collapsible drawer.
- [x] Custom image uploads for wall posters (with moderation pipeline)
- [x] Expanded room sizes: full apartment/house
- [x] Community event framework: Scheduled global server-instanced operations (e.g. sector blackout, turret malfunction) with blinking banners, real-time Phaser adjustments, and double rewards.
- [x] District/territory control system (clan-based): Hex-grid regional outposts where districts fight over shared resources via interactive SVG map selectors and authoritative PostgreSQL tug-of-war procedures.
- [x] Achievement system with cosmetic rewards
- [x] Trading system between players
- [x] Cybernetic Screen Tearing & Glitch Decals: Implement high-fidelity dynamic visual room/raid disruptions (horizontal canvas tearing for custom posters, volumetric coordinate jitter for rotating holographic trophies, delta-based decay loops, and live event triggers like traps, turrets, defense destruction, and blackout floors) verified by 15 dedicated unit tests.
```
```

## Original Planning doc: docs/Planning.md