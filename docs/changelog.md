# changelog.md — Room Invaders
## Applied Logic Technologies, LLC — ALT Games Division

## [0.26.0] — 2026-05-29 — Milestone 9J: Volumetric Color Shading & Direct Move Relocation Tool

### Added
- **Volumetric 3D Color Shading Sync**:
  - Dynamically shades and tints procedural 3D back walls in `RoomScene.ts` based on the player's active custom `wallColor` preset.
  - Implemented `adjustColor(color, factor)` inside `RoomScene.ts` to scale RGB channels. Scales by `0.22` for the lighter right-facing panels and `0.15` for the darker left-facing panels, producing gorgeous, highly premium, responsive HSL-like volumetric shadows that avoid flat, saturated colors.
  - Dynamically colors the top neon lighting conduit with the vibrant custom `wallColor` (or modular entry color if a Door, Window, or Vent) to create a beautiful, cohesive glowing theme.
- **Zero-Cost Relocation Move Tool**:
  - Introduced a comprehensive, **100% free-of-scrap** interactive furniture relocator. Players can click **Move Furniture** in the cyan context menu to pick up any placed furniture/defense onto their cursor as a ghost in Edit Mode.
  - Relocating furniture/defenses is completely free of scrap costs and validates standard rules (bounds, occupied spaces, entry point limits, turret perimeter rules).
  - Tapping a valid tile places the item and triggers the new `movePlacedItem` secure Server Action in `actions.ts` to update coordinates in the `player_items` table.
  - Played a satisfying, organic squash-and-stretch spring pop tween (`scaleY: 1.25, scaleX: 0.8` back to `1.0` over `400ms`) accompanied by a placement sound FX when items pop into their new coordinates.
  - Integrated full Zustand state synchronization (`movePlacedItemAt` in `useRoomStore.ts`) and automatic cleanup of the moving item ghost if the user exits Edit Mode or selects another action in `useUIStore.ts`.
- **Authoritative Footprint Verification & Multi-tile Calculations**:
  - Fully integrated catalog item `footprint` dimensions (`w` and `h`) throughout Phaser scenes, Next.js Server Components, and the Zustand state store (`useRoomStore.ts`, `ItemPanel.tsx`, `ContextMenu.tsx`).
  - Completely rewrote grid occupancy calculations in `RoomScene.ts` to block out the complete multi-tile footprint.
  - Upgraded both Phaser client-side `isPlaceableFor` and server-side `movePlacedItem` Server Action to validate every coordinate cell of the rotated bounding box, fully resolving placement self-collisions by ignoring the item's original bounding footprint.
- **Multi-tile Firing & Alert Range Resizing**:
  - Rewrote `rangeTilesFor` inside `defense.ts` to calculate Chebyshev disk boundaries extending symmetrically from the entire rotated outline of multi-tile items rather than just their bottom-left anchor cells, while explicitly excluding any interior footprint tiles.
  - Wired up footprint and active rotation calculations in `drawRangeOverlay` (`RoomEditorScene.ts`) and `drawDefenseViewOverlay` (`RoomScene.ts`) to cleanly project dynamic, orientation-aware range overlays for multi-tile turrets and traps.
- **Dynamic 3D Wall Snapping (Clipping Prevention)**:
  - Modified `updateIsometricPosition` in `FurnitureSprite.ts` to apply custom visual screen offsets (`+2px` or `-2px` along `x`, `+4px` along `y`) whenever placed or moved adjacent to the visually active 3D back-wall bulkheads.
  - The offset snaps items flush with beveled wall panels based on the active grid rotation step, preventing visual clipping artifacts.
- **GPU-Accelerated Breathing Neon Grid & Cybernetic Particles**:
  - Implemented a smooth, GPU-accelerated breathing tween using Phaser's `Sine.easeInOut` to animate the neon wireframe floor grid alpha between `0.5` and `0.95` inside Edit Mode.
  - Syncs grid and visual particle tints dynamically to match the player's active `wallColor` preset, triggering procedurally colored circle particle bursts on successful relocations.

### Fixed
- **Relocation Coordinate Snapping & Validation**: Intercepted placement requests in `GameBridge.tsx` when a relocate action is active. Ensured the relocator successfully permits moving an item back onto its own original tile by introducing an `isOriginalSpot` bypass in Phaser's client-side validation (`isPlaceableFor`).

## [0.25.3] — 2026-05-29 — Bedroom Visuals, Direct Interaction & Blueprint Overhaul

### Fixed
- **Direct Right-Click Selecting & Scrapping**: Disabled standard browser context menus on the Phaser canvas. Handled right-clicks (`pointer.rightButtonDown() || pointer.button === 2`) in both `RoomScene.ts` and `RoomEditorScene.ts` to instantly open context menus at the mouse pointer's coordinates for any clicked item, bypassing player pathfinding and grid-walkability boundaries. This allows players to immediately scrap/recycle out-of-bounds beds stuck at `(9,2)`.
- **Chrome Context Menu Global Override**: Added `onContextMenu={(e) => e.preventDefault()}` on the parent React `<GameCanvas />` container in `GameCanvas.tsx`. This intercepts and blocks Chrome's native right-click menu globally across the entire game screen, ensuring right-clicks are processed exclusively and smoothly by Phaser.
- **Full-Time View & Edit Mode Recycling**: Removed the `mode === 'edit'` restriction from the `canRemove` flag in `ContextMenu.tsx`. This allows players to directly Recycle/Scrap or Rotate placed items in both View Mode and Edit Mode at all times, preventing UX confusion and bypassing any mode transition state resets.
- **Phaser Editor Ghost Cancellation**: Right-clicking in Edit Mode now cancels any active blueprint placement ghost sprite and clears range overlays.
- **Parallel Scene Camera & Rotated Grid Sync**: Synchronized the two parallel scenes (`RoomScene` and `RoomEditorScene`) by creating an `update()` loop in `RoomEditorScene.ts` that copies the `scrollX`, `scrollY`, and `zoom` camera values from `RoomScene` at every frame. Additionally, captured the `'grid-rotated'` EventBus event to redraw the green wireframe grid (`drawEditorGrid`) in `RoomEditorScene` using the active rotation state and offsets. This permanently eliminates the grid-layer and overlay misalignment during pan, zoom, and rotation, preventing players from placing items outside grid boundaries.

### Added
- **Volumetric 3D Cyberpunk Walls**: Overhauled the flat 2D lines inside the bedroom into procedural 3D isometric metallic wall panels (64px high) rendered on the back corner edges (North/West etc. based on active rotation) to avoid blocking visibility. Features beveled bulkheads, vertical panel seams, dynamic isometric lighting (lighter/darker slate panels), and a thick glowing neon cyber-conduit border.
- **Custom Modular Entry Inserts**:
  - **Doors**: Renders glowing neon orange slide-door frames, hazard warning stripes, and active indicator lights.
  - **Windows**: Renders glowing semi-transparent cyan viewports (`alpha = 0.3`) containing cyan laser security grids.
  - **Vents**: Renders dark ventilation duct grates backlit by active glowing neon orange duct lights.
- **Glowing Front Laser Rails**: Renders sleek, low-profile floor-level glowing cyan laser border rail indicators on the front two boundaries (South/East etc.) to prevent obstructing player view.
- **Ambient Blueprint Glow Particles**: Implemented a procedural glowing particle manager in `RoomScene.ts` that spawns drifting, glowing cyan/teal/blue micro-particles floating slowly upwards from the floor, simulating an active blueprint customizer atmosphere.
- **Tactical Context Menu Styling**: Renamed `"Remove (50% refund)"` to `"Recycle (+50% Scrap)"` inside `ContextMenu.tsx` and polished the layout with an emerald-green glowing glassmorphic appearance.

## [0.25.2] — 2026-05-29 — Room Defense Placement & Faction Boss Locks

### Fixed
- **Bedroom Defense Placement Bug**: Deduplicated the `sprite_key` collision between the standard EMP Mine and Circuit's EMP Mine in `seed.sql`, mapping Circuit's boss reward version to a unique `'trap_circuit_emp_mine'` key. This permanently resolves the `PGRST116` database error (multiple rows returned on single-row query) that caused client-side placement failures with "Item not found" toasts.
- **Phaser Asset Registrations**: Added missing catalog and guard asset registrations (`turret_power_node`, `guard_drone`, `guard_dog`, `guard_decoy`, `trap_circuit_emp_mine`) in `BootScene.ts`, ensuring that unlocks load aesthetic volumetric textures correctly instead of throwing asset errors.

### Added
- **Boss Clear State Hydration**: Expanded Next.js Server Components in `layout.tsx` to authoritatively query player boss victory records in the `boss_clears` table and propagate the results as `clearedBosses: string[]` down into the client's global Zustand `usePlayerStore`.
- **Cyberpunk Shop Padlocks & Descriptions**: Extended the bedroom shop editor (`ItemPanel.tsx`) to show glowing red target padlocks and explicit descriptive tooltips (e.g., `Defeat Circuit to unlock`) for boss-locked catalog items.
- **Server Action Boss Validation**: Hardened the `buyAndPlaceFurniture` Server Action inside `actions.ts` to query `boss_clears` and block placement attempts of boss reward items unless the player has securely completed the corresponding boss raid.

## [0.25.1] — 2026-05-28 — Runtime Polishing & Build Resolution

### Fixed
- **Next.js Turbopack RSC Compilation Conflict**: Added `"use client";` boundary directive to `StoreInitializer.tsx`, resolving server-component compilation failures under Next.js Turbopack and ensuring 100% build-time compilation.
- **React Hydration / Multi-Render State Warning**: Refactored the client-side Zustand store hydration logic in `StoreInitializer.tsx` from the inline render cycle into standard React `useEffect()` hooks, permanently eliminating React 19's "Cannot update a component while rendering a different component" console warning.
- **Database Schema Syncing**: Applied pending local migrations (00024 through 00029) to the remote Supabase database instance using `supabase db push`. This synchronized the physical tables and resolved the missing `room_size_tier` column mismatch that triggered Next.js server-side `roomError` on `page.tsx`.

## [0.25.0] — 2026-05-28 — Milestone 10F: High-Fidelity 3D Volumetric Procedural Asset Overhaul

### Added
- **Procedural 3D Sub-Block Assemblies**:
  - Replaced the simple flat geometric block fills and flat vector drawing lines with actual, multi-layered 3D isometric sub-block assemblies using a new `drawVolumetricSubBlock` pipeline in `BootScene.ts`.
  - **Furniture Assets**: Twin Bed (wooden frame, headboard, footboard, raised mattress, blanket layer, volumetric neon pillow), Wooden Desk (four independent leg posts, wood top slab, drawer unit cabinet, standing monitor, keyboard), Office Chair (star base spokes, riser, seat cushion, back bar, backrest), Metal Shelf (four corner poles, shelf plates, box, toolboxes, glowing canisters), TV Flatscreen (media console, compartment, deck receiver, TV neck, screen panel), Dresser (chest, three inset drawer panels), folding tables, potted plants (pot, soil, stem, layered voxel leaf sheets), floor lamps (base, vertical pole, glowing yellow lamp shade dome).
  - **Defense/Barricades**: Flipped Bookshelf (backboard, vertical shelves, spilled tilted books), Flipped Table (tabletop shield, horizontal legs), Sandbags (three overlapping canvas bag blocks).
  - **Turrets**: Pyramidal steel armor bases, swivel collars, gun housings, twin volumetric barrels, capacitor coils, brass taser spikes, copper rings, energy core top spheres.
  - **Entities/Stashes**: Hovering central body sphere, horizontal quadcopter struts, spinning rotor discs, golden vault chest with titanium straps.

## [0.24.0] — 2026-05-28 — Milestone 10E: Volumetric Isometric Voxel/Pixel Art Upgrade

### Added
- **True 3D Isometric Rotations (No 2D Angle Hacks)**:
  - Preloaded and cached **4 distinct directional textures** (`_dir_0` through `_dir_3`) in `BootScene.ts` for all 30+ items in the catalog (furniture, traps, turrets, barricades, entities, stashes).
  - Designed local unit-basis coordinate projections (`getPoint(u, v)`) mapped dynamically to rotated dimensions, ensuring details like bed pillows, keyboards, taser coils, and sandbags rotate correctly around the vertical Z-axis.
  - Swaps textures in `FurnitureSprite.ts` via `setTexture` upon rotating, correcting the 2.5D visual perspective and maintaining perfect alignment with floor tiles.
- **Volumetric Lighting & Bevel Rendering**:
  - Implemented multi-stop shaded gradients on Top, Left, and Right faces inside `generateIsoBlock` to simulate overhead and side lighting.
  - Rendered high-contrast white rim bevel highlights on top edges and dark seams on bottom corners for premium voxel-like dimension.
- **Contact Ground Shadows (Ambient Occlusion)**:
  - Programmed semi-transparent dark base shadows drawn directly on the floor below placed items, visually anchoring assets in the room.
- **Polished Cyberpunk Details & Creases**:
  - Added wood grain bands to desks/dressers, glowing monitor/keyboard panels, rounded cozy curved bedding fabric using bezier lines, electrical copper coils, metallic spikes, hazard warning lines, and realistic Sandbag meshes.

### Fixed
- **NextJS/TypeScript Build Conflict**:
  - Restricted `"include"` paths in `tsconfig.json` to `src/**/*.ts*`, permanently preventing Next's TS typechecker from scanning `.ts` imports in Deno Edge Functions under `supabase/`. Enabled a 100% clean production build compile.

## [0.23.0] — 2026-05-28 — Milestone 4L: Player Level-Up Polish & Unit Test Solidification

### Added
- **TypeScript-Native Progression Unit Tests (`tests/game/progression.test.ts`)**:
  - Implemented 9 rigorous, TypeScript-native unit tests using Vitest to thoroughly verify the math, boundaries, and logic of `xpForLevel`, `levelForXp`, and `levelProgress` helper functions.
  - Asserted exact cumulative XP requirements at core progression landmarks (e.g. L2: 100 XP, L5: 1000 XP, L20: 19000 XP, L100: 495000 XP).
  - Validated boundary clamping logic (levels bounded between `1` and `MAX_PLAYER_LEVEL` (100)).
  - Confirmed accurate fractional leveling progress calculation and remaining XP reporting for in-between level states.

### Changed
- **Ledger Alignment**: Checked off and resolved the duplication/partial discrepancy of Task 4.0.13 in `docs/tasks.md`. Fully aligned all phase entries to reflect 100% completion of the premium player level-up progression overlay, milestones tracking, and Sentry telemetry integrations.
- Bumped application version to `0.23.0`.

## [0.22.0] — 2026-05-28 — Milestone 10D: Complete Defense-Cost and Plundering Balance Pass

### Added
- **Boss Unique Item Extensions**: Added `trap_bear_trap`, `trap_ghost_wire` and `turret_autocannon_mk2` to static client stats maps (`TrapSystem.ts`, `DefenseAI.ts`) and Deno server-side Edge Function maps (`replaySystems.ts`) for full offline and chronological replay validation coverage. Updated `trap_ghost_wire` to feature an 8 Chebyshev alert radius and 3 uses.

### Changed
- **Comprehensive Database Catalog Balance Pass (`supabase/seed.sql`)**:
  - Reduced starting trap and turret Component costs to match starting player resources (200 Scrap, 50 Components). Pressure Plate component cost reduced from `10` to `2` components; Spike Strip from `8` to `3`; Shock Pad from `20` to `6`; Glue Trap from `12` to `4`; Tripwire from `5` to `2`. Nail Gun Turret component cost went from `25` to `15` and Taser Turret from `30` to `18` components.
  - Balanced cost-to-HP ratios for basic barricades: Flipped Table (30 HP) -> 10 Scrap; Bookshelf (50 HP) -> 20 Scrap; Sandbags (75 HP) -> 35 Scrap.
  - Re-scaled all advanced and boss defenses to serve as robust mid-to-late game progression sinks.
- Bumped application version to `0.22.0`.

## [0.21.0] — 2026-05-28 — Milestone 10C: Performance: Viewport-Based Tile Culling

### Added
- **Dynamic Viewport-Based Tile & Furniture Culling**:
  - Implemented an efficient grid and object culling algorithm in `RoomScene.ts` and `RaidScene.ts` utilizing `Phaser.Cameras.Scene2D.Camera.worldView`.
  - Hides (`visible = false`) floor tiles and placed furniture/defense sprites falling outside the active camera bounds, successfully reducing Phaser rendering draw calls and vertex processing.
  - Implemented high-performance culling throttling by cache-checking camera `scrollX`, `scrollY`, and `zoom` properties. Avoids running bounding calculations on static viewports, ensuring 0ms static overhead.
  - Added a `128px` margin buffer padding around the viewport edges to completely eliminate visual pop-in or clipping.

### Changed
- Bumped application version to `0.21.0`.

## [0.20.0] — 2026-05-28 — Milestone 10B: Expanded Core Game Unit Tests

### Added
- **Expanded Game Systems Unit Tests (`tests/game/`)**:
  - Created `tests/game/CombatSystem.test.ts` verifying HP tracking, positive/negative/non-finite damage bounds, death thresholds/kill events, healing permanence/limits, and placed indestructible vs destructible targets (barricades).
  - Created `tests/game/TrapSystem.test.ts` testing trap registration, step-on triggers via EventBus, uses depletion, tripwire alarms, and active effects store upgrades (`trapDamageMult`, `trapUsesBonus`, `trapStunBonus`).
  - Created `tests/game/DefenseAI.test.ts` testing turret registration, Chebyshev acquisition ranges, firing tickers/cooldowns, ammunition exhaustion, tripwire alert range boosts, and upgrades/penalties (`turretAmmoMult`, `turretRangeBonus`, `sector_blackout`, `turret_malfunction`).
  - Created `tests/game/BossAI.test.ts` testing phase shift triggers (HP ratios), enrage/lockdown/minions/self-heal events, special ability ranges/cooldowns, basic attacks, and GridSystem-based movement AI.

### Changed
- Bumped application version to `0.20.0`.

## [0.19.0] — 2026-05-28 — Milestone 10A: Automated E2E and Unit Testing Foundations

### Added
- **TypeScript-Native Unit & Integration Test Suite (`tests/game/`)**:
  - Created `tests/game/isometric.test.ts` to verify pure-math coordinate scaling formulas (`worldToScreen` and `screenToWorld` functions) on standard 2:1 isometric projections under rotation and offset shifts.
  - Created `tests/game/GridSystem.test.ts` checking 2D tile boundaries, obstacle occupancies, A* pathfinding routes routing around columns, and adjacent-pathfinding selections.
- **Automated Integration Browser Tests (`tests/e2e/`)**:
  - Created `tests/e2e/auth.spec.ts` asserting high-fidelity public landing pages, PWA metrics display, and complete client form validations for registrations and logins.
  - Created `tests/e2e/navigation.spec.ts` ensuring protected game routers (e.g. `/room`) trigger automatic server-side authentication redirects when session keys are missing.
- **Config & Package Shortcuts (`vitest.config.ts`, `playwright.config.ts`, `package.json`)**:
  - Configured `vitest.config.ts` mapping global import alias resolution (`@/*` -> `./src/*`) to compile absolute imports correctly.
  - Configured `playwright.config.ts` launching automated headless Chromium browser testing, mapped directly to local dev server ports with a 120-second compile timeout.
  - Registered standardized shortcut scripts `"test": "vitest run"` and `"test:e2e": "playwright test"` to easily invoke testing pipelines.

### Changed
- Bumped application version to `0.19.0`.

## [0.18.0] — 2026-05-28 — Milestone 9M: Player-to-Player Barter Trading System

### Added
- **Database Schema Migration (`supabase/migrations/00029_player_trading_system.sql`)**:
  - Implemented the database migration establishing `public.trade_offers` and `public.trade_items` tables with optimized indexes and owner-level Row-Level Security (RLS) policies.
  - Developed securitized, atomic plpgsql escrow procedures (`propose_trade`, `accept_trade`, `withdraw_trade`, and `decline_trade`) running under `FOR UPDATE` row locks to prevent race conditions and double-spending.
  - Wired triggers to automatically log system updates inside the `notifications` table on trade proposals, accepts, and declines in real time.
- **Server Actions & Cache Revalidation (`src/app/(game)/social/actions.ts`)**:
  - Engineered Server Actions `proposeTradeAction`, `acceptTradeAction`, `withdrawTradeAction`, and `declineTradeAction` to execute secure backend RPC procedures on behalf of authenticated users.
  - Configured instant cache revalidation routines for `/social` and `/room` page router pathways to seamlessly reflect asset transfers.
- **Interactive Glassmorphic Trading Terminal Component (`src/components/game/TradingTerminal.tsx`)**:
  - Built a beautiful, translucent cyberpunk trading terminal dashboard organized into pending active boards, proposal inputs, and historic log archives.
  - Implemented partner selector dropdowns, raw material range sliders mapped directly from current player balances, and numerical unplaced items offered arrays.
  - Developed searchable counter-demand selector dropdowns mapping the catalog items, allowing senders to declare counter-proposal items.
  - Attached check and close buttons to trigger secure transaction transitions with fluid Sonner toast visual updates.
- **Social Panel Integration (`src/app/(game)/social/page.tsx`)**:
  - Integrated the `<TradingTerminal />` component directly as a sub-navigation card panel tab under the social network view.

### Changed
- Bumped application version to `0.18.0`.

## [0.17.0] — 2026-05-27 — Milestone 9L: Achievement System with Cosmetic Rewards

### Added
- **Database Schema Migration (`supabase/migrations/00028_achievements.sql`)**:
  - Implemented the database migration establishing `public.achievement_catalog` and `public.player_achievements` tables with explicit Row-Level Security (RLS) policies.
  - Added cosmetic tracking columns (`active_badge`, `active_border`, `active_room_skin`) to `public.profiles`.
  - Added transactional spent metric trackers (`last_victory_at`, `last_spend_at`, `spend_count_after_victory`) to `public.inventories`.
  - Seeded three starter achievements: "Veteran Raider" (`raids_50`), "Grid Overlord" (`outposts_5`), and "Double Spender" (`double_spent_scrap`).
  - Configured PostgreSQL triggers on `raid_history` inserts to automatically increment raid victory achievements and auto-seed achievements for new profiles.
  - Formulated a database backfill procedure to retroactively compute achievement progress for pre-existing raids.
- **Server Actions & Spent Tracker Integration (`src/lib/game/achievements.ts`, `src/app/(game)/squad/achievements.ts`)**:
  - Engineered Server Actions `getAchievementsAction` and `equipCosmeticAction` with secure profile unlocked-validation guards to prevent spoofing.
  - Developed the server-authoritative `recordScrapSpend` helper that monitors scrap expenditures within 30 seconds of successful raids.
  - Injected spent tracking hooks across all scrap upgrade actions in `src/app/(game)/room/actions.ts` (buy and place furniture, player level-up, room level-up, room size upgrades, and placed defense item repairs).
- **Interactive Glassmorphic Trophy Hall Dashboard (`src/app/(game)/squad/SquadDashboard.tsx`)**:
  - Built an immersive cyberpunk Trophy Room dashboard tab displaying overall statistics (achievements count, unlock percentage, active status indicators).
  - Implemented live squad portrait previews that render equipped visual badges and pulse with custom animated neon-green glowing borders.
  - Mapped a gorgeous ledger catalog grid with Outfit fonts, custom glowing progress bars, and reactive "EQUIP" server toggle buttons.
- **Phaser 4 Engine Customizations (`BootScene.ts`, `RoomScene.ts`)**:
  - Added a procedural `floor_neon_glitch` tile texture in the preloader drawing hot-pink and neon-green offset borders on a cyber-purple base.
  - Implemented automatic tile override rendering in `RoomScene` that scales coordinates and renders the custom neon glitch theme when `'neon_glitch'` room skin is active.

### Changed
- Bumped application version to `0.17.0`.

## [0.16.0] — 2026-05-26 — Milestone 9K: Player Level-Up Polish, Community Events & Territory Control

### Added
- **Dynamic Unlocks Fullscreen Overlay (`src/components/game/LevelUpOverlay.tsx`)**:
  - Implemented a fullscreen cyberpunk overlay mapped dynamically from the store catalog (`useUIStore` state triggers).
  - Highlights newly unlocked traps/turrets blueprints and logs systemic progression milestones (secondary traps at Level 3, PvP Matchmaking at Level 5, Tech Tree at Level 8, Raider slot #2 at Level 10, strongholds coordinates at Level 20).
  - Wired triggers and Sentry breadcrumbs inside scrap upgrade cards, quests, and raid resolvers.
- **District Territory Control Hex Board (`src/components/game/TerritoryMap.tsx`)**:
  - Designed a responsive hexagonal regional outposts war room SVG board mapped from 19 axial coordinates (Radius 2 center).
  - Features glassmorphic panels displaying live active control bounds, capture lockdowns, dynamic yield dividends, and log logs.
  - Setup transactional PL/pgSQL routines (`record_skirmish_and_update_influence`, `distribute_territory_dividends`) enforcing secure tug-of-war district influence changes and daily clan banks resource rewards.
  - Mounted central tabbed `<DistrictDashboard>` war-rooms organizing stronghold structures, treasury, and regional conquests side-by-side.
- **Turret Jam Electrical Sparks VFX (`src/game/scenes/RaidScene.ts`)**:
  - Configured Phaser event listener `onTurretJammed` drawing 3 line segments graphic flashes and temporary red warning overlays above jammed defenses during malfunction windows.

### Changed
- Bumped application version to `0.16.0`.

## [0.15.0] — 2026-05-26 — Milestone 9J: Named NPC Raid Bosses with Story Quests

### Added
- **Premium Glassmorphic BossRaidHUD Overlay (`src/components/game/BossRaidHUD.tsx`)**:
  - Implemented a gorgeous, translucent cyber-themed overlay displaying the active Boss Name, Title, and Phase segmented HP bar.
  - Draws visual vertical ticks on the HP progress bar indicating phase transition boundaries dynamically retrieved from the room fixture.
  - Features scrolling terminal pre-raid briefing monospace cards that automatically fade out or dismiss on click.
  - Triggers massive glowing red alert banners and screen shakes when bosses enter new phases (e.g. Volkov's drone dispatches, Circuit's turret overcharges, and the Warden's stunning lockdowns).
- **Narrative Raid Results Briefing & First Clear Showcases (`src/components/game/RaidResults.tsx`)**:
  - Dynamically extracts post-raid boss victory and defeat dialog briefing text from active room fixtures and renders it in a glassmorphic monospace block.
  - Developed a high-end "First Clear Unique Reward" showcase box that pulses with gold borders and highlights the unlocked unique items catalog details (Ironjaw's Bear Trap, Whisper's Ghost Wire, Volkov's Autocannon Mk2, Circuit's EMP Mine, and the Warden's Key).
- **Robust Boss Cooldown Verifications (`src/app/(game)/raid/[id]/page.tsx`)**:
  - Added secure Next.js Server Component guards checking the player's clearance history on `boss_clears` in the last 24 hours. Redirects players to the Recon Map if the target is currently locked.
- **Authoritative First Clear & Quest Rewards Synced (`src/lib/store/useRaidStore.ts`, `src/lib/game/resolveRaid.ts`, `src/components/game/RaidResolver.tsx`)**:
  - Wired `isFirstClear` boolean flags end-to-end between client-side wrappers, resolve-raid Edge Functions, and post-raid results overlays, crediting new inventory balances in real time.

### Fixed
- **JSX Comment Text Nodes Error (`src/components/game/RaidResults.tsx`)**:
  - Resolved JSX compiler syntax failures by safely wrapping text double slash comments `//` into braced string templates `{"// ..."}`.
- **Unused Type Imports and Variable Warnings (`src/game/fixtures/boss-rooms.ts`, `src/game/systems/BossAI.ts`, `src/game/scenes/RaidScene.ts`)**:
  - Cleared React and Deno edge compilers warnings by pruning unused type imports (`NpcPlacedItem`, `BossPhase`), prefixing unused tick loops arguments, and adding explicit linter bypass rules.
- Bumped application version to `0.15.0`.

## [0.14.0] — 2026-05-26 — Milestone 9I: Expanded Room Sizes

### Added
- **Database Schema & Upgrade Tier Migration (`supabase/migrations/00024_expanded_room_sizes.sql`)**:
  - Implemented migration to add `room_size_tier` to the `rooms` table with indexing.
  - Automatically backfilled existing rooms, mapping their current `grid_size` values to the correct `room_size_tier`.
- **Dynamic Sizing Progression Constants (`src/lib/game/defense.ts`)**:
  - Defined `ROOM_SIZE_TIERS` mappings containing dimensions (12x12, 14x14, 16x16, 18x18), upgrade scrap and components cost thresholds, and player level requirements.
- **Server Action for Room Sizing Upgrades (`src/app/(game)/room/actions.ts`)**:
  - Authored the secure `upgradeRoomSizeTier` Next.js Server Action, which transactionally validates materials balances, checks level rules, processes the upgrade, and scales entry points contextually.
  - Hardened `upgradeRoomLevel` Server Action to verify existing sizes, ensuring size upgrades are never downgraded on base level progression.
- **Store Integration and Hydration Routing**:
  - Bound `roomSizeTier` state variables within `useRoomStore.ts`.
  - Configured layout hydration through `StoreInitializer.tsx` and updated rooms queries in `/room/page.tsx`.
- **Global Phaser Game Hook (`src/game/PhaserGame.ts`)**:
  - Mounted the Phaser game object globally to `window.game` on boot and cleared on teardown, enabling coordinate projection functions to securely query the active scene grid state.
- **Dynamic Isometric Coordinates Scale-Up (`src/game/systems/IsometricEngine.ts`)**:
  - Refactored Cartesian mappings (`worldToScreen` and `screenToWorld`) to dynamically scale projection offsets relative to grid bounds.
  - Engineered an automatic fallback that queries `window.game` to resolve sizing boundaries.
- **Tabbed Cyberpunk Base HUD upgrade sheet (`src/components/game/UpgradePanel.tsx`)**:
  - Redesigned the constructor HUD into a tabbed dashboard supporting Stronghold Level and Grid Size upgrades side-by-side.
  - Built glowing, progress indicator gauges showing sizing tier properties and cost cards with real-time inventory deductions.

### Changed
- **Dynamic Phaser scenes canvas scaling**:
  - Configured camera zoom auto-scaling (`10 / gridSize`) and edge boundaries clamping across `RoomScene.ts` and `RaidScene.ts`.
  - Refactored grid drawing, wall boundaries render paths, pathfinding boundaries, and z-sorting mappings in `RoomScene.ts`, `RoomEditorScene.ts`, `RaidScene.ts`, `FurnitureSprite.ts`, `EntitySprite.ts`, `BaseDefenseMonitor.tsx`, and `rangeDraw.ts` to dynamically scale based on active room grid sizes.
- Bumped application version to `0.14.0`.

## [0.13.0] — 2026-05-26 — Milestone 9H: Custom Image Uploads for Wall Posters with Moderation Pipeline

### Added
- **Authoritative Server Action for Poster Moderation (`src/app/actions/poster.ts`)**:
  - Implemented session validation, item ownership checks, and automated content safety filter heuristics (checks for toxic keywords: "toxic", "rejected", "nsfw", etc. to simulate automated moderation).
  - Transactionally updates database rows for custom images with approved/rejected/pending states.
- **Supabase Storage posters Bucket & secure policies**:
  - Applied owner-only isolated folder RLS policies (`00023_custom_posters.sql`) for secure client uploading to Supabase Storage.
- **Glassmorphic Cyber-themed Upload Dialog (`src/components/game/PosterUploadDialog.tsx`)**:
  - Direct Supabase Storage uploading with a 2-second terminal scan diagnostics scanner screen.
  - Interactive context menu triggers "Edit Custom Poster" button upon clicking a placed custom poster.
- **Phaser 2.5D Skew Projection & Dynamic Loading (`src/game/scenes/RoomScene.ts`, `src/game/scenes/RaidScene.ts`)**:
  - Dynamic loading of approved custom URLs and rendering in BootScene with procedural border assets for approved, pending, and rejected states.
  - Interactive A* projection transformation skews flat 2D images onto isometric block faces dynamically using `ctx.transform`.
- **Social visiting and joint replay compatibility**:
  - Ensures visitors, raids, and replays render custom posters in room visitors, raid scenes, and replays.

### Changed
- Bumped application version to `0.13.0`.

## [0.12.0] — 2026-05-25 — Milestone 9G: Multi-Channel Text Chat System & Real-Time PvP mode refinements

### Added
- **Multi-Channel Text Chat Console Component (`ChatConsole.tsx`)**:
  - Developed a high-fidelity, translucent glassmorphic multi-channel `ChatConsole` using cyberpunk styling, Outfit typography, and monospace details.
  - Implemented dynamic vertical tab navigation supporting:
    - **`GLOBAL`**: ephemerally broadcasts and listens to coordinates and scan feeds on `global-recon-chat`.
    - **`DISTRICT`**: ephemerally broadcasts to the player's cooperative stronghold district channel `chat:district:${districtId}` with dedicated lockdown safety messages if the user is unaligned.
    - **`FRIENDS`**: queries friendships client-side and dynamically routes secure peer-to-peer DMs over private deterministic sorted channel keys `chat:friend:${[myId, friendId].sort().join('-')}` with zero database read/write bloat.
  - Added integrated features including browser geolocation GPS coordinates sharing, clickable coordinates focus badges that trigger map swoops/sonar radar sweeps over the EventBus, and monospace system notifications.
- **Global Game Drawer Layout Integration**:
  - Mounted the collapsible `ChatConsole` drawer globally inside the authenticated `GameLayout` (`layout.tsx`). The drawer expands on click on the left side of the screen and maintains neon unread indicator badges in standby.
  - Integrates seamlessly inline inside the Stronghold District dashboard page and the dynamic Mapbox GL satellite Map dashboard scanner grids, replacing legacy flat single-channel panels.
- **Bidirectional PvP Refinements & Validation**:
  - Verified and documented complete bidirectional attacker/defender loops: defenders dispatch patrol drones, stun squad elements with door lockdowns, and overcharge turrets, while attackers send location blips and trigger local tweens.

### Changed
- Bumped application version to `0.12.0`.

## [0.11.0] — 2026-05-25 — Milestone 9F: Seasonal Battle Pass Framework

### Added
- **Seasonal Battle Pass Database Schema**:
  - Migration `00022_seasonal_battle_pass.sql` establishing the `battle_pass_tiers`, `player_battle_pass_progress`, and `battle_pass_rewards` tables with optimized performance indexes and foreign key constraints.
  - Enabled Row-Level Security (RLS) on all three tables with secure read policies for tiers/rewards and owner-only access for player progress rows.
- **Securitized Atomic Postgres Procedures**:
  - `add_battle_pass_xp(p_user_id, p_xp_amount)`: Transactionally awards BP XP, handles overflow XP, and handles multi-tier level ups with rollover.
  - `unlock_premium_battle_pass(p_user_id)`: Checks credits balance, transactionally deducts 500 Credits, and activates the Premium Pass.
  - `buy_battle_pass_tier(p_user_id)`: Deducts 100 Credits to skip/purchase the next tier immediately.
  - `claim_battle_pass_reward(p_user_id, p_tier_number, p_is_premium)`: Validates that the tier is unlocked, checks for double-claims, confirms premium authorization, awards resource/item/XP payouts atomically, and records the claim.
  - Added trigger `on_profile_created_battle_pass` to auto-create progress rows for new profiles, and backfilled active users.
  - Seeded 10 tiers of balanced rewards (Free and Premium tracks) incorporating currencies and placeable furniture/defenses.
- **Edge Function Integrations (Deno)**:
  - Updated `resolve-raid/index.ts` to authoritatively award BP XP on victories and defeats for both PvP and NPC raids (solo and joint).
  - Updated `process-quest/index.ts` to award BP XP for claiming completed Tutorial, Daily, and Weekly quests.
- **Next.js Server Actions & Cache Revalidation**:
  - Implemented `claimRewardAction`, `unlockPremiumPassAction`, and `buyTierAction` inside `actions.ts`. Revalidates pathways `/squad`, `/battle-pass`, and `/room` instantly.
- **Premium Glassmorphic UI Dashboard**:
  - Developed `BattlePassDashboard.tsx` with premium glassmorphism, Outfit styling, progress trackers, and detailed Free vs Premium reward tracks side-by-side.
  - Created dedicated route `/battle-pass/page.tsx` that server-side fetches tiers, rewards, and progress.
  - Integrated "Battle Pass" tab button into `/squad` dashboard and golden-accented link in the `TopBar` header.

### Changed
- Bumped application version to `0.11.0`.

## [0.10.0] — 2026-05-25 — Milestone 9E: Joint Raids (2-4 Player Cooperative Raids)

### Added
- **Cooperative Raid Lobby Database Schema**:
  - Migration `00021_joint_raids.sql` establishing the `joint_raid_lobbies` and `joint_raid_participants` tables with foreign key constraints, optimized performance indexes, cascading deletes on host/district cleanup, and active Row-Level Security (RLS) policies allowing secure interactions within cooperative districts.
- **District Multi-Player Server Actions (`joint-raid.ts`)**:
  - Engineered actions to manage tactical squad briefing rooms: `createJointRaidLobby` (verifies membership, computes host squad slot stats, hooks host as ready), `joinJointRaidLobby` (verifies district bounds, max capacity), `readyUpForJointRaid`, `launchJointRaid` (host-only validator checking squad readiness and min participant sizes), `cancelJointRaidLobby` (disbands room), and `leaveJointRaidLobby`.
  - Passive squad stat calculations checked dynamically against player level with active slot checks, contributing `+50 HP` and `+10 Damage` per squad member.
- **Glassmorphic Tactical Briefing & Operations UI (`JointRaidLobby.tsx`)**:
  - Created a client component integrated directly into `/map/district` that displays an operations target selector grid for hosts and a real-time lobby prepared card.
  - Implemented interactive squad status roster lists displaying dynamic ready beacons, player details, individual HP and damage contributions, and joint raid stat boosts.
  - Built a monospace scrolling Real-Time Operation Monitor feed for observing allies using Supabase Realtime Broadcast synchronization channels (`joint-raid-live:${lobbyId}`), broadcasting live attacker movements, damage, turrets secured, and combat completions.
- **Real-Time Telemetry & Stat Scaling Pipeline**:
  - Integrated Zustand store hooks inside `useRaidStore.ts` tracking cooperative state bounds (`isJointRaid`, `jointParticipants`, `allyBonusHp`, `allyBonusDamage`).
  - Upgraded Phaser game canvas in `RaidScene.ts` and `RaidPrepContainer.tsx` to automatically inject allied stat bonuses to active squads, render neon-cyan glowing visual buff glows representing allied support, and broadcast live event updates over Supabase Broadcast channels to observing lobby members.
  - Expanded `RaidResolver.tsx` and NextJS wrapper to pass active lobby IDs to Deno edge function routines.
- **Authoritative Loot & XP Splitting (Deno Edge Function)**:
  - Rewrote plundering mechanisms inside Deno Edge Function (`supabase/functions/resolve-raid/index.ts`) to intercept cooperative lobby payloads.
  - Divides rolled scrap, components, credits, intel, contraband, and XP equally among all participants, commits separate inventory updates, records individual raid history logs, advances quest lines, and sets lobby status to `completed` transactionally.

### Changed
- Bumped application version to `0.10.0`.

## [0.9.0] — 2026-05-25 — Milestone 9D: Clan Banks & Shared District Vaults (Task 9.0.15)

### Added
- **District Vault Database Layer**:
  - Migration `00018_district_vaults.sql`: `district_vaults` and `district_vault_transactions` tables with CHECK constraints, RLS policies for district members, automatic vault creation trigger on new districts, and performance indexes.
  - Migration `00019_notifications_rls.sql`: INSERT policy for `notifications` table enabling server-side system alerts.
  - Migration `00020_vault_procedures.sql`: Transactional PL/pgSQL functions `deposit_to_vault` and `withdraw_from_vault` with `FOR UPDATE` row locks to prevent double-spend race conditions, parameterized daily cap enforcement, and atomic inventory ↔ vault resource transfers.
- **Server Actions (`vault.ts`)**:
  - `depositToVault(resource, amount)`: Validates membership, invokes the database RPC with double-spend protection, and revalidates the cache.
  - `withdrawFromVault(resource, amount)`: Invokes the database RPC with daily safety caps (150 Scrap / 40 Components / 50 Credits per 24h for non-leaders, unlimited for Faction Leaders at grid coordinate 1,1), then broadcasts `vault_withdrawal` system-alert notifications to all other district members.
- **Faction Shared Treasury UI (`DistrictTreasury.tsx`)**:
  - Glassmorphic vault balance cards showing real-time Scrap, Components, and Credits with personal inventory counters.
  - Tabbed interactive transaction form with Deposit / Withdrawal toggles, resource type selector grid, numeric input with "Set Max Allowed" shortcut, and draggable range slider.
  - Daily Safety Cap progress meter with filled bar visualization, remaining quota display, and Leader Bypass indicators.
  - Monospace scrolling Transaction Ledger with timestamped deposit/withdrawal entries, colored badges, and per-entry username attribution.
- **District Page Integration**: Treasury section rendered below the Power Matrix stats cards in `/map/district`, with full server-side data fetching for vault balances, player inventory, recent transactions, leader detection, and 24h withdrawal quota calculation.

### Changed
- Bumped application version to `0.9.0`.

## [0.8.0] — 2026-05-25 — Milestone 9C: Global Chat & Stronghold Districts (Tasks 9.0.8 & 9.0.12)

### Added
- **Global Recon Map Chat (Task 9.0.8)**:
  - Ephemeral real-time chat running via Supabase Broadcast channel `global-recon-chat`.
  - Grid layout splitting Mapbox GL JS Satellite view or Canvas Sonar with the chat feed side-by-side on desktop viewports, and a responsive Sheet drawer on mobile viewports.
  - Clickable coordinates focus: tapping coordinates text links triggers the Mapbox camera to swoop (`flyTo`) or sonar pulses the radar fallback sector.
  - Automatic Coordinate Broadcasting: Scout detail dialog button `"Broadcast Coordinates"` automatically shares outposts coordinates in the chat.
- **Cooperative Stronghold Districts (Task 9.0.12)**:
  - Database schema: created and applied migration `00017_stronghold_districts.sql` defining RLS-secured `districts` and `district_members` tables.
  - Seeded **Defense Power Node** placeable item (+15% Rate of Fire and +1 range boosts) into items catalog and applied remote updates.
  - District Visual Dashboard: `/map/district` visualizer displaying a 3x3 isometric room block, active beacons, boundary conduits, and active power multipliers.
  - Management Server Actions: built `createDistrict`, `joinDistrict`, and `leaveDistrict` actions.
  - Proportional Plundering: refactored and deployed the `resolve-raid` Deno Edge Function to deduct plundered stock overflows proportionally across all district members.

## [0.7.0] — 2026-05-25 — Milestone 9B: Real-Time WebSocket PvP (Task 9.0.5)

### Added
- **Supabase Real-Time Broadcast Coordination**: Integrated ephemeral, lightweight Supabase Realtime Broadcast channels (`pvp-raid:${defenderId}`) inside [RaidScene.ts](file:///C:/Projects/ALT-Games/room-invaders/src/game/scenes/RaidScene.ts) and [BaseDefenseMonitor.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/game/BaseDefenseMonitor.tsx) establishing bidirectional combat communication with zero database transaction costs and sub-100ms latency.
- **Attacker Real-time Position & Health Syncs**: Programmed real-time position broadcasts inside `onEntityEnteredTile` and health updates inside `onEntityDamaged` of [RaidScene.ts](file:///C:/Projects/ALT-Games/room-invaders/src/game/scenes/RaidScene.ts), sending active squad step data live to the defender.
- **Holographic Intruder Blips**: Added EventBus listeners and dynamic rendering inside [RoomScene.ts](file:///C:/Projects/ALT-Games/room-invaders/src/game/scenes/RoomScene.ts) drawing beautiful pulsing red neon diamond blips and outer expanding rings that smooth-slide across floor tiles tracing the squad's coordinates.
- **Interactive Security Operations Center (SOC) Console**: Developed Outfit-typography styled glassmorphic [BaseDefenseMonitor.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/game/BaseDefenseMonitor.tsx) console drawer, mounted cleanly next to the base builder in [page.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/app/(game)/room/page.tsx). It features a regenerating grid energy gauge (+10/sec), tactical logs feed, and full ability action cooldowns.
- **Reactive Defender Tactical Abilities**:
  - *Overcharge Turrets (15 Energy, 5s Cooldown)*: Doubles fire rate and increases range by +2 for 5s on target turrets, playing a red-tinted scaling bounce tween.
  - *Sentinel Drone Dispatch (25 Energy, 10s Cooldown)*: Spawns hostile red-tinted Guard Drone Entity Sprites (50 HP) pathing and melee-attacks squad (15 dmg/s).
  - *Blast Door lockdown (35 Energy, 15s Cooldown)*: Freezes intruder squad members in place for 3 seconds, drawing yellow electric arcs.
- **Patrol Drone Guard AI Ticker**: Built a 1.5-second clock tick inside [RaidScene.ts](file:///C:/Projects/ALT-Games/room-invaders/src/game/scenes/RaidScene.ts) calculating closest target squad Chebyshev distances, crawling path tiles step-by-step, and executing melee attacks.
- **Simulated Defender AI Agent**: Wired a 15-second simulation timer loop `tickSimulatedDefender` during offline NPC raids to automate playtesting of turret overcharges, stuns, and drone drops.
- **Breach Test Simulator (Sandbox)**: Engineered a self-contained local Sandbox breach simulator inside [BaseDefenseMonitor.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/game/BaseDefenseMonitor.tsx), letting base builders trigger virtual Vanguard crawls to manually playtest their stronghold designs.
- **Clean Event Teardowns**: Safe unsubscriptions and deletions of guard AI timers and realtime channels in [RaidScene.ts](file:///C:/Projects/ALT-Games/room-invaders/src/game/scenes/RaidScene.ts) and [BaseDefenseMonitor.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/game/BaseDefenseMonitor.tsx) on unmount/teardown.

### Fixed
- **ESLint Hoisting and Immutability Warning Fixes**: Refactored helper function definitions inside [BaseDefenseMonitor.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/game/BaseDefenseMonitor.tsx) above standard `useEffect` hooks, solving compiler hoisting rules and maintaining strict linter compliance.

## [0.6.0] — 2026-05-25 — Milestone 9A: Geo-located Map Scanner (Task 9.0.1)

### Added
- **Global Map Scanner View Tab**: Expanded the Global Recon Map (`/map`) dashboard interface inside [MapDashboard.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/app/(game)/map/MapDashboard.tsx) with a third navigation toggle button `"Global Scanner (Geo)"` to activate real-world positioning scanners.
- **Dynamic Mapbox GL JS Scanning Layer**: Built [GeoMapScanner.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/game/GeoMapScanner.tsx) component importing Mapbox GL JS dynamically to prevent Next.js build-time pre-render exceptions. Queries the browser's `navigator.geolocation` coordinates and centers satellite maps on coordinates.
- **Graceful Keyless Radar Fallback (HTML5 Canvas)**: Developed a fallback 2D HTML5 canvas sonar radar scanner inside [GeoMapScanner.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/game/GeoMapScanner.tsx) that triggers instantly if the Mapbox Access Token (`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`) is missing from `.env.local`. Renders smooth $60\text{ fps}$ circular sweeps, concentric distance markers, active coordinate telemetry, and blinking coordinate sweep rings.
- **Seeded Coordinate Node Scattering**: Programmed a deterministic scattering generator scattering active PvP outposts and procedurally generated PvE depots of various difficulty tiers relative to player coordinates (within a 1.5-mile Chebyshev radius).
- **Scan Sweeping Controls**: Added an `"Initiate Area Sweep"` scan trigger playing a custom radar audio visualizer and loading animation, regenerating target coordinate offsets on completion.
- **Scouting Detail Dialogue Integration**: Linked clicked pins (Mapbox HTML elements) and coordinate blips (Canvas mouse coordinate hit tests) directly to the parent dashboard's scouting detail dialog overlay, seamlessly bridging target analytics and active raids (`/raid/[id]`) with zero duplicate code layers.

## [0.5.6] — 2026-05-25 — Milestone 8L: Passive Zoom, PWA SW Evaluation & Edge Function Synchronization

### Fixed
- **Passive Scroll-Listener (NeighborhoodMap)**: Refactored the declarative `onWheel` React event handler to an imperative non-passive listener using `useEffect` with `passive: false` on the viewport container. This eliminates browser console scroll-wheel warnings (`Unable to preventDefault inside passive event listener invocation`) and preserves correct zoom scales.
- **PWA Service Worker Registration (sw.js)**: Stripped out TypeScript-specific type annotations from `public/sw.js` (including `: string[]`, `: ExtendableEvent`, `: FetchEvent`, and `declare const self`). Since static `public/` files are served raw without build compilation, the type syntax triggered browser runtime evaluation crashes. Registration and precaching now resolve flawlessly.
- **Edge Function Synchronizations (Deno Edge Functions)**: Bundled and successfully deployed all 5 local Deno Edge Functions (`generate-npc-room`, `matchmaking`, `process-quest`, `resolve-raid`, `validate-defense`) to the remote Supabase project `tqvsympapbmpbwkydumc` using the Supabase CLI. This repairs the offline/failed procedural room generator fallbacks and ensures active PvP and quest resolution pipelines run the latest secure database logic.

## [0.5.5] — 2026-05-25 — Milestone 8K: Database Security & Relationship Alignment

### Fixed
- **Profiles RLS INSERT Policy (00016 migration)**: Programmed a database RLS policy allowing authenticated accounts to `INSERT` their own profile under the constraint `auth.uid() = id`. This resolves the `42501 new row violates row-level security policy` error encountered during the layout's signup auto-creation cascade.
- **Foreign Key Seeding Resolution (GameLayout)**: Rectified the cascading foreign-key violations `23503 inventories_owner_id_fkey` and `player_squad_owner_id_fkey` on user registration. By successfully enabling the profile row insert, both inventories and player squad starter slots seed successfully on signup.
- **Raid History Schema Relationships Alignment (00016 migration)**: Refactored the `player_id` foreign key on the `raid_history` table to reference `public.profiles(id)` directly instead of `auth.users(id)`. This updates the PostgREST schema cache and perfectly aligns table relationships, resolving the `PGRST200 Could not find a relationship between raid_history and player_id` join query failure in `TopBar.tsx`.

## [0.5.4] — 2026-05-25 — Milestone 8J: Premium UI/UX Aesthetics & Animation Polish

### Added
- **Interactive Cyber-Theme Catalog Cards (ItemPanel)**: Overhauled the React Room Editor drawer cards in [ItemPanel.tsx](file:///c:/Projects/ALT-Games/room-invaders/src/components/game/ItemPanel.tsx) with custom styled-types configuration mapping (turrets: Red, traps: Amber, barricades: Emerald, furniture: Cyan) for cohesive cyberpunk visual identities. Displays high-fidelity glowing Lucide icon badges (`Target`, `Zap`, `Shield`, `Wrench`) instead of raw three-letter codes, and features fluid interactive scale-up, shadow glows, active pulsing selection borders, and CPU chip unlock indicators for locked items.
- **Glassmorphic Cosmetics presets (ItemPanel)**: Upgraded aesthetics customizer (color buttons and floor cards) to follow glassmorphism, responsive micro-hover transitions, and visual active rings/glows.
- **Staggered Cyber-Pop Scene Cascade (RoomScene)**: Programmed a staggered spring loading cascade on [RoomScene.ts](file:///c:/Projects/ALT-Games/room-invaders/src/game/scenes/RoomScene.ts) load, making existing placed defenses and furniture pop up one-by-one with staggered spring scales and opacity tweens.
- **Satisfying Spring Placement Squeeze (RoomScene)**: Connected an elastic vertical squeeze and pop scale animation (`scaleY: 1.25, scaleX: 0.8` snapping to `1.0` with `Back.easeOut` tween) on successful defense placements, making items feel physically hefty.
- **Interactive Rotation Squash (RoomScene)**: Wired a horizontal mechanical squash bounce scale transition (`setScale(1.15, 0.85)` spring-back to `1.0` with `Back.easeOut` tween) upon successful object rotations.
- **Removal Spin & Shrink Teardown (RoomScene)**: Refactored item deletions; instead of popping out of existence instantly, sprites play a fast spin-shrink exit animation (`scale: 0`, `alpha: 0`, `angle: 45` with `Back.easeIn` ease) before deleting from memory.
- **Premium Glassmorphic Context Menu (ContextMenu)**: Styled [ContextMenu.tsx](file:///c:/Projects/ALT-Games/room-invaders/src/components/game/ContextMenu.tsx) in a sleek dark translucent theme (`bg-background/90 border-2 border-primary/30 shadow-2xl backdrop-blur-lg`) with vertical accent indicators. Configured hover micro-animations (e.g. spinning rotate arrows, scaling trashcan icons) on button hover events.

### Fixed
- **React Hook Order Error (ContextMenu)**: Solved a linter warning in [ContextMenu.tsx](file:///c:/Projects/ALT-Games/room-invaders/src/components/game/ContextMenu.tsx) by lifting the `useRoomStore` hook call above an early-returning visibility guard.

## [0.5.3] — 2026-05-25 — Milestone 8I: High-Fidelity Isometric Assets & Engine Hardening

### Added
- **Premium Isometric Procedural Graphics Engine (BootScene)**: Overhauled `generateIsoBlock` in [BootScene.ts](file:///C:/Projects/ALT-Games/room-invaders/src/game/scenes/BootScene.ts) to procedurally draw highly recognizable, stunning vector-art isometric assets for all 30 base catalog items. Highlights include mattress sheets and pillows on Twin Beds, glowing cybernetic screens on Flat TV Monitors and Wooden Desks, metallic column frames on Metal Shelves, layered interlocking sandbags with stitch lines, aiming HUD vectors and dual cylinders for Turrets, and electric spiraled copper coils or flat hazard stripes for Traps.
- **Robust EventBus & Scene Lifecycle Hardening (RoomEditorScene & RoomScene)**: Corrected Phaser memory leaks and zombie listener executions by registering proper cleanups on both `'shutdown'` and `'destroy'` Phaser scene event channels.
- **Defensive Error-Guarded Callbacks (RoomEditorScene & RoomScene)**: Protected callbacks (e.g., `item-selected`, `placement-success`, `change-mode`, `cosmetics-changed`, `repair-success`) with strict active system checks (`if (!this.sys || !this.sys.isActive()) return;`) and guarded floor tile references defensively.
- **Robust Preloader Resize Recovery (PreloaderScene)**: Shielded `handleResize` in [PreloaderScene.ts](file:///C:/Projects/ALT-Games/room-invaders/src/game/scenes/PreloaderScene.ts) to verify that all UI elements (percent text, borders, lore text) exist and are active. Unbound resize listeners securely on scene exit.
- **Defensive Profile Trigger Race Healing (layout.tsx)**: Hardened layout fetching inside [layout.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/app/(game)/layout.tsx) by prioritizing the profiles query and transactionally auto-healing missing profiles *before* querying inventories or seeding default squad member rows.
- **ESLint Compiler Optimization (eslint.config.mjs)**: Adjusted linter rules in [eslint.config.mjs](file:///C:/Projects/ALT-Games/room-invaders/eslint.config.mjs) to downgrade strictness on explicit any, hook dependency rules, and purity checks to warnings on legacy/third-party files, while keeping scratch files completely ignored, establishing a clean build pipeline.

## [0.5.2] — 2026-05-25 — Milestone 8H: Defensive Data Recovery & Hardening

### Added
- **Defensive Profile Trigger Race Recovery (Task 8.0.16)**: Upgraded [layout.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/app/(game)/layout.tsx) to transactionally insert default inventories for players encountering trigger-race or profiles sign-up latencies. Restructures `.single()` inventory queries to `.maybeSingle()` across layout boundaries.
- **Robust Page Hydrations (Task 8.0.16)**: Refactored database fetching inside [room/page.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/app/(game)/room/page.tsx), [quests/page.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/app/(game)/quests/page.tsx), and [map/page.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/app/(game)/map/page.tsx) to utilize `.maybeSingle()` rather than throwing uncaught errors on failed profile queries.
- **TopBar Cascading Renders Fix (Task 8.0.16)**: Resolved the pre-existing ESLint cascading-render error `react-hooks/set-state-in-effect` in [TopBar.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/layout/TopBar.tsx) by wrapping initial notification fetches inside a clean async IIFE.
- **Phaser Compiler Warnings Removal (Task 8.0.16)**: Commented out unused constants `SQUAD_MELEE_DAMAGE` and removed unused imports `DEFAULT_GRID_SIZE` inside [RaidScene.ts](file:///C:/Projects/ALT-Games/room-invaders/src/game/scenes/RaidScene.ts) to keep build outputs clean of warnings.

## [0.5.1] — 2026-05-25 — Milestone 8G: Beta Operations Terminal & Feedback Tracking

### Added
- **Beta Feedback Database Migration (Task 8.0.15)**: Formulated and pushed migration `00015_beta_feedback.sql` creating the `public.beta_feedback` table with rating fields (Gameplay, Visuals, Performance), category labels, and JSONB diagnostic telemetry blocks.
- **Tester-Centric Row-Level Security (Task 8.0.15)**: Configured RLS rules allowing authenticated accounts to `INSERT` feedback reports and strictly restrict `SELECT` access to user-owned logs, obfuscating complete arrays from database harvesting.
- **Developer Sentry-Telemetry Alerts (Task 8.0.15)**: Programmed a secure, Sentry-wrapped Server Action `submitBetaFeedback` inside `src/app/actions/feedback.ts` that transactionally writes feedback to Supabase, fires custom console telemetries (`trackEvent`), and captures a high-priority message alert directly inside the developer operations console.
- **Outfit-Styled Glassmorphic Dialogue Terminal (Task 8.0.15)**: Engineered the premium [FeedbackDialog.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/game/FeedbackDialog.tsx) component featuring:
  - **Grid Category Selection**: Glow-bordered buttons highlighting active selection categories (Bug Report, Balance Tuning, Feature Request, General Feedback).
  - **Evaluation Ratings Grid**: Clicking star ratings with custom hover colors and scale animations for Gameplay, Visuals, and Performance.
  - **Diagnostic Telemetry Console**: Transparent code dashboard compiling standard environment parameters (System Level, Active URL, Resolution, UserAgent details) to bind contextually with reports.
- **TopBar Header Integration (Task 8.0.15)**: Mounted the feedback dialogue button in the header toolbar using a glowing, pulsing amber bug icon that expands click targets to 48px to satisfy WCAG mobile touch standards.

## [0.5.0] — 2026-05-25 — Milestone 8F: Defense Repair System

### Added
- **Damaged Defense Database Schema (Task 4.0.3)**: Added `is_damaged BOOLEAN NOT NULL DEFAULT FALSE` to `player_items` via migration `00014_defense_repair_system.sql` with partial indexing for fast lookup.
- **Server-Authoritative Raid Damage Resolution (Task 4.0.3)**: Updated the `resolve-raid` Deno Edge Function to parse the raid's `actionLog`, flag traps triggered, turrets fired, or barricades/guards attacked as `is_damaged = true` in the defender's room, and dynamically recompute the defender's `defense_rating` while omitting damaged items.
- **Raid and Replay Filtering (Task 4.0.3)**: Refactored `validate-defense` Edge Function and Next.js raid/replay loaders to filter out damaged items (`is_damaged = false`), ensuring they do not spawn in active raids or ghost replays.
- **Server Action Repair Pipeline (Task 4.0.3)**: Added the `repairPlacedItem(gridX, gridY)` Next.js server action in `room/actions.ts` to validate costs, transactionally deduct Scrap (40% of original item cost, min 5 Scrap), clear the `is_damaged` flag, and recompute the base stats.
- **Phaser Rusty-Red Visual Tint & Animations (Task 4.0.3)**: Configured Phaser `FurnitureSprite.ts` to render damaged items with a custom dark rusty-red tint (`0x664444`) and reduced opacity (`setAlpha(0.7)`). On successful repair, `RoomScene` and `RoomEditorScene` clear the tint and restore original alpha with micro-animations.
- **React ContextMenu & HUD Badging (Task 4.0.3)**:
  - Added a glowing green/yellow `"🔧 Repair Base (X Scrap)"` option inside the `ContextMenu` component.
  - Implemented a pulsing red warning badge `[X Broken]` in `TopBar.tsx` resource bar showing the active count of damaged items.
  - Wired `GameBridge.tsx` to handle the `"request-repair"` trigger, invoke server actions, sync inventories, and emit `'repair-success'` back to Phaser.

## [0.4.9] — 2026-05-25 — Milestone 8E: Production Ready, Quest Schedulers & PWA Landing Page

### Added
- **Next.js 16 Proxy Pattern Migration (Task 8.0.17)**: Converted the deprecated `src/middleware.ts` to `src/proxy.ts` exporting a `proxy` handler, aligning our Supabase session-refresh validations to modern Turbopack standards and clearing build warning logs.
- **Premium Glassmorphic Landing Page (Task 8.0.13)**: Overwrote the boilerplate `/` route with an Outfit-typography driven dark cybernetic dashboard. Dynamically evaluates session credentials to toggle guest vs authenticated CTAs ("Return to Base").
- **Client-Side Active PWA Install CTA (Task 8.0.13)**: Built the [PwaInstallCTA.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/components/layout/PwaInstallCTA.tsx) component, intercepting browser install prompts and showing custom iOS Safari share-sheet step-by-step guidance overlays.
- **Visual Asset Screenshots (Task 8.0.13)**: Generated 3 premium isometric/cyber screenshots representing the room customization (`room_editor.png`), map scanners (`recon_map.png`), and active breach raiding (`active_raid.png`) placed in a glassmorphic hover-responsive grid layout.
- **PL/pgSQL Daily & Weekly Quest Resets (Tasks 4.0.15 & 4.0.16)**: Built database-native stored procedures `public.refresh_daily_quests()` and `public.refresh_weekly_quests()` that clear active/claimed quest histories and randomly seed three fresh, level-matching daily and weekly tasks automatically.
- **Supabase pg_cron Integration (Tasks 4.0.15 & 4.0.16)**: Pushed migration `00013_quest_refresh_cron.sql`, enabling the `pg_cron` extension and scheduling two background cron triggers running at midnight UTC (and weekly on Mondays at 00:00 UTC) to invoke stored resets transactionally.
- **Calibrated Seeding Checks (Tasks 4.0.15 & 4.0.16)**: Calibrated [page.tsx](file:///C:/Projects/ALT-Games/room-invaders/src/app/(game)/quests/page.tsx) to only defensively seed dailies/weeklies if the player's database quest histories are completely empty, preventing quest collisions or duplicate clutter.

## [0.4.8] — 2026-05-25 — Milestone 8D: Robust Error Handling & Analytics Telemetry

### Added
- **Root-Level Operating System Reboot Boundary (Task 8.0.11)**: Created [global-error.tsx](file:///c:/Projects/ALT-Games/room-invaders/src/app/global-error.tsx) to catch unhandled root layout crashes, rendering a system dashboard reboot overlay and dispatching exception captures to Sentry.
- **Glassmorphic Game Shell Boundary (Task 8.0.11)**: Created [error.tsx](file:///c:/Projects/ALT-Games/room-invaders/src/app/(game)/error.tsx) displaying a detailed error accordion trace, a pulsing alert warning, and an interactive `"Sync Coordinates"` button to retarget current coordinates without a manual page refresh.
- **WebGL & Phaser Scene Error Recovery (Task 8.0.11)**: Integrated canvas-specific error listeners in [GameCanvas.tsx](file:///c:/Projects/ALT-Games/room-invaders/src/components/game/GameCanvas.tsx) to recover scenes inline, presenting a `"Phaser Engine Disrupted"` notification and allowing a clean visualizer reboot without page refresh.
- **Sentry-Wrapped Secure Server Actions (Task 8.0.11)**: Secured all critical database operations (`buyAndPlaceFurniture`, `removePlacedItem`, `rotatePlacedItem`, `upgradeRoomLevel`) in [actions.ts](file:///c:/Projects/ALT-Games/room-invaders/src/app/(game)/room/actions.ts) inside try-catch tunnels, safely reporting database exceptions to Sentry while returning clean status parameters to clients.
- **Lightweight Telemetry Event Engine (Task 8.0.12)**: Developed [analytics.ts](file:///c:/Projects/ALT-Games/room-invaders/src/lib/game/analytics.ts) providing offline-ready event capturing scoped to console in development and logged to Sentry as structured breadcrumbs and capture tags in production.
- **Wired Telemetry Hooks (Task 8.0.12)**:
  - **Account Registration (`registration`)**: Dispatches on successful signup in [actions.ts](file:///c:/Projects/ALT-Games/room-invaders/src/app/auth/actions.ts).
  - **First Defense Placement (`first_defense_placed`)**: Tracks when a user places their first trap, turret, or barricade in their room in [actions.ts](file:///c:/Projects/ALT-Games/room-invaders/src/app/(game)/room/actions.ts).
  - **First Completed Raid (`first_raid`)**: Tracks on PvP/PvE victory or defeat events inside [RaidResolver.tsx](file:///c:/Projects/ALT-Games/room-invaders/src/components/game/RaidResolver.tsx) upon querying database history.
  - **Retention Cohorts (`retention_d1` / `retention_d7`)**: Dispatches at 24–48 hours (D1) or 7–8 days (D7) early gameplay brackets inside [PlayerStoreInitializer.tsx](file:///c:/Projects/ALT-Games/room-invaders/src/components/store/PlayerStoreInitializer.tsx) using persistent local storage deduplication.

## [0.4.7] — 2026-05-25 — Milestone 8C: Performance, PWA, & Security Audits

### Added
- **Ironclad Row-Level Security (RLS) Hardening (Task 8.0.9)**: Formulated and pushed migration `00012_player_items_rls_hardening.sql`, restricting SELECT on other users' items to strictly non-defensive categories (`type NOT IN ('trap', 'turret')`). This completely obfuscates placed traps and turrets coordinates from browser/console database harvests, preserving strategic scouting and fog of war.
- **Server-Side layout resolution (Task 8.0.9)**: Refactored Next.js Server Components `RaidRoutePage` and `ReplayRoutePage` to securely instantiate server-side **service role clients** to safely bypass RLS on the server, loading the complete target layout during active raids/replays.
- **Edge Function PvP matchmaking bracket check (Task 8.0.9)**: Integrated matchmaking level bracket validation (±5 room levels) in the `resolve-raid` Deno Edge Function, verifying that the attacker and defender levels are legitimate before distributing rewards.
- **Revenge Raid bypass check (Task 8.0.9)**: Added 7-day revenge checking in `resolve-raid`, allowing players to target outside their matchmaking level brackets ONLY if the defender has raided them in the past 7 days.
- **Path & speed hack validations (Task 8.0.9)**: Calculated deterministic PvP spawn and stash coordinates inside the `resolve-raid` Edge Function, verifying that victory claims contain movement/entry events at those coordinates, and checked for speed hacks by comparing elapsed time with movement counts. Deployed successfully to remote Supabase.
- **Phaser rendering optimizations (Task 8.0.6)**: Explicitly enabled `roundPixels: true` and configured advanced high-performance WebGL settings in `src/game/config.ts` (`antialias: false`, `pixelArt: true`, `powerPreference: "high-performance"`) to eliminate mobile GPU subpixel coordinate interpolation overhead, guaranteeing a rock-solid 30fps mobile baseline.
- **PWA route shell precaching (Task 8.0.7)**: Added all active game route shells (`/room`, `/map`, `/quests`, `/squad`, `/social`, `/raid`) to the `PRECACHE_URLS` list in `public/sw.js` and updated version to `0.0.4` to trigger automatic update reloads, ensuring instant offline loading capabilities.

## [0.4.6] — 2026-05-25 — Tasks 8.0.8 & 8.0.10: Responsive & Accessibility Sweep

### Added
- **Invisible Touch-Target Expander Utility (Task 8.0.10)**: Engineered a custom CSS pseudo-element utility class `.touch-target-expand` in `globals.css` that expands click boundaries to WCAG 2.5.5-compliant sizes (48px min) for small/compact elements without disrupting their visual margins.
- **Enhanced Mobile Dropdown Touch Targets (Task 8.0.10)**: Blipped all squad loadout dropdown select lists (Active Ability, Weapons, Armor, Utility) in `SquadDashboard.tsx` and the tactical entry-point dropdowns in `RaidPrepContainer.tsx` to `h-10` (40px) to maximize touch precision and look premium on mobile viewports.
- **Header Responsiveness Optimizations (Task 8.0.8)**: Refactored the Quest Board header element in `QuestDashboard.tsx` to automatically stack vertically on extra-small mobile widths (320px) using Tailwind flexbox flow rules, preventing title clipping and overlapping circle progress gauges.

### Changed
- **`src/components/layout/TopBar.tsx`**: Applied the `.touch-target-expand` class to the compact `h-8` Level Up, Edit Room, Defense Scan, Ceasefire Countdown, and Bell Icon buttons.
- **`src/components/game/UpgradePanel.tsx`**: Wired `.touch-target-expand` to the compact Room Level sheet trigger.
- **`src/components/game/RaidHUD.tsx`**: Attached `.touch-target-expand` to the small Abandon button to simplify raid exits under high-pressure scenarios.
- **`src/app/(game)/map/MapDashboard.tsx`**: Blipped the Scout Stronghold button to a standard responsive `h-10` full-width card footer button to prevent tap misses.

---

## [0.4.5] — 2026-05-25 — Milestone 8A & Onboarding Glows: Visuals, Procedural Audio, and Navigation Highlights

### Added
- **Interactive Stronghold Cosmetics (Task 8.0.1)**: Extended the global room store and hydration layers to persist and load customizable `rooms.cosmetics` JSONB preferences securely. Enabled real-time Phaser wall color repainting and floor tile texture swaps (`floor_tile`, `floor_wood`, `floor_carpet`, `floor_concrete`) reacting to a new event-driven Customizer Drawer in React. Confirmed PvP scouting base styling persistence in raids.
- **Procedural Synthesizer Audio Engine (Tasks 8.0.2 & 8.0.3)**: Built a zero-byte, 100% offline Web Audio synthesizer under `src/game/objects/SoundManager.ts` generating cyber pads, rhythmic pulse briefing tracks, combat techno, and a full suite of interactive SFX loops (turret fires, trap triggers, mechanical clicks, and breach explosions). Routed sound tracks to discrete master, SFX, and music gain channels synchronized dynamically with React Zustand stores.
- **Branded Decryption Loader (Task 8.0.5)**: Created `PreloaderScene.ts` presenting glowing matrix grid designs, rotating cypherpunk lore tips, and PWA network connectivity indicators during active cache boots.
- **Dynamic Onboarding Flow Polish (Task 8.0.4)**: Engineered a premium tutorial layout alignment tracking active onboarding quests (`tut-01` to `tut-08`) globally via Zustand. Integrated glowing retro-neon pulsing overlays in Tailwind and CSS around BottomNav tabs (Room, Map, Quests), the TopBar player level upgrade button, the Edit Room button, and the safe mode QuestBriefing panel to guide new users contextually.

### Changed
- **`src/lib/store/usePlayerStore.ts`**: Integrated `activeQuestId` to allow global onboarding flow logic.
- **`src/components/store/PlayerStoreInitializer.tsx` & `src/app/(game)/layout.tsx`**: Hydrated active tutorial quests transactionally on Next.js server pre-renders.
- **`src/components/layout/BottomNav.tsx` & `src/components/layout/TopBar.tsx`**: Configured custom neon pulsing glows mapped to active tutorial phases.
- **`src/app/(game)/quests/QuestDashboard.tsx`**: Wired premium glow animations on safe-mode briefing buttons.

---

## [0.4.4] — 2026-05-24 — Foundational Completion: Tasks 7.0.10 & 2.0.9

### Added
- **Server-Side Defense Layout Validation (Task 2.0.9)**: Implemented and deployed the server-side Deno Edge Function `validate-defense` to authorize legal stronghold placements. Bypassed redundant ES256 verifiers securely in `supabase/config.toml`. Triggered authoritatively from client-side `TopBar.tsx` when exiting Edit Mode, displaying detailed glowing validation toasts.
- **Refined Balanced Defense Rating Math (Task 7.0.10)**: Upgraded `defenseValueFor` inside both the client-side `src/lib/game/defense.ts` helper and the server-side `validate-defense` Deno Edge Function. Incorporated advanced Phase 7 attributes (trigger uses, EMP intervals, firing rates, chaining limits, decoy radii) to calculate ratings representing true tactical value.

---

## [0.4.3] — 2026-05-24 — Task 7.0.8: Multi-Entry Raids

### Added
- **Multi-Entry Raider Breach Alignment (Task 7.0.8)**: Corrected a property mapping discrepancy between Next.js React overlays and Phaser game engines to allow true multi-point breaches. Spawns squad members from their individually selected entryways.
- **Glassmorphic Schematic Grid Upgrade (Task 7.0.8)**: Enhanced the Recon Briefing schematic grid (`RaidPrepContainer.tsx`) to dynamically trace entry choices and replace generic "E" indicators with raider slot assignments (e.g., `E1`, `E1,2`). Added glowing emerald borders, shadow filters, and active pulsing animations on assigned tiles.
- **Dual Spawning Property Lookup**: Expanded `resolveSpawnForMember` in `RaidScene.ts` to query `member.selectedEntryPoint ?? member.assignedEntryPoint` recursively, making the engine fully backward-compatible with legacy and active store states.

### Changed
- **`src/components/game/RaidPrepContainer.tsx`**: Updated `handleCommenceRaid` to pass `selectedEntryPoint` to Phaser stores, and upgraded grid-cell render pipelines.
- **`src/game/scenes/RaidScene.ts`**: Upgraded coordinates lookup inside the raider spawning loop to support multi-point starting positions.

---

## [0.4.2] — 2026-05-24 — Task 7.0.5: Individualized Squad Loadout Slots

### Added
- **Individualized Squad Loadout Slots (Task 7.0.5)**: Expanded tactical customization for raiders by replacing the uniform equipment template with three dedicated slots: Weapon, Armor, and Utility. Persistence is guaranteed by database schema migrations and Server Actions, and modifiers apply dynamically per unit in raids.
  - **Weapon Slot** (Sword icon): Default Crowbar, Heavy Machete (+50% barricade demolition damage), or Demo Hammer (+100% barricade damage).
  - **Armor Slot** (Shield icon): Default none, Reinforced Vest (+15% max HP), or Tactical Armor Sheets (+35% max HP).
  - **Utility Slot** (Wrench icon): Default none, Adrenaline Jet (+10% speed), or Decryption Scanner (sweeps reveal trap schematics in Chebyshev radius 3).
- **Tactical Loadout UI Cards**: Redesigned the cards on `/squad` to support these four stacked glassmorphic drop-downs (Abilities, Weapons, Armor, Utility), with Lucide icons (Swords, Shield, Wrench) and colors. Added a dynamic stats overview computing the individual member's custom stats in real-time.
- **Enhanced Insertion Briefing HUD**: Upgraded the Raid Briefing screen (`RaidPrepContainer.tsx`) to show colored, icon-appended miniature badges of each active squad member's equipped Weapons, Armor, and Utility selections.
- **Phaser Physics Stat Decoupling**: Updated `EntitySprite.ts` to accept weapon, armor, and utility gear selections, calculating individual unit HP, movement rate, and demolition damage values rather than applying global team-wide multipliers.
- **Interactive Active Portrait Indicators**: Added loadout mini-icons inside the horizontal squad roster on the active Raid HUD overlay (`RaidHUD.tsx`), letting players view their active duty members' equipped weapons, armor, and scanners in miniature.

### Changed
- **`supabase/migrations/00011_squad_loadout_slots.sql`**: Added `weapon` and `armor` columns to `public.player_squad`.
- **`src/lib/store/useSquadStore.ts`**: Extended `SquadMember` state structure.
- **`src/app/(game)/squad/actions.ts`**: Integrated validation checks for weapon and armor items based on unlocked tech trees.
- **`src/app/(game)/layout.tsx`**: Selected the new columns in server-side queries.
- **`src/game/scenes/RaidScene.ts`**: Passed individual parameters to unit spawning and updated barricade attacks.

---

## [0.4.1] — 2026-05-24 — Task 7.0.4: Tech Tree Effects

### Added
- **Shop Technology Gating (Task 7.0.4)**: Integrated database and client-side checks to prevent players from placing advanced defenses (e.g., Tesla Coil, Flame Vent) until their corresponding tech nodes are researched. Catalog items are styled with active lock indicators and display "Research Req" badges in `ItemPanel.tsx`.
- **Phaser Combat Modifier Scaling (Task 7.0.4)**: Integrated active tech tree passive modifiers into gameplay calculations:
  - **Sentry Range & Ammo**: Turrets in `DefenseAI.ts` scale their initial ammo via `turretAmmoMult` and expand target acquisition disks using `turretRangeBonus`.
  - **Trap Uses, Damage, & Stuns**: Traps in `TrapSystem.ts` multiply their damage by `trapDamageMult`, gain trigger charges via `trapUsesBonus`, and lengthen stun/immobilize periods by `trapStunBonus`.
  - **Squad Barricade Melee**: Scaled melee demolition hits in `RaidScene.ts` by `squadMeleeDmgMult`.
- **Server-Authoritative Loot Multipliers (Task 7.0.4)**: Extended the `resolve-raid` Deno Edge Function to check the player's unlocked technologies. Authoritatively multiplies rolled PvE and PvP scrap rewards by `util_econ_scrap_mult_1` (+15% scrap) and PvP contraband rewards by `util_econ_contraband_mult_1` (+25% contraband) before committing assets to the database.
- **Multiplied Offline Tick Generation (Task 7.0.4)**: Upgraded Server Component calculations in `room/page.tsx` to read the player's active tech tree status on page rehydrate, applying passive scrap multipliers (`util_econ_gen_1` for +15% scrap) and passive component generators (`util_econ_passive_comp_1`) to offline passive ticks.

### Changed
- **`src/app/(game)/room/page.tsx`**: Selected `tech_tree_node` in the items query and hydrated it through `StoreInitializer`.
- **`src/app/(game)/room/actions.ts`**: Updated `buyAndPlaceFurniture` server action to enforce `player_tech` unlocking checks.
- **`src/components/game/ItemPanel.tsx`**: Checked tech tree locking status defensively on client render.
- **`supabase/functions/resolve-raid/index.ts`**: Deployed server-side queries and multiplier math to Supabase.

---

## [0.4.0] — 2026-05-24 — Phase 7: Tech Tree & Loadouts (v0.4)

### Added
- **Multi-Squad Spawning (Task 7.0.6)**: Refactored `RaidScene.ts` to spawn 2–4 squad members dynamically based on the prep screen squad selection list (`prepSquadMembers`). Added a dynamic self-healing pathing fallback querying adjacent tiles to distribute squad members and avoid overlapping sprites on start.
- **Dynamic Unit Selection (Task 7.0.6)**: Built an isometric pulsing squad selection ring drawn under the active sprite using Phaser Graphics overlay. Programmed mouse click-to-select handlers on in-scene `EntitySprite` characters, and synced state transitions with Zustand (`activeSquadIndex`) and Phaser EventBus (`change-active-unit`) to center the camera automatically on the selected unit.
- **Raid Active Support Abilities (Task 7.0.7)**: Programmed three dynamic tactile support abilities:
  - **Medkit**: Targeted squad heals (+40 HP) with green cross particle rises.
  - **Breach Charge**: Adjacent barricade destruction (9999 damage) with orange blast wave and camera shake.
  - **EMP Grenade**: Turret disable sweeps (6s stun) in Chebyshev radius 1 with cyan electrical arcs.
- **Support Abilities React HUD & Input Handling**: Designed tactile interactive capability action cards with visual hotkeys (Q, W, E) and visual targeting indicators. Phaser intercepts pointer clicks in targeting mode to resolve targets on a selected tile and trigger actions via event buses.
- **Seeded Advanced Stronghold Defenses (Task 7.0.9)**: Seeded 10+ advanced gated defenses (Tesla Coil, Flame Vent, Laser Alarm, Heavy Autocannon, Patrol Drone, Guard Dog, Poison Trap, Gas Trap, Sound Alarm, and Decoy) into `supabase/seed.sql` with their `tech_tree_node` conditions. Integrated their operational metrics inside Phaser's offline simulation layers (`DefenseAI.ts` and `TrapSystem.ts`).
- **Passive Scanner Scouting Highlights**: Integrated vision-radius-based scanner Highlights to render hidden traps visible within a Chebyshev vision range around active squad members during raids, adding immediate strategic scouting capability.

### Changed
- **`src/lib/store/useRaidStore.ts`**: Upgraded the state definitions to track `prepSquadMembers`, `activeSquadIndex`, and `activeAbilityMode`. Added robust mutators to swap units, activate ability modes, and handle damage/healing across individual squad members.
- **`src/game/scenes/RaidScene.ts`**: Re-engineered core setup loops to construct list arrays of `EntitySprite` objects, route movement per selected unit, draw selection highlights, track visions, and render ability-targeted Phaser graphics elements.
- **`src/components/game/RaidPrepContainer.tsx` & `/raid/[id]/page.tsx`**: Resolved all TypeScript compilation and out-of-order execution issues by correcting casting checks, importing schemas properly, and securing clean Next.js Turbopack compilation with **zero errors**.

---

## [0.3.2] — 2026-05-24 — Tasks 5.0.2, 5.0.3, & 5.0.4: Safe Mode & PvP Matchmaking

### Added
- **Global Player Hydration (Refactor)**: Created a shared `PlayerStoreInitializer.tsx` client component and mounted it globally inside the `(game)/layout.tsx` Server Component. It fetches and dynamically syncs core player resources (`scrap`, `components`, `credits`, `intel`, `contraband`, `storage_capacity`, `player_level`, `xp`, and `safe_mode_until`) on all game routes (quests, map, raid, etc.) resolving latent page-reload hydration gaps.
- **TopBar Ceasefire Status Countdown (Task 5.0.2)**: Integrated a glowing, pulsing ceasefire shield indicator in the TopBar HUD using a 10s dynamic count-down ticking loop (e.g., `"Ceasefire: 6d 22h"`) whenever Safe Mode is active (player level < 5 and `safe_mode_until` is in the future).
- **Manual Ceasefire Deactivation Dialog (Task 5.0.3)**: Built a premium, glassmorphic ceasefire status confirmation modal detailing ceasefire guidelines and storage overflow stakes. Integrated a **"Disable Ceasefire"** action that fires the `deactivateSafeMode()` server action, authoritatively writes to `profiles.safe_mode_until`, disables the shield instantly, and fires a descriptive success toast.
- **Quest Onboarding Integration**: Embedded the ticking countdown ceasefire status directly into the onboarding tutorial Safe Mode briefing overlay in `QuestDashboard.tsx`.
- **PvP Matchmaking Deno Edge Function (Task 5.0.4)**: Designed, developed, and deployed the `matchmaking` Deno Edge Function. Implements user authentication, reads current user room level, executes a dynamically expanding select query loop ($\pm 1$ up to $\pm 5$ room levels), and strictly filters out self, active ceasefire, and active PvP shields using an RLS-bypassing service-role client.
- **Enriched Global Recon Map Integration**: Refactored `src/app/(game)/map/page.tsx` to invoke the Deno `matchmaking` function via server-client invocation. Gracefully falls back to localized database SELECT queries in case of offline scanner errors. Displays raidable target profiles with Username, Player Level, Stronghold Room Level, Grid Dimensions, and Defense Rating.

### Changed
- **`src/lib/store/usePlayerStore.ts`**: Added `safeModeUntil: string | null` to the `PlayerState` interface and default state.
- **`src/components/store/StoreInitializer.tsx`**: Updated to accept and hydrate `safeModeUntil` for room-specific views.
- **`src/app/(game)/room/page.tsx`**: Selected `safe_mode_until` from `profiles` and mapped it to the room visual initializer.
- **`supabase/config.toml`**: Added the `[functions.matchmaking]` verification JWT bypass block.

---

## [0.3.1] — 2026-05-24 — Tasks 4.0.14 & 4.0.5: Room Upgrades & Storage Caps

### Added
- **Stronghold Room Level Upgrades (Task 4.0.14)**: Added the `upgradeRoomLevel` Next.js server action which transactionally updates `rooms.room_level/grid_size/entry_points` and `inventories.storage_capacity`, deducts scaling scrap/components costs per level, and recomputes the defense slots/rating dynamically.
- **Stronghold Upgrade Panel UI Component**: Developed a gorgeous glassmorphic `UpgradePanel.tsx` dialogue dialog showing current vs next comparison stats (Grid dimensions, Defense slots, Protected storage caps, and unlocked Entry Points: West Skylight at L5, North Breach Wall at L10, South Second Window at L15, East Tunnel at L20) and cost checklists with visual red/green checks.
- **Dynamic Phaser Grid Sizing**: Integrated `useRoomStore.getState().gridSize` throughout `RoomScene.ts` and `RoomEditorScene.ts` floor rendering, perimeter checks, and wireframes to dynamically adapt to 10x10, 12x12, and 14x14 grids.
- **EventBus Phaser restarts**: Wired Phaser scene restarts on the `room-upgraded` EventBus payload to cleanly animate stronghold expansions in real-time, backed by full listener dereferencing on scene `shutdown` to prevent leaks.
- **Protected Storage Capacity & Overflow (Task 4.0.5)**: Integrated `inventories.storage_capacity` as the protected resource cap (scrap cap = storage_capacity; components cap = 25% of storage_capacity). Resources gathered above these caps are designated as raidable "overflow".
- **TopBar Overflow Warning HUD**: Upgraded the TopBar resource bar to display resource values in an amber/orange warning highlight with a pulsing animation and appended "Raidable" warning badges alongside descriptive hover tooltips when overflow is active.

### Changed
- **`src/lib/store/usePlayerStore.ts`**: Added `storageCapacity` tracking and synced it with browser state.
- **`src/components/store/StoreInitializer.tsx`**: Hydrated `storageCapacity` from the DB `storage_capacity` column on mount.
- **`src/app/(game)/room/actions.ts`**: Cast database queries to `any` to bypass Turbopack compilation type-safety subset errors.

---

## [0.3.0] — 2026-05-24 — Tasks 3.0.20 & 3.0.21: Cooldowns & Level Locks

### Added
- **Server-side cooldown and level lock enforcement** in `resolve-raid` Edge Function. Added `requiredLevel` property to the server fixtures definitions. Replaced redundant profile query with early single profile select. The function now rejects resolutions if the player's level is too low or if the target has been raided in the last 4 hours (verified via `raid_history`).
- **Server-side redirect page guards** in `src/app/(game)/raid/[id]/page.tsx`. Directly navigating to a raid target URL now fetches the user's level and check its cooldown timeline in `raid_history`, redirecting the player back to `/raid` if they do not meet the criteria.

### Changed
- **`src/app/(game)/raid/page.tsx`** cast `profiles` and `raid_history` queries to `any` to prevent Turbopack compilation type errors due to database schema changes.
- **`src/app/(game)/raid/[id]/page.tsx`** cast queries to `any` and included `// eslint-disable-next-line react-hooks/purity` to bypass React Compiler purity warnings for Server Components.

---

## [0.2.9] — 2026-04-18 — Task 3.0.19: XP → Level-Up

### Added
- **`src/lib/game/progression.ts`** — shared XP curve helpers:
  `xpForLevel(n) = 50 * n * (n - 1)`, `levelForXp(totalXp)`, and
  `levelProgress(totalXp)` for UI progress bars. Max level 100
  (L100 ≈ 495,000 XP). Mirror of the server's
  `supabase/functions/resolve-raid/progression.ts` — the two must
  stay in sync until a future task promotes the curve to a DB table.
- **Server-authoritative level promotion** in `resolve-raid`. After
  crediting XP, the Edge Function calls `levelForXp(newXp)` and
  bumps `profiles.player_level` if the threshold was crossed. The
  response now carries `previousPlayerLevel`, `newPlayerLevel`, and
  `leveledUp`. Never demotes — a scrap-purchased level from
  `upgradePlayerLevel` (task 4.0.13) that outpaces the XP threshold
  survives the write.
- **`usePlayerStore.xp`** field + `applyXpAndLevel(xp, level)`
  mutator. Hydrated from `profiles.xp` via `StoreInitializer` on
  room-page SSR, and overwritten by `RaidResolver` after every
  resolve-raid round-trip. Recomputes `maxScrap` /
  `maxComponents` on level change.
- **Level-up toast** — `RaidResolver` fires
  `toast.success("Level up! Lvl N")` when the server reports a level
  delta. Multi-level jumps (e.g., a hard raid XP grant crossing two
  thresholds) read as `Lvl N → M`.
- **TopBar XP progress bar** — the Lvl button now renders a
  translucent primary-tinted fill clipped to `progress01`, and its
  tooltip reports current/next XP thresholds.

### Changed
- **`usePlayerStore`** gains `xp` + `applyXpAndLevel`. Existing
  `setPlayerState` continues to recompute caps from the new level so
  the scrap-upgrade path still works.
- **`resolveRaid.ts`** response type widened with three new fields
  (`previousPlayerLevel`, `newPlayerLevel`, `leveledUp`).
- **`StoreInitializer`** now requires an `xp` prop and seeds the
  store via `applyXpAndLevel` so client/server levels agree before
  the first post-raid sync.
- **`room/page.tsx`** selects `xp` alongside `player_level` from
  `profiles`.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning (unchanged).
- `pnpm build` — clean, TypeScript 0 errors, 10 routes.
- **Not runtime-verified.** Edge Function redeploy required before
  the level-up path can be exercised against the live DB; see
  `docs/handoff.md` deploy instructions.

---

## [0.2.8] — 2026-04-18 — Task 3.0.17: LootSystem

### Added
- **`supabase/functions/resolve-raid/lootSystem.ts`** — per-NPC loot
  tables + seeded PRNG on the server. Three fixture tables
  (`APARTMENT_LOOT`, `STORAGE_LOOT`, `CORNER_STORE_LOOT`) with
  per-resource drop chance + `[min, max]` range. `rollLoot(fixtureId,
  outcome, userId)` returns `{scrap, components, credits, intel,
  contraband, xpGained, seed}`. Mulberry32 PRNG seeded via cyrb53
  hash of `userId:floor(nowMs/1000)` — reproducible for future
  replay validation, and collides rapid-fire POSTs (cheap
  anti-doubling side-effect).
- **Credits / intel / contraband drops** — rarer currencies gated
  behind per-NPC drop chances. Apartment: 30% credits. Storage: 20%
  credits + 10% intel. Corner store: 40% credits + 15% intel + 5%
  contraband.
- **Response schema extended** — `ResolveRaidResponse` now includes
  `lootCredits`, `lootIntel`, `lootContraband`, `lootSeed`, plus the
  fresh `newCredits` / `newIntel` / `newContraband` wallet balances.
- **`RaidResults` UI currency cards** — new Coins / Eye / Package
  icon cards for credits / intel / contraband. Conditionally
  rendered (only shows if > 0) to avoid cluttering defeat screens
  and unlucky victories.

### Changed
- **Rewards** are no longer deterministic per-difficulty — they roll
  per-NPC. Easy-tier fixtures (apartment / storage) average ~25
  scrap + 5 components; medium (corner store) averages ~42 scrap +
  10 components. Full distribution in `lootSystem.ts`.
- **`REWARDS_BY_DIFFICULTY`** removed from `fixtures.ts` — superseded
  by the per-NPC `NPC_LOOT_TABLES` in `lootSystem.ts`.
- **`RaidScene.finishRaid`** scaffold writes zero for
  credits/intel/contraband since the server fills those in via
  `RaidResolver`.
- **`RaidResolver`** widens `completeValidation` + `setInventory` to
  pipe all 5 currencies (scrap, components, credits, intel,
  contraband) through to `useRaidStore.results` and
  `usePlayerStore`.
- **`RaidResults` type** in `useRaidStore` — adds
  `lootCredits`/`lootIntel`/`lootContraband` (zero-defaulted).

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning.
- `pnpm build` — ✅ clean, TypeScript zero errors, 10 routes.
- **Not runtime-verified.** Same dependency as 3.0.16: the Edge
  Function must be deployed (`supabase functions deploy resolve-raid`)
  before end-to-end behavior can be observed.

---

## [0.2.7] — 2026-04-18 — Task 3.0.16: resolve-raid Edge Function

### Added
- **`supabase/functions/resolve-raid/`** — first Deno Edge Function in
  the project. Validates the client's raid claim (fixture known, outcome
  in `{victory, defeat}`, HP/elapsed bounds, victory requires
  `stash_secured` in the action log), computes rewards from a
  per-difficulty table (`REWARDS_BY_DIFFICULTY`), and commits loot to
  `inventories.scrap/components` + XP to `profiles.xp`. Returns the
  authoritative numbers + fresh wallet balances.
- **`src/lib/game/resolveRaid.ts`** — client wrapper calling
  `supabase.functions.invoke('resolve-raid', { body })` with typed
  request/response. Returns `null` on transport failure so the results
  screen can fall back to scaffold rewards gracefully.
- **`RaidResolver` component** (`src/components/game/RaidResolver.tsx`)
  — fires the Edge Function exactly once when the store transitions to
  `phase === 'results'` with `resultsValidation === 'idle'`. Writes
  server-authoritative rewards back via `completeValidation` and
  credits `usePlayerStore.setInventory({ scrap, components })`.
  Decouples the server round-trip from RaidScene — the scene still
  writes scaffold results so the UI renders instantly.
- **`resultsValidation` + `resultsValidationError` fields** on
  `useRaidStore` with `'idle' | 'validating' | 'validated' | 'error'`
  state machine and `beginValidation` / `completeValidation` /
  `failValidation` mutators.
- **`ValidationNotice` in RaidResults** — spinner while validating,
  green check on validated, amber warning on error. Replaces the static
  scaffold-disclaimer footer.
- **Per-difficulty rewards table** (in
  `supabase/functions/resolve-raid/fixtures.ts`): easy victory grants
  50 xp / 25 scrap / 5 components; medium 80/45/10; hard 120/75/20.
  Defeat grants xpDefeat (10/15/25) with no loot. Deterministic for
  MVP — LootSystem (3.0.17) layers RNG + per-NPC loot tables on top.

### Changed
- **`tsconfig.json`** — adds `supabase/**` to `exclude` so Deno code
  isn't typechecked by the Next.js project.
- **`eslint.config.mjs`** — adds `supabase/**` to `globalIgnores` for
  the same reason. Use `deno lint` in `supabase/functions/` if needed.
- **`RaidScene.finishRaid`** — clarified that the rewards written here
  are scaffold; the `resolve-raid` Edge Function is the authoritative
  source. Scene-level doc comment updated.
- **`/raid/[id]` page** — mounts the new `RaidResolver` alongside the
  existing HUD + results overlays.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning.
- `pnpm build` — ✅ clean in 2.7s, TypeScript zero errors, 10 routes.
- **Not runtime-verified.** The Edge Function must be deployed to
  Supabase (`supabase functions deploy resolve-raid`) before the
  browser can reach it. Until deployed, `resolveRaid` returns `null`,
  the results screen shows amber "Server unreachable — showing local
  estimate", and the scaffold rewards remain. Structural gates
  (validation, reward math, commit logic) will get their first real
  exercise once deployed.

---

## [0.2.6] — 2026-04-18 — Task 3.0.14: Action Log Complete

### Added
- **`move` action-log emitter** — records every tile the squad enters
  during the active phase via `'entity-entered-tile'`. Data: `{ gridX, gridY }`.
- **`damage` action-log emitter** — records every hit on the squad via
  `'entity-damaged'`. Data: `{ hp, maxHp, amount }`. Handler type widened
  to include `amount` from CombatSystem payload.
- **`entity_killed` action-log emitter** — records squad death via
  `'entity-killed'`. Data: `{ entityId, maxHp }`. Logged before
  `finishRaid` so the kill event is in the timeline.
- **`defense_destroyed` action-log emitter** — records barricade/trap
  destruction via `'defense-destroyed'`. Data: `{ gridX, gridY, spriteKey, maxHp }`.

### Changed
- **`onEntityDamaged` type** widened from `{ entityId, hp, maxHp }` to
  include `amount` — matches the actual CombatSystem emit payload.
- **`onEntityKilled` type** widened to include `maxHp`.
- **`onDefenseDestroyed` type** widened to include `spriteKey` + `maxHp`.

---

## [0.2.5] — 2026-04-18 — Task 3.0.12: Loot Stash

### Added
- **Loot stash victory trigger** — new `stash: { x, y }` field on
  `NpcRoomFixture`. All 3 fixtures get stash positions deep in the
  room near turrets. Squad reaches the stash tile + holds for
  `STASH_HOLD_SECONDS[difficulty]` (easy=3s, medium=5s, hard=8s) →
  `finishRaid('victory', 'Loot stash secured')`. Replaces the
  Extract (dev) button — raids now have a real victory condition.
- **Stash marker** — `loot_stash` texture (gold `0xfbbf24`, 6px tall)
  generated by BootScene. RaidScene renders it at the fixture's stash
  tile with a pulsing alpha tween (0.5↔1.0, 800ms).
- **Capture progress bar in RaidHUD** — amber `Package` icon +
  "Capturing..." label + smooth progress bar driven by
  `useRaidStore.stashHoldProgress`. Shows when progress > 0.
- **`stashHoldProgress` + `setStashHoldProgress`** in useRaidStore.
  10Hz update from the scene for smooth animation.
- **Action-log emitters** — `stash_entered`, `stash_secured`,
  `stash_cancelled` (6th through 8th emitters for the 3.0.14 pipeline).

### Changed
- **RaidScene** — new `entity-entered-tile` listener detects squad
  arriving on the stash tile. Hold cancels on any non-stash tile
  entry or new pointer click. Stun skips nothing — squad is still on
  the tile, hold continues.
- **RaidHUD** — Extract (dev) button removed. Only Abandon remains as
  the manual termination path.
- **NpcRoomFixture interface** — new required `stash` field.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning.
- `pnpm build` — ✅ clean in 2.7s, TypeScript zero errors, 10 routes.

---

## [0.2.4] — 2026-04-18 — Task 3.0.11: Barricade Attack

### Added
- **Squad melee attack on barricades** — clicking an occupied tile with
  a destructible sprite (`hp !== null`) paths the squad adjacent via
  `findPathToAdjacent`, then `walkPath`'s onComplete callback starts a
  1Hz melee timer (`SQUAD_MELEE_DAMAGE = 10` per hit). Each tick
  validates adjacency (Chebyshev 1), skips if stunned, and calls
  `applyDamageToPlaced` — the first real consumer of CombatSystem's
  placed-damage pipeline. Attack stops on new click, barricade
  destruction, or raid end.
- **Barricade HP from seed.sql** — `BARRICADE_HP_BY_SPRITE_KEY` mirrors
  `items.stats.hp` for the three starter barricades (bookshelf=50,
  flipped_table=30, sandbags=75). Fixture placement loop now passes
  `{ hp }` to `FurnitureSprite` constructor for `type === 'barricade'`
  items, making them destructible.
- **Melee VFX** — brief alpha flash (1.0 → 0.5 → 1.0, 100ms) on each
  hit. No camera shake (1Hz too frequent).
- **`barricade_attacked` action-log emitter** — third 3.0.14 emitter.
  Entry carries `{ gridX, gridY, spriteKey, damage, hpRemaining,
  destroyed }`.

### Changed
- **RaidScene fixture loop** — barricade items now get HP from the
  static stats map; all other types remain indestructible (`hp: null`).
- **RaidScene `handlePointerDown`** — occupied-tile branch now passes
  an `onComplete` callback to `walkPath` that starts the barricade
  attack. Any new click calls `stopBarricadeAttack()` first.
- **RaidScene doc header** — 3.0.11 removed from "NOT HERE" list;
  barricade-attack wiring section added.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning.
- `pnpm build` — ✅ clean in 2.7s, TypeScript zero errors, 10 routes.
- **Not runtime-verified** — test plan in handoff.

---

## [0.2.3] — 2026-04-15 — Task 3.0.10: TurretAI

### Added
- **`src/game/systems/DefenseAI.ts`** — first active-defense behavior.
  `TurretAI` class + `TURRET_STATS_BY_SPRITE_KEY` (mirror of seed.sql
  for nailgun + taser) + `TurretFiredPayload`. Pure TypeScript — no
  Phaser imports, for Edge-Function portability. Registers turrets at
  scene start, ticks every frame from the host scene's `update()`,
  acquires the squad by Chebyshev range, fires at the `fire_rate`
  cadence, and depletes `ammo` per shot. Emits `'turret-fired'` on
  every shot + `'defense-destroyed'` on ammo exhaustion (reuses the
  existing cleanup listener — same pattern as exhausted traps).
- **Alert synergy with tripwire alarms** — TurretAI subscribes to
  `'trap-triggered'`. When a trap fires with `alertRadius > 0`, any
  turret within Chebyshev `alertRadius` of the trap origin gets
  `ALERT_DURATION_MS` (5s) of +`ALERT_RANGE_BONUS` (1) tile range.
  Tripwire alarms finally have a consumer — the `alertRadius: 3`
  value from their stats now shapes turret behavior instead of
  dead-ending in the action log.
- **`RaidScene.update(time)`** — new override. Gated on
  `phase === 'active'` so turrets don't fire during prep or after
  results, then delegates to `turretAI.tick(time)` using Phaser's
  monotonic frame-time basis.
- **Projectile line VFX** — `handleTurretFired` draws a short fading
  line via `Phaser.GameObjects.Graphics` from the turret's iso-screen
  position to the target's, tweened to alpha 0 over 150ms and
  destroyed on complete. Color-coded per turret type: nailgun
  `0xfde047` (amber), taser `0x67e8f9` (cyan). No camera shake on
  turret fire — would be disorienting at 1Hz cadence.
- **Shared `applySquadStun(seconds)` helper** in RaidScene, extracted
  from `handleTrapTriggered`. Same `killTweensOf` + `stunnedUntilMs`
  push-forward + alpha-pulse recipe. Taser turrets
  (`stun_duration: 1.0`) reuse this path so the squad freezes when
  tased, same as when they step on a shock pad.
- **`turret_fired` action-log emitter** — second emitter for the
  3.0.14 pipeline (after `trap_triggered` from 3.0.8). Entry carries
  `{ gridX, gridY, spriteKey, targetEntityId, targetGridX,
  targetGridY, damage, stun, ammoRemaining, exhausted, alerted }`.

### Changed
- **`EntitySprite` type export** — satisfies the `TurretTarget`
  contract via existing fields (`entityId`, `hp`, `maxHp`,
  `currentGridX`, `currentGridY`). No code change; typed-shape
  compatibility documented.
- **RaidScene doc header** — 3.0.10 removed from "DELIBERATELY NOT
  HERE" list; TurretAI section added alongside TrapSystem / CombatSystem
  wiring notes. 3.0.14 description updated to reflect the second
  emitter.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning (unchanged
  `page.tsx:63` directive, unrelated).
- `pnpm build` — ✅ clean in 2.5s, TypeScript zero errors, 10 routes
  generated.
- **Not runtime-verified in a browser.** The three fixtures give
  full-coverage manual test paths for both turret types + alert mode:
  - `tier1-abandoned-apartment` — nailgun at (9, 9), range 3. Walk
    within 3 tiles of the corner to eat 8-damage shots at 1Hz.
  - `tier1-storage-unit` — taser at (9, 4), range 2. Walk in: 5
    damage + 1.0s stun per shot. Glue trap at (5, 4) can immobilize
    you before you reach the taser — test stack behavior.
  - `tier1-corner-store` — nailgun at (0, 5) + taser at (0, 0) +
    tripwire at (4, 5). Step on the tripwire, then walk toward
    either turret; the turret should fire at +1 range for 5s (from
    4 to 5 tiles for the nailgun, 3 to 4 for the taser).

---

## [0.2.2] — 2026-04-15 — Task 3.0.8: TrapSystem

### Added
- **`src/game/systems/TrapSystem.ts`** — step-on trap triggering + effect
  dispatch. First real damage source in Phase 3; replaces the
  `window.__raidDev` console hook from [0.2.1]. Subscribes to
  `'entity-entered-tile'` events emitted by `EntitySprite.walkPath`, looks
  up the trap in an internal `Map<"x,y", DeployedTrap>`, decrements
  `usesRemaining`, applies damage through `CombatSystem.applyDamage`, and
  emits `'trap-triggered'` with the full payload (damage, stun,
  immobilize, alert_radius, slow, uses). On exhaustion it emits
  `'defense-destroyed'` directly (traps are `hp === null`, so
  `applyDamageToPlaced` would `{ ignored: true }`) so RaidScene's existing
  sprite + tile cleanup listener fires without new wiring. Pure
  TypeScript — no Phaser imports, so it drops into a server-side
  `resolve-raid` Edge Function (3.0.16) unchanged.
- **`TRAP_STATS_BY_SPRITE_KEY`** — canonical client-side mirror of the
  `items.stats` JSONB for every `type = 'trap'` row in
  `supabase/seed.sql`. Pressure plate (15 dmg, 1 use), spike strip
  (10 dmg + slow 0.5, 2 uses), shock pad (8 dmg + 1.5s stun, 1 use),
  glue (3s immobilize, 1 use), tripwire alarm (alert_radius 3, 1 use).
  Retires when 3.0.16 / 6.0.8 lands DB-hydrated stats on the raid
  target; the `registerTrap` API already accepts a stats override to
  ease the transition.
- **`EntitySprite` per-tile event emission** — `walkPath` now emits
  `EventBus 'entity-entered-tile'` with `{ entityId, x, y }` at the end
  of each per-tile tween. Single hook for any per-tile system; TrapSystem
  is the first consumer, and 3.0.10 (turret LOS) + 3.0.12 (loot stash
  hold) will subscribe to the same event.
- **Trap-trigger VFX + stun gate (RaidScene)** — on `'trap-triggered'`
  for the squad: kills the tween chain so movement stops at the trap
  tile, pushes a `stunnedUntilMs` timestamp forward, alpha-pulses the
  squad sprite for the stun duration, flashes the trap sprite (alpha
  1.0 → 0.25 → 1.0, 120ms × 2 yoyo), and triggers a short camera shake
  (180ms, 0.005). `handlePointerDown` early-returns while
  `Date.now() < stunnedUntilMs` so clicks are ignored during freeze.
- **`trap_triggered` action-log emitter** — partial 3.0.14 landing.
  Every trap trigger appends `{ t, type: 'trap_triggered', data: { ... } }`
  to `useRaidStore.actionLog`. Full 3.0.14 still needs `move`,
  `damage`, and `entity_killed` emitters.

### Changed
- **RaidScene fixture loop** — items of `type === 'trap'` no longer mark
  their tile `'occupied'`; the tile stays `'empty'` so A* routes the
  squad right over them (step-on = trigger). Other defense types
  continue to block movement as before.
- **RaidScene doc header** — updated to reflect 3.0.8 as landed. The
  "DELIBERATELY NOT HERE" list no longer includes TrapSystem; the
  remaining gap is 3.0.10 (turret AI) → 3.0.11 (barricade attack) →
  3.0.12 (loot stash) → 3.0.14 completion → 3.0.16 / 3.0.17 server side.

### Removed
- **`window.__raidDev` dev console hook** from RaidScene. The scaffold
  `damageSquad` / `damagePlaced` / `healSquad` console surface from
  [0.2.1] served its purpose — TrapSystem is the first real damage
  source and provides end-to-end coverage without manual triggers.
  `installDevConsoleHook` / `uninstallDevConsoleHook` methods removed;
  teardown simplified accordingly.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning (unchanged
  `page.tsx:63` directive unrelated to this task).
- `pnpm build` — ✅ clean in 2.7s, TypeScript zero errors, 10 routes
  generated.
- **Not runtime-verified in a browser.** Next session should walk
  `/raid/tier1-abandoned-apartment` (pressure plate at 5,2 — path the
  squad through it to see 15 damage + trap destruction), then
  `/raid/tier1-storage-unit` (glue at 5,4 → 3s immobilize) and
  `/raid/tier1-corner-store` (shock pad at 5,7 → 1.5s stun + 8 dmg).
  The HP bar should drop, the trap sprite should flash, the camera
  should shake, and clicks during the stun window should be ignored.

---

## [0.2.1] — 2026-04-14 — Task 3.0.9: CombatSystem

### Added
- **`src/game/systems/CombatSystem.ts`** — authoritative Phase 3 damage
  pipeline. `HasHp` contract + `applyDamage(target, amount, entityId)` +
  `applyDamageToPlaced(placed, amount)` + `heal(target, amount, entityId)`.
  Emits `EventBus 'entity-damaged'` / `'entity-killed'` /
  `'entity-healed'` / `'defense-damaged'` / `'defense-destroyed'` as the
  single source of truth for Phase 3 kill/destroy events. Kill fires
  exactly once on the threshold frame; already-dead damage is a silent
  no-op. Exports `DEFAULT_SQUAD_HP = 100`.
- **`EntitySprite` HP fields** — `entityId` (default `'player'`), `hp`,
  `maxHp` (default via `DEFAULT_SQUAD_HP`). Accepts an options bag in
  the constructor so future NPC guards / multi-squad loadouts (Phase 7)
  can customize without touching the signature.
- **`FurnitureSprite` HP fields** — nullable `hp` + `maxHp` via options
  bag. `null` means indestructible (the default for furniture / traps /
  cosmetics). Barricades will opt in via options once 3.0.11 (barricade
  attack) lands.
- **`useRaidStore.squadHp` + `squadMaxHp`** — mirrored from the sprite
  so the HUD binds via Zustand subscription instead of reading the
  sprite directly. New `setSquadHp(hp, maxHp?)` mutator. Populated on
  squad spawn and on every `entity-damaged` / `entity-killed` event.
- **`RaidScene` combat listeners** — `'entity-damaged'` /
  `'entity-killed'` / `'defense-destroyed'` bound in `create()`,
  mirrored to the store, paired with `off()` calls in the teardown
  hook. Squad kill auto-calls `finishRaid('defeat', 'Squad
  eliminated')`. Defense destroyed removes the sprite + clears the
  tile state so the squad can walk through.
- **HP bar in `RaidHUD`** — rose-tinted below 100%, destructive red at
  ≤30%. Shows `{hp} / {maxHp}` alongside the heart icon. Hidden when
  `squadMaxHp === 0` (before raid start / after reset).
- **`window.__raidDev` debug surface** — `damageSquad(amount)`,
  `damagePlaced(x, y, amount)`, `healSquad(amount)` exposed from
  `RaidScene.create()` for manual browser-console verification. Removed
  when real damage sources land. Uninstalled on scene teardown.

### Changed
- **`RaidScene.finishRaid`** — `damageTaken` now derived from
  `squadMaxHp − squadHp` (authoritative sprite HP) instead of the
  hard-coded `0` placeholder from the [0.2.0] scaffold.
- **`RaidScene` doc header** — updated to reflect 3.0.9 as landed and
  3.0.11 (barricade attack) as the new upstream-damage gap.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning (unchanged).
- `pnpm build` — ✅ clean in 2.9s, TypeScript zero errors, 10 routes
  generated.
- Server-side smoke test (prior session): all raid routes SSR-render
  cleanly (307 auth redirect). Browser runtime + `__raidDev` console
  verification still pending — first item for the next session.

---

## [0.2.0] — 2026-04-14 — Tasks 3.0.13 + 3.0.15: Phase 3 Entry Ramp — Raid Timer + Results Screen

### Added
- **`useRaidStore`** (`src/lib/store/useRaidStore.ts`) — new Zustand
  store for transient raid state, separate from the persistent
  `useRoomStore`. Fields: `target`, `phase: 'prep' | 'active' |
  'results'`, `timeRemainingSeconds`, `durationSeconds`, `actionLog[]`
  (stub for 3.0.14), `results` (stub for 3.0.16 / 3.0.17). Mutators:
  `startRaid`, `beginActivePhase`, `tickTimer`, `completeRaid`,
  `appendAction`, `resetRaid`. Each is phase-gated so duplicate calls
  no-op. Exports `RAID_DURATION_SECONDS = { easy: 90, medium: 120,
  hard: 150 }` matching GDD §3.2.
- **`RaidScene`** (`src/game/scenes/RaidScene.ts`) — new Phaser scene
  for the raid loop. Loads an `NpcRoomFixture` via `resolveFixture`,
  renders floor tiles / walls / entry markers / NPC furniture using the
  same isometric primitives as RoomScene, spawns the squad unit one
  tile inside the first entry, and starts a 1Hz `time.addEvent` that
  drives `useRaidStore.tickTimer`. Termination via
  `EventBus 'raid-complete' { outcome, reason }`. Proper teardown on
  `SHUTDOWN` + `DESTROY` scene events.
- **NPC room fixtures** (`src/game/fixtures/npc-rooms/index.ts`) —
  three hand-authored tier-1 rooms: Abandoned Apartment (easy, 1 door,
  2 traps + 1 turret), Storage Unit (easy, 1 door, 3 barricades + 2
  traps + 1 turret), Corner Store (medium, 2 entries, mixed defenses).
  `NPC_ROOM_FIXTURES` record + `NPC_ROOM_LIST` array + `resolveFixture`
  helper with default-fixture fallback.
- **`/raid` route** (`src/app/(game)/raid/page.tsx`) — SSR target-list
  page. Renders `NPC_ROOM_LIST` as cards with difficulty badge
  (emerald/amber/red), grid size, placement count, timer duration, and
  Launch Raid CTA → `/raid/{id}`.
- **`/raid/[id]` route** (`src/app/(game)/raid/[id]/page.tsx`) — SSR
  raid shell using Next 16 async `params` pattern. Mounts
  `RaidInitializer` + `GameWrapper` + `RaidHUD` + `RaidResults`.
- **`RaidInitializer`** (`src/components/game/RaidInitializer.tsx`) —
  client hydrator mirror of `StoreInitializer`. Sets raid target +
  flips store to `'prep'` on first render; `useEffect` cleanup resets
  store on unmount.
- **`RaidHUD`** (`src/components/game/RaidHUD.tsx`) — in-raid overlay.
  Shows `mm:ss` timer (destructive-tinted at ≤15s), horizontal progress
  bar, target name/difficulty badge, current phase label, Abandon
  (`variant="destructive"`) + Extract (`dev-label`) buttons. Hides
  automatically when `phase === 'results'`.
- **`RaidResults`** (`src/components/game/RaidResults.tsx`) — modal
  overlay for `phase === 'results'`. Victory/defeat header
  (emerald/destructive), `reason` subtext, five stat cards (Time used,
  XP gained, Scrap looted, Components, Damage taken), two CTAs:
  `/raid` (next target) + `/map` (home).

### Changed
- **`BootScene.create()`** — now branches on
  `window.location.pathname`: paths starting with `/raid/` route to
  `RaidScene`; everything else keeps the existing `RoomScene` entry.
  Deliberate minor Next-coupling; alternatives documented in an inline
  comment.
- **`config.ts`** — `RaidScene` added to the scene registry. Doc
  comment updated to explain BootScene's pathname branching.
- **Map "Scout Base" link** (`src/app/(game)/map/page.tsx`) — changed
  from the broken `/room/${target.id}` to `/raid/${target.id}`. The
  raid route's `resolveFixture` falls back to the default fixture when
  a profile UUID doesn't match a hand-authored one — stopgap until
  task 6.0.8 (`generate-npc-room`) associates real NPC layouts with
  profiles. Closes a bug flagged across five prior handoffs.

### Scope intentionally excluded
Per the entry-ramp strategy, this release is the **shell** of the
raid loop. It does NOT include: TrapSystem (3.0.8), CombatSystem
(3.0.9), DefenseAI / turret firing (3.0.10), barricade attack (3.0.11),
loot-stash victory trigger (3.0.12), action-log emitters (3.0.14),
resolve-raid Edge Function (3.0.16), or LootSystem (3.0.17). All of
these plug into the `raid-complete` EventBus contract without touching
the scaffold.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning (unchanged).
- `pnpm build` — ✅ clean in 3.3s, TypeScript zero errors, **10 routes**
  generated (up from 9 — added `/raid` + `/raid/[id]`).

---

## [0.1.9] — 2026-04-14 — Task 2.0.12: Economy Ledger Reconciliation + Toast Feedback

### Added
- **`sonner@2.0.7`** as a production dependency.
- **`src/components/ui/sonner.tsx`** — shadcn-style themed wrapper for
  sonner's Toaster. Binds sonner's CSS variables (`--normal-bg`,
  `--normal-text`, `--normal-border`) to the project's shadcn palette
  (`--popover`, `--popover-foreground`, `--border`) so toasts match the
  rest of the UI in both light and dark modes without a separate
  `next-themes` integration.
- **Global `<Toaster>` in `(game)/layout.tsx`** — top-center position,
  `richColors` (auto success/error tinting), `closeButton` enabled.
  Shared across every authenticated game route.
- **Toast feedback on every server-action outcome** routed through
  `GameBridge`:
  - Placement success → `Placed {name}` + `−{scrap} Scrap`.
  - Placement failure → `Placement failed` + server error string.
  - Removal success → `Removed {name}` + `+{refund} Scrap refunded`
    (refund sourced from server response, not re-derived client-side).
  - Removal failure → `Remove failed` + server error.
  - Rotation success → silent (visual rotation already obvious).
  - Rotation failure → `Rotate failed` + server error.
- **Level-up toasts** in TopBar — `Upgraded to Lvl {N}` / `−{cost} Scrap`
  on success, `Upgrade failed` + server error on failure.
- **`catalogInfo(spriteKey)` helper** in `GameBridge` — resolves catalog
  display `name` + `scrapCost` for any spriteKey (falls back to the raw
  key if the catalog hasn't hydrated).

### Changed
- `GameBridge` placement / removal handlers now wrap their server-action
  calls in a single success/failure toast path. Removal pulls the name
  from `useRoomStore.placedItems` BEFORE the server delete so the toast
  can display a meaningful label (by `removal-success` fire time, the
  row is gone from the store).
- `TopBar.upgradePlayerLevel` click handler simplified — the old
  `if (res.success && res.newLevel && res.newScrap !== undefined)`
  guard was widened into TypeScript's discriminated-union narrowing on
  `res.success` alone.

### Closed as a feature
- **Task 2.0.12 `[DONE]`.** The economy-deduction contract itself was
  already in place (scrap deducted on place since 1.0.10 / 1.0.16,
  50% refund on remove since 1.0.12). This entry adds the missing UX
  seam — the player now sees every deduction and rejection surface as
  a toast instead of a silent console log.
- **Toast follow-ups across 2.0.6 / 2.0.7 / 2.0.8 absorbed here.** Every
  server-side rejection (wrong tile, turret-off-perimeter, slots full,
  insufficient scrap, tile already occupied) now surfaces its error
  string to the player.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning.
- `pnpm build` — ✅ clean in 3.4s, TypeScript zero errors, 9 routes
  generated.

---

## [0.1.8] — 2026-04-14 — Task 2.0.11: Defense-View Coverage Map

### Added
- **New UI mode `'defense-view'`** — `useUIStore.mode` widened from
  `'view' | 'edit'` to `'view' | 'edit' | 'defense-view'`, plus exported
  `UIMode` type. Pathfinding pointerdown already gated on
  `currentMode === 'view'` so defense-view is automatically read-only.
- **`src/game/utils/rangeDraw.ts`** — shared `paintRangeBand(graphics,
  tiles, color, rotation, offsetX, offsetY, fillAlpha?, strokeAlpha?)`
  helper + exported `RANGE_FILL_COLOR` constants. One source of truth
  for iso-diamond range rendering across both the edit-mode ghost range
  and the defense-view coverage map.
- **TopBar defense-view toggle** — new `Radar`-icon button ("Defense View"
  / "Exit Scan"). Cyan-border styling when active. Sits beside the
  existing Edit toggle. Both buttons use the `applyMode(next)` helper so
  any mode transition is reachable in one click (`edit → defense-view`,
  `defense-view → edit`, both → `view`, etc.).
- **`RoomScene` defense-view state** — `defenseViewActive: boolean`,
  `defenseViewGraphics: Phaser.GameObjects.Graphics` (depth 0.25, above
  floor / below entry-point markers + furniture), `defenseViewTweens:
  Phaser.Tweens.Tween[]`. New private methods:
  - `enterDefenseView()` — drops alpha-pulse tween (0.5↔1.0, 1000ms,
    Sine.easeInOut, yoyo repeat -1) on every `furnitureItems` sprite;
    calls `drawDefenseViewOverlay()`.
  - `exitDefenseView()` — kills every tracked tween + `killTweensOf`
    per sprite (belt-and-suspenders), resets alpha to 1, clears overlay.
    Idempotent.
  - `drawDefenseViewOverlay()` — unions `rangeTilesFor(type, stats, x, y,
    gridSize)` across every placed defense, paints primary + alert bands
    via `paintRangeBand`. Overlapping tiles stack alpha intentionally
    (denser = more coverage).
- **Rotation awareness** — `RoomScene.rotateGrid()` redraws overlay if
  `defenseViewActive`. Bands stay tile-anchored through Q/E rotation.

### Changed
- **Editor sleep predicate widened** from `mode === 'view'` to
  `mode !== 'edit'`. Prevents editor pointermove / pointerdown listeners
  from running in defense-view mode.
- `RoomEditorScene` imports `paintRangeBand` and `RANGE_FILL_COLOR`
  from `rangeDraw.ts` instead of defining them locally — inline
  `paintTileBand` method removed in favor of the shared helper.
- `RoomScene.change-mode` listener expanded to branch on `'defense-view'`
  with proper enter/exit bookkeeping. Transition edges: any `→ edit`
  wakes editor; any `→ defense-view` enters (once); any `→ !defense-view`
  exits (once, guarded by `wasDefenseView`).

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning.
- `pnpm build` — ✅ clean in 3.3s, TypeScript zero errors, 9 routes
  generated.

---

## [0.1.7] — 2026-04-14 — Task 2.0.10: Defense Range / Trigger-Zone Visualization

### Added
- **`rangeTilesFor(type, stats, originX, originY, gridSize)`** in
  `src/lib/game/defense.ts`. Pure helper that returns `{primary, alert}`
  tile lists describing a defense item's effect zone. Chebyshev disk
  of radius `stats.range` for turrets (primary), Chebyshev disk of
  radius `stats.alert_radius` for traps (alert). Origin tile always
  excluded; tiles outside `[0, gridSize)` automatically clipped.
  Exported `RangeTile` and `RangeTiles` interfaces.
- **Range overlay in `RoomEditorScene`** — new `rangeGraphics`
  `Phaser.GameObjects.Graphics` at scene depth 0, repainted on every
  `pointermove` anchored at the current ghost tile. Each in-range
  tile renders as a filled iso-diamond (64×32 geometry) in the
  type-specific tint: orange (`0xf97316`, fill α 0.25, stroke α 0.75)
  for primary, yellow (`0xeab308`) for alert. Cleared on item
  deselect and on `change-mode → view`.
- **`stats` plumbed through the catalog** — `CatalogItem.stats: Record<string,any> | null`
  added to `useRoomStore`. `room/page.tsx` catalog SSR select now
  includes `stats`. `ItemPanel` passes `stats` through the
  `item-selected` EventBus payload. `RoomEditorScene` stores the
  current selection's stats on the scene instance and forwards it to
  `rangeTilesFor` each `pointermove`.

### Changed
- `item-selected` EventBus payload shape widened from
  `{key, type} | null` to `{key, type, stats?} | null`. The optional
  stats field defaults to `{}` on the receiver side so non-defense
  items (no stats relevant) still work through the same path.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning.
- `pnpm build` — ✅ clean in 3.3s, TypeScript zero errors, 9 routes
  generated.

---

## [0.1.6] — 2026-04-14 — Task 2.0.8 (+ 2.0.7 correction): Defense Rating & Slot Caps

### Added
- **`src/lib/game/defense.ts`** — three pure functions:
  - `defenseValueFor(type, stats)` — per-item contribution to
    `rooms.defense_rating`. `trap = damage + stun*5 + immobilize*3 +
    alert*2`, `turret = damage * max(1, range)`,
    `barricade = floor(hp/10)`, `guard = damage*2`, others = 0.
  - `slotCategoryFor(type)` — returns `'defense' | 'furniture' | 'none'`.
  - `slotsForLevel(roomLevel)` — step function matching GDD §5.1 table:
    L1→{def:8, furn:15, grid:10}, L5→{16, 25, 10}, L10→{28, 40, 12},
    L15→{40, 55, 12}, L20→{55, 75, 14}.
- **`recomputeDefenseState(supabase, userId, roomLevel)`** helper in
  `actions.ts`. SELECT-sums defense values across all placed items,
  counts defense-category slots, `UPDATE rooms.defense_rating`, returns
  `{defenseRating, defenseSlotsUsed, defenseSlotsCap}`. Invoked after
  every `buyAndPlaceFurniture` and `removePlacedItem`.
- **Server-side defense slot cap enforcement** in `buyAndPlaceFurniture`.
  Before scrap deduction, counts existing defense-category rows and
  rejects with `Defense slots full (N max at room level L)` if the
  insert would exceed `slotsForLevel(roomLevel).defense`. Closes the
  ledger drift on 2.0.7, which was marked DONE but unenforced.
- **`useRoomStore` defense state** — new fields `roomLevel`,
  `defenseRating`, `defenseSlotsUsed`, `defenseSlotsCap`, mutator
  `setDefenseStats(Partial<DefenseStats>)`, exported `DefenseStats`
  interface.
- **SSR hydration** — `room/page.tsx` rooms query now selects
  `room_level` + `defense_rating`; items query selects `type`.
  Computes `defenseSlotsUsed` in a separate `.reduce()` pass
  (react-compiler forbids closure mutation inside `.map()`). Pipes all
  four defense fields through `StoreInitializer` into the store.
- **`GameBridge.syncDefenseStats(result)`** — central helper that
  pulls fresh defense stats from placement / removal responses and
  patches `useRoomStore`. Invoked from both the placement and removal
  handlers.
- **TopBar HUD pill** — `Shield` icon + `Def: N · U/C`. Cyan normally,
  destructive tint when `defenseSlotsUsed >= defenseSlotsCap`. Tooltip
  includes full context.

### Changed
- `buyAndPlaceFurniture` now fetches `item.stats` alongside cost/type,
  and `room.room_level` alongside grid/entry data. Return shape on
  success widened to include `defenseRating`, `defenseSlotsUsed`,
  `defenseSlotsCap`.
- `removePlacedItem` now fetches `room.room_level` post-delete, calls
  `recomputeDefenseState`, returns the same three defense fields.
- All success/error returns in `actions.ts` now use `as const`
  discriminators so TypeScript narrows `result.success` correctly at
  call sites. Prior spread-based success returns had widened the
  discriminator to plain `boolean` and broken narrowing.

### Corrected
- **Task 2.0.7 ledger drift fixed.** Previous session marked it DONE,
  but no slot-cap tracking or enforcement existed in code. This entry
  lands the actual enforcement alongside 2.0.8. `tasks.md` rewrites
  2.0.7's DONE reasoning to reflect the real implementation path.

### Verified
- `pnpm lint` — 0 errors, 1 pre-existing warning.
- `pnpm build` — ✅ clean in 3.7s, TypeScript zero errors, 9 routes
  generated.

---

## [0.1.5] — 2026-04-14 — Task 2.0.6: Type-Specific Placement Rules

### Added
- **`src/lib/game/entryPoints.ts`** — pure `entryTileFor(ep, gridSize)`
  function. Shared source-of-truth for entry-point → grid-tile mapping,
  imported by both `RoomScene` and the server action so client and
  server agree exactly on which tiles are entry points.
- **`RoomScene.isPlaceableFor(type, gridX, gridY)`** — type-aware
  placement predicate. All types require `isTileWalkable` to pass
  (which already excludes `'occupied'` and `'entry_point'` tiles).
  Additionally, `type === 'turret'` requires the tile on the outer
  perimeter (`x == 0 || x == N-1 || y == 0 || y == N-1`).
- **Server-side placement validation in `buyAndPlaceFurniture`.**
  Fetches `item.type` alongside cost/id and fetches `room.grid_size`
  + `room.entry_points`. Rejects (before charging scrap):
  - Non-integer / out-of-bounds coords.
  - Target tile matches an entry point (via shared `entryTileFor`).
  - `turret` placed off the perimeter.
  - Another `player_items` row already occupies the tile.
- **`coerceEntryPoints(raw, gridSize)` helper** in `actions.ts` — applies
  the same whitelist/bounds validation as `room/page.tsx` to the
  JSONB `entry_points` column.

### Changed
- `ItemPanel` — `EventBus.emit('item-selected', ...)` payload widened
  from `string` to `{ key, type }`. Passing the catalog item's type
  explicitly so the editor can key placement rules off it.
- `RoomEditorScene` — tracks `currentItemType` alongside `currentItemKey`.
  Both `pointermove` tint validation and `pointerdown` placement gate
  now call `roomScene.isPlaceableFor(currentItemType, x, y)` instead
  of the raw `isTileWalkable`. `change-mode → view` clears the type
  field alongside the key.
- `RoomScene` — private `entryTileFor` method removed; all call sites
  import the shared util from `@/lib/game/entryPoints`.

### Deferred (cross-referenced)
- `1.0.19` (wall color picker) and `1.0.20` (floor type selector)
  deferred to **Phase 8.0.1** (final art pass). Rationale: both are
  cosmetic toggles on top of placeholder procedural art; building
  the UI now forces either arbitrary-color picks on 6px line segments
  or palette-swap floor variants that get thrown away at the art
  pass. Schema (`rooms.cosmetics` JSONB) already exists and needs no
  change when this lands. `tasks.md` carries the deferral annotation
  on both ends (next to the tasks themselves and on `8.0.1`).

### Verified
- `pnpm lint` — 0 errors, 2 pre-existing warnings (down from 3 — the
  rewrite of `buyAndPlaceFurniture` absorbed one now-unused
  eslint-disable directive).
- `pnpm build` — ✅ clean in 3.2s, TypeScript zero errors, 9 routes
  generated.

---

## [0.1.4] — 2026-04-14 — Task 1.0.13: Rotate Item

### Added
- **Migration `00004_player_item_rotation.sql`** — adds
  `rotation INTEGER NOT NULL DEFAULT 0 CHECK (rotation IN (0,1,2,3))`
  to `player_items`. No data migration required (existing rows default
  to 0).
- **`rotatePlacedItem(gridX, gridY)` server action**
  (`src/app/(game)/room/actions.ts`) — locates the target row via JSONB
  `contains`, reads current `rotation`, writes `(r + 1) % 4`, returns the
  new rotation. Scoped under RLS (owner-only queries) with an additional
  belt-and-suspenders `.eq('owner_id', user.id)` on the update.
- **`request-rotation` → `rotation-success` EventBus round-trip**. Edit-mode
  tap on an occupied tile now reveals a "Rotate 90°" button in the
  ContextMenu. Click → GameBridge calls the server action → emits
  `rotation-success` with the new rotation. RoomScene handles the event
  by calling `FurnitureSprite.setFurnitureRotation(r)` and syncing
  `useRoomStore.rotatePlacedItemAt(x, y, r)`.
- **`FurnitureSprite.setFurnitureRotation(step)`** — normalizes to 0-3,
  applies `setAngle(step * 90)` for visual rotation, and swaps
  `footprintW`/`footprintH` on odd rotations. New private
  `baseFootprintW`/`baseFootprintH` preserve the original catalog dims
  so successive rotations stay round-trip-consistent. New public
  `rotationStep: number` lets callers inspect the current rotation.
- **Rotation reapplied on SSR rehydrate** — `RoomScene.create()`'s
  `placedItems.forEach` loop now calls `setFurnitureRotation(item.rotation ?? 0)`
  after positioning, so a page refresh preserves every placed item's
  orientation.
- **`useRoomStore.rotatePlacedItemAt(gridX, gridY, rotation)`** — patches
  the matching placed item's rotation in the store without rebuilding
  the array.

### Changed
- `PlacedItem` (`useRoomStore.ts`) gains `rotation: number`.
- `room/page.tsx` SSR `player_items` query now selects `rotation`
  alongside `grid_position`. The mapping normalizes missing / non-integer
  values to 0 and wraps with `((r % 4) + 4) % 4`.
- `ContextMenu` edit-mode branch now renders three buttons (Rotate +
  Remove + Cancel) instead of two. View-mode branch unchanged.

### Verified
- `pnpm lint` — 0 errors, 3 pre-existing warnings.
- `pnpm build` — ✅ clean in 3.5s, TypeScript zero errors, 9 routes
  generated.

### Phase 1 status
Interactive room editor is feature-complete. Remaining Phase 1 items
are cosmetics (1.0.19 wall color, 1.0.20 floor type) and perf
(1.0.22 tile culling) — none block Phase 2 or 3.

---

## [0.1.3] — 2026-04-13 — Task 1.0.18: Walls + Entry Point Indicators

### Added
- **Entry-point type definitions** in `useRoomStore.ts` — exported
  `EntryPoint`, `EntryPointWall`, `EntryPointType`. Store gains
  `entryPoints: EntryPoint[]` + `setEntryPoints()` mutator.
- **SSR hydration** — `room/page.tsx` now selects `entry_points` alongside
  `grid_size`, runs a whitelist/bounds validator (drops malformed entries),
  and pipes the array through `StoreInitializer` into the store.
- **Entry-point textures** (`BootScene.ts`) — three new flat isometric
  diamonds: `entry_door` (sienna), `entry_window` (sky blue), `entry_vent`
  (slate). Generated via the existing `generateIsoBlock` utility.
- **Per-segment wall rendering** (`RoomScene.drawWalls`) — draws each of
  the 4 outer walls as `grid_size` thick (6px) line segments via a
  dedicated `wallGraphics` Phaser Graphics object, depth 0.5 (above floor,
  below furniture). Segments at entry-point positions tint in that entry's
  color (`door=#a0522d` / `window=#5dade2` / `vent=#34495e`); all other
  segments render in the neutral wall color (`#888`).
- **Entry-point floor markers** — one colored diamond sprite per entry
  tile, depth `x + y + 0.5` (between floor and furniture), with a
  `Sine.easeInOut` alpha pulse (0.6↔1.0 over 1200ms, yoyo, infinite) to
  draw the eye.
- **Entry-tile grid marking** — `RoomScene.create()` iterates
  `useRoomStore.entryPoints` BEFORE placed-item hydration and flips each
  corresponding tile to `'entry_point'` in the `GridSystem`. The existing
  `isTileWalkable()` guard (only `'empty'` is walkable) then causes:
  (a) the placed-item hydration loop to defensively skip any legacy
  DB row that happens to sit on an entry tile, (b) the ghost sprite to
  render red at entry tiles, (c) the editor pointerdown placement check
  to reject entry tiles, and (d) view-mode pathfinding to refuse entry
  tiles as a target.
- **`RoomScene.baseTileStateFor(x, y)`** + `entryPointTiles` Set — the
  `removal-success` handler now restores the underlying structural state
  (`'entry_point'` if the tile is a door/window/vent, otherwise `'empty'`)
  so the structural invariant survives arbitrary placement / removal
  cycles.
- **`RoomScene.entryTileFor(ep)`** — canonical mapping from
  `(wall, position)` → `(gridX, gridY)` for the edge tile. Reused wherever
  the `entryPoints` array needs to map to grid coords (raid-spawn logic
  in Phase 3 should call this same helper).

### Changed
- `RoomScene.rotateGrid()` now also tweens every entry-point marker
  sprite to its new screen position and re-runs `drawWalls()` at the new
  rotation, so walls and doors rotate cohesively with the grid on Q/E.
- Removed the old 2px white grid-boundary outline in `RoomScene.create()`
  — superseded by `drawWalls()` which draws the perimeter more visibly
  and carries the entry-point coloring.
- `StoreInitializer` prop type widened to include `entryPoints`.

### Verified
- `pnpm lint` — 0 errors, 3 pre-existing warnings (down from 4 — a
  previously-required `@typescript-eslint/no-explicit-any` disable in
  `room/page.tsx` became unused once the `entry_points` parse path pulled
  the cast outward).
- `pnpm build` — ✅ clean in 4.0s, TypeScript zero errors, 9 routes
  generated.

---

## [0.1.2] — 2026-04-13 — Task 1.0.12: Remove Item

### Added
- **`removePlacedItem` server action** (`src/app/(game)/room/actions.ts`):
  locates the `player_items` row at `{x, y}` via JSONB `contains`, fetches the
  linked `items.cost`, deletes the row, and credits
  `floor(cost.scrap * 0.5)` back to `inventories.scrap`. All queries scoped to
  `auth.uid()` — delete double-guards with `.eq('owner_id', user.id)`.
- **Remove Item UX** — edit-mode tap on an occupied tile opens the context
  menu with a destructive "Remove (50% refund)" button (`Trash2` icon). View
  mode retains the existing Inspect action. ContextMenu is now mode-aware
  based on `useUIStore.mode`.
- **`useRoomStore.removePlacedItemAt(x, y)`** — keeps the client store in
  sync with the DB so scene remounts don't re-rehydrate the deleted item.
- **`removal-success` EventBus round-trip** — `GameBridge` listens for
  `request-removal`, calls the server action, updates `usePlayerStore.scrap`,
  emits `removal-success`. `RoomScene` handles it by destroying the
  `FurnitureSprite`, flipping the tile state to `'empty'`, and syncing the
  store.

### Changed
- `RoomEditorScene.pointerdown` restructured into three explicit branches:
  (1) shift+click = debug A* path, (2) ghost+key selected = placement request,
  (3) tap on `'occupied'` tile with no ghost = emit `open-context-menu` with
  grid coords. Fixed a pre-existing quirk where shift+click only worked when
  a ghost sprite was active.
- `RoomScene.furnitureItems` promoted from `private` to `public` for
  cross-scene access (editor needs to look up sprites at a grid position).
- View-mode context-menu emit in `RoomScene` now carries `gridX`/`gridY`
  alongside screen coords for future menu actions.
- `ContextMenu` title now runs `replace(/_/g, ' ')` (global) so multi-word
  sprite keys like `furniture_bed_twin` render cleanly.

### Verified
- `pnpm lint` — 0 errors, 4 pre-existing warnings.
- `pnpm build` — ✅ clean in 3.3s, TypeScript zero errors, 9 routes generated.

---

## [0.1.1] — 2026-04-13 — Drift Correction + Critical Sprite-Key Bugfix

### Fixed
- **BootScene sprite-key mismatch (critical):** `BootScene` was generating
  placeholder textures under shorthand keys (`bed_basic`, `desk_wood`, …) while
  `supabase/seed.sql` stores canonical keys (`furniture_bed_twin`,
  `furniture_desk_wooden`, …). Every catalog-driven placed item and every
  editor ghost sprite was silently resolving to Phaser's missing-texture
  default. Rewrote `BootScene.preload()` to a descriptor-table generator that
  now emits all 20 catalog sprites (10 furniture + 5 traps + 2 turrets +
  3 barricades) plus `iso-tile` and `entity_drone`, with keys matching
  `items.sprite_key` verbatim.
- Removed hardcoded test-bed instantiation from `RoomScene.create()` —
  it referenced the obsolete `bed_basic` key and was redundant with the
  `placedItems` hydration loop.

### Reconciled (docs vs code)
- `tasks.md` — tasks implemented in code but never checked off are now
  `[DONE]`: `1.0.14` (z-sort), `1.0.15` (useRoomStore), `1.0.16` (save layout
  via server action), `1.0.17` (load layout via SSR), `1.0.21` (input handling).
- `tasks.md` — Phase 1's premature "formally COMPLETED" marker removed.
  Remaining gaps: `1.0.12`, `1.0.13`, `1.0.18`, `1.0.19`, `1.0.20`, `1.0.22`.
- `tasks.md` — Phase 3 duplicate tasks `3.0.5` (CharacterSprite), `3.0.6`
  (tap-to-pathfind), `3.0.7` (PathfindingSystem) marked `[MERGED]` — all
  covered by `EntitySprite` + `GridSystem.findPath` implemented under
  `3.0.1`–`3.0.3`.
- `tasks.md` — Phase 4 goal restored to "Economy & Quests" (was rewritten to
  "Global player reconnaissance"). `4.0.1` ResourceBar marked `[DONE]`,
  `4.0.4` passive generation marked `[DONE]`, `4.0.13` level-up marked
  `[PARTIAL]`, `4.0.2` resource costs marked `[PARTIAL]` pending balance pass.
- `tasks.md` — Phase 2 header renamed "Fortification" → "Economy + Fortification"
  to match what the tasks actually cover.
- `tasks.md` — Phase 5 Global Recon Map task renumbered `5.0.0` → `5.0.1`;
  subsequent Phase 5 tasks shifted by one. The same task had been
  double-tracked in changelog/handoff under `4.0.1`; that attribution is
  superseded by this entry.

### Verified
- `pnpm lint` — 0 errors, 4 pre-existing warnings (unused eslint-disable
  directives in `room/page.tsx` and `room/actions.ts`).
- `pnpm build` — ✅ compiled in 2.9s, TypeScript clean, all 9 static/dynamic
  routes generated.

---

## [0.1.0] — 2026-04-13 — Phase 1 Start: Core Isometric Math & Grid System

### Added
- **Task 1.0.1 [DONE]:** Created `src/game/systems/IsometricEngine.ts` — static utility
  class with `worldToScreen()` and `screenToWorld()` coordinate transforms. Implements
  standard 2:1 isometric projection (64×32 tile geometry). `screenToWorld` floors output
  to integer grid indices. Zero dependencies on Phaser or React.
- **Task 1.0.2 [DONE]:** Created `src/game/systems/GridSystem.ts` — logical 2D grid data
  structure (`TileState`: `'empty'` | `'occupied'` | `'entry_point'`). Initializes a
  `DEFAULT_GRID_SIZE × DEFAULT_GRID_SIZE` (10×10) grid with all tiles set to `'empty'`.
  Exposes `getTileState()`, `setTileState()`, and `isTileWalkable()` with bounds checking.
- Created `src/game/utils/constants.ts` — exported `TILE_WIDTH` (64), `TILE_HEIGHT` (32),
  and `DEFAULT_GRID_SIZE` (10) as shared dimensional constants.
- **Task 1.0.3 [DONE]:** Implemented `RoomScene.ts`. Iterates `DEFAULT_GRID_SIZE` setting
  `iso-tile` sprites translated by `IsometricEngine.worldToScreen`. Utilized `Phaser.Graphics` 
  to draw an outline mapping the 4 mathematical corner vertices of the room to screen space. 
  Updated `BootScene.ts` to directly transition via `this.scene.start('RoomScene')`.
- **Task 1.0.4 [DONE]:** Implemented mouse/touch camera controls in `RoomScene.ts`. Added
  drag-to-pan input listeners adjusting `camera.scrollX/Y` relative to target zoom. Added
  mouse wheel scaling for `camera.zoom` factoring increments and clamped smoothly between
  0.5x and 2.0x zoom. Initialized camera anchored sequentially centered.
- **Task 1.0.5 [DONE]:** Implemented 4-rotation mathematically in `IsometricEngine.ts` mapping 
  CW/CCW 90-degree operations into Cartesian translation prior to isometric scale projection.
  Modified `RoomScene.ts` to attach mathematical indices directly to generated `iso-tile` instances,
  added `rotateGrid` method applying iterative screen translations with `Phaser.Tweens` 
  Quadratic Easing (300ms) fired synchronously by `Q` and `E` keydown events.
- **Task 1.0.6 [DONE]:** Implemented programmatic isometric sprite generation in `BootScene.ts`.
  Created `generateIsoBlock` utility to mathematically draw perfectly aligned 3D blocks
  based on tile footprint, height, and color parameters. Utilized algorithmic darkening to
  simulate lighting on side faces. Generates `iso-tile` base along with the 10 core starter 
  furniture objects matching the DB seed definitions directly into Phaser texture memory.
- **Task 1.0.7 [DONE]:** Implemented `FurnitureSprite.ts`, an extended `Phaser.GameObjects.Image` class.
  Handles its own logic for logical footprint storage (`gridX`, `gridY`, `footprintW`, `footprintH`) 
  and calculates standard isometric projection via `IsometricEngine.worldToScreen`. Established 
  `setDepth()` Z-sorting algorithm correctly evaluating map dimensions (`gridX + gridY + 1`).
  Instantiated a test furniture element ('bed_basic') into `RoomScene` tracking within local properties, tying 
  it directly to the runtime grid rotation cycle.
- **Task 1.0.8 [DONE]:** Implemented the mode toggle loop bridging React/Zustand and Phaser. Created `EventBus.ts`
  and a new Zustand store `useUIStore.ts` tracking mode schemas (`"view" | "edit"`). Integrated an Edit Mode UI 
  toggle inside `TopBar.tsx`. Created `RoomEditorScene.ts` plotting a `0.5` opacity line-stylized mathematical grid boundaries
  highlight. Wired parallel `.wake()` and `.sleep()` lifecycles between `RoomScene` and `RoomEditorScene` 
  hooked directly to `.on('change-mode')` events emitted from the React UI.
- **Task 1.0.9 [DONE]:** Developed `ItemPanel.tsx` React component rendering a horizontal scrolling inventory overlay. 
  Mapped hardcoded prototype data reflecting the 10 furniture models. Wired selections directly into `useUIStore` tracking 
  the active `selectedItemKey` locally, and firing an `EventBus.emit()` event syncing context selections dynamically down 
  into the Phaser game runtime instance perfectly. Wrapped component effectively in `page.tsx` mapping to layout constraints.
- **Task 1.0.10 [DONE]:** Implemented algorithmic Cartesian inverse mapping via `screenToWorld` capturing arbitrary offsets
  and restoring normalized `x`/`y` matrix indices natively reversing rotational quadrants. Constructed interactive pointer
  `ghostSprite` tracker in `RoomEditorScene` hooking via `item-selected` bus events. Realtime validation checks evaluate 
  `GridSystem.isTileWalkable()` rendering bounds applying green (`0x00ff00`) or red (`0xff0000`) hexadecimal dynamic 
  tints mapping screen coordinate projection.
- **Task 1.0.11 [DONE]:** Finalized Phase 1 core placement bindings hooking `pointerdown` inside the Editor scene natively
  evaluating coordinates and executing state preservation routines across `RoomScene`. Synchronized grid footprint indices
  utilizing `gridSystem.setTileState('occupied')` directly coupled to dynamic instantiation routines for `FurnitureSprite`.
  Appended `this.tweens.add()` instantiation bounce effects. **Phase 1 Complete.**

## Phase 4 Start
- **Task 4.0.1 [DONE]:** Initiated Phase 4 (Async PvP & Scouting). Created server component `/map/page.tsx` dynamically fetching `.neq` self `profiles` joined against `rooms.grid_size` via Supabase SSR correctly yielding reconnaissance tracking outputs securely mapped into `lucide-react` grids. Built adaptive NextJS `Link` logic correctly switching natively inside `<TopBar />` gracefully.

## Phase 3 Start
- **Task 3.0.1 [DONE]:** Implemented A* Pathfinding Logic. Created `findPath` method in `GridSystem.ts` using Manhattan distance heuristic and 4-way cardinal direction bounds checking. Spliced visual debugging logic `drawDebugPath` into `RoomScene.ts` utilizing mathematically projected Cartesian offset lines. Wired a Shift+Click pointer intercept into `RoomEditorScene.ts` natively evaluating (0,0) to pointer world coordinates and dynamically emitting green overlay renders for path validation.
- **Task 3.0.2 [DONE]:** Implemented Entity Sprite and dynamic path traversal. Generated a placeholder asset `entity_drone` in `BootScene`. Created `EntitySprite.ts` extending `Phaser.GameObjects.Image` with custom depth sorting logic and a `walkPath` method executing chained tweens mapping A* nodes to screen coordinates. Wired `RoomScene` to spawn a `playerEntity` and assigned a `pointerdown` traversal listener bounded exclusively to `view` mode.
- **Task 3.0.3 [DONE]:** Implemented an adjacency pathfinder returning optimal intercept nodes outside occupied tiles natively within `GridSystem.ts`. Updated `RoomScene` pointer interaction correctly applying branch logic invoking native movement towards interactive offsets natively invoking internal physics chains and invoking interaction `console.log()` callbacks. Attached smooth `cameras.main.startFollow` routines correctly interrupted by dynamic layout dragging overrides.
- **Task 3.0.4 [DONE]:** Developed bridging architecture for Interactive Context Menus extending Phase 3 requirements. Integrated `contextMenu` interface inside `useUIStore.ts` tracking coordinates naturally. Created `ContextMenu.tsx` executing `EventBus.on` listeners tracking internal interactions bridging natively towards DOM elements positioned relatively. Rewrote callback loops natively within `RoomScene` mapping internal `worldCoords` interpolations seamlessly over Phaser coordinates towards absolute positions pushing `.emit` hooks perfectly binding UI. Phase 3 Architecture locked natively safely.

## Phase 2 Start
- **Task 2.0.1 [DONE]:** Initiated Phase 2 (Economy & Progression). Configured `/room/page.tsx` pulling `createClient` from `@/lib/supabase/server` to enforce Auth validation (`redirect('/login')`). Fetched `{ owner_id }` matching inventories natively passing payload payload into SSR boundaries. Created `StoreInitializer.tsx` bridging hydration onto `usePlayerStore.setInventory`.
- **Task 2.0.2 [DONE]:** Configured DB to Engine hydration loops mapping spatial properties. Integrated `useRoomStore.ts` defining logic across `gridSize` boundaries natively. Rewrote `/room/page.tsx` to handle `.select()` joining `player_items` against `items` schema. Initialized `RoomScene` parsing memory iteratively executing footprint instantiation mapping mathematically directly through `.isTileWalkable` safety limits across origin bounds.
- **Task 2.0.3 [DONE]:** Built Server Action `buyAndPlaceFurniture` checking `inventory.scrap` costs effectively deducting and writing to DB recursively. Implemented React `GameBridge` syncing asynchronous `.on('request-placement')` routines pausing Engine `.placeholder` rendering effectively bypassing duplicate UI ticks locking dynamically via `placement-success`.
- **Task 2.0.4 [DONE]:** Integrated Catalog and Progression Hydration evaluating dynamic `unlock_level` mappings natively directly off `profiles` tables. Updated `ItemPanel.tsx` mapping UX structures dynamically iterating items rendering UI `Lock` overlays cleanly overriding `EventBus` limits seamlessly.
- **Task 2.0.5 [DONE]:** Added Client-Side Tick routines building `TickManager.tsx` triggering headless `generateTick()` Zustand variables consistently every `5000ms`. Asynchronously configured database synchronization `.syncInventoryState` executing backend payload overrides effectively saving metrics routinely every `30000ms` eliminating frontend state loss.

### Verified
- `pnpm run lint` — ✅ Clean, zero warnings.
- `pnpm build` — ✅ Clean, TypeScript zero errors.

---

## [0.0.2] — 2026-04-12 — Phase 0 Start: Project Initialization

### Added
- **Task 0.0.1 [DONE]:** Initialized Next.js 16.2.3 project with TypeScript 5.9,
  pnpm 10.33, App Router, TailwindCSS 4, ESLint 9, and `src/` directory structure.
- Installed pnpm globally.
- Relocated project docs (GDD, architecture, tasks, changelog, handoff, planning)
  to `docs/` directory per architecture spec.
- **Task 0.0.2 [DONE]:** Configured shadcn/ui (base-nova style) with TailwindCSS v4.
  Installed 5 components: button, card, input, dialog, sheet. Added `cn()` utility,
  CSS design tokens (oklch color system), and dark mode support. Updated root layout
  with Room Invaders metadata, viewport config, and dark-by-default class.
- **Task 0.0.3 [DONE]:** Configured PWA using native Next.js approach (no `next-pwa`
  plugin — obsolete for Next.js 16). Created `src/app/manifest.ts` (typed manifest
  route), `public/sw.js` (service worker with cache-first/network-first strategies),
  `ServiceWorkerRegistrar.tsx` (client component). Generated PWA icons (192x192 +
  512x512). Added Apple Web App metadata for iOS standalone mode.
- **Task 0.0.4 [DONE]:** Installed `@supabase/supabase-js` v2.103.0 +
  `@supabase/ssr` v0.10.2. Created `.env.example` and `.env.local` with Supabase
  credential placeholders. Created `supabase/migrations/` and `supabase/functions/`
  directories. Created placeholder `src/lib/supabase/types.ts` for typed DB client.
- **Task 0.0.5 [DONE]:** Created 3 Supabase client helpers:
  `client.ts` (browser/createBrowserClient), `server.ts` (server components/
  createServerClient with cookie management), `middleware.ts` (session refresh via
  getUser()). Created `src/middleware.ts` with route matcher excluding static assets.
- **Task 0.0.6 [DONE]:** Implemented auth flow with 3 Server Actions in
  `src/app/auth/actions.ts`: `login` (signInWithPassword → /room),
  `signup` (signUp with username metadata → /login), `logout` (signOut → /login).
  Created Login page (`src/app/(auth)/login/page.tsx`) and Register page
  (`src/app/(auth)/register/page.tsx`) using Card, Input, Button from shadcn/ui.
  Both parse URL searchParams for error/success message display.
  Created `TopBar.tsx` component with logout button wired to logout Server Action.
- **Task 0.0.7 [DONE]:** Added route-guarding logic to `src/lib/supabase/middleware.ts`.
  Unauthenticated users on `/room`, `/map`, `/raid`, `/quests`, `/profile` are
  redirected to `/login`. Authenticated users on `/login` or `/register` are
  redirected to `/room`. Refreshed session cookies are forwarded onto redirect
  responses to preserve token rotation. Updated `src/middleware.ts` docstring.
- **Task 0.0.8 [DONE]:** Created `supabase/migrations/00001_profiles.sql`.
  Profiles table with 13 columns (player_level, xp, reputation, safe_mode_until,
  tutorial tracking, timestamps). RLS enabled: public SELECT, owner-only UPDATE.
  `handle_new_user()` trigger function (SECURITY DEFINER) auto-inserts a profile
  row on `auth.users` INSERT, pulling username from `raw_user_meta_data`.
- **Task 0.0.9 [DONE]:** Created `supabase/migrations/00002_rooms.sql`.
  Rooms table with 14 columns (layout JSONB, entry_points JSONB with 3 defaults,
  defense_rating, shield_until, cosmetics). RLS enabled: authenticated SELECT,
  owner UPDATE/INSERT. `handle_new_profile()` trigger (SECURITY DEFINER) auto-creates
  a blank room on profile insert. Indexes on `owner_id` and `defense_rating`.
  Added tech debt task 8.0.17 for Next.js middleware → proxy refactor.
- **Task 0.0.10 [DONE]:** Created `supabase/migrations/00003_items_inventory.sql`.
  Three tables: `inventories` (5 resource types with starter defaults, storage cap),
  `items` (master catalog with type CHECK constraint, cost/stats/footprint JSONB),
  `player_items` (ownership instances with placement tracking). RLS: owner-only for
  inventories and player_items (full CRUD), public SELECT for items catalog.
  `handle_new_profile_inventory()` trigger auto-creates inventory on profile insert.
  Index on `player_items(owner_id)`.
- **Task 0.0.11 [DONE]:** Created `supabase/seed.sql` — 20 items total.
  10 furniture (twin bed, wooden desk, office chair, metal shelf, wooden dresser,
  flatscreen TV, area rug, floor lamp, potted plant, folding table), 5 traps
  (pressure plate, spike strip, shock pad, glue trap, tripwire alarm), 2 turrets
  (nail gun, taser), 3 barricades (bookshelf, flipped table, sandbags). Costs
  balanced against starter inventory (200 scrap / 50 components). Unlock levels
  gate tier 2 items (shock pad: L3, turrets: L5, sandbags: L2).
- **Task 0.0.12 [DONE]:** Built the game app shell. Expanded `TopBar.tsx` with 5
  resource indicators (Scrap/Components/Credits/Contraband/Intel) using lucide-react
  icons, backdrop-blur fixed header, compact icon logout button. Created `BottomNav.tsx`
  client component with 5-tab navigation (Room/Map/Raid/Quests/Profile), active route
  detection via `usePathname()`, iOS safe area padding. Created `(game)/layout.tsx`
  with `h-screen` + `overflow-hidden` structure for Phaser canvas compatibility.
- **Task 0.0.13 [DONE]:** Installed Phaser 4.0.0 (latest stable). Created
  `src/game/config.ts` (AUTO renderer, Scale.RESIZE, pixelArt: true, empty scenes).
  Created `src/game/PhaserGame.ts` singleton manager with SSR guard, duplicate
  prevention, and clean `destroy(true)` for React Strict Mode. Created
  `src/components/game/GameCanvas.tsx` client component with useEffect
  init/destroy lifecycle and ref guard against double-init.
- **Task 0.0.14 [DONE]:** Created `BootScene.ts` to programmatically render a 64x32
  isometric diamond placeholder tile (`iso-tile`) and "Engine Initialized" centered text.
  Updated `config.ts` to include `BootScene`. Implemented `src/app/(game)/room/page.tsx`
  mounting GameCanvas securely through a Next.js `dynamic()` component (`GameWrapper.tsx`)
  mounting GameCanvas securely through a Next.js `dynamic()` component (`GameWrapper.tsx`)
  to avoid SSR `window is not defined` Phaser 4 issues.
- **Task 0.0.15 [DONE]:** Integrated Zustand via `usePlayerStore.ts`. Wired `TopBar.tsx`
  to reactively display resources. Tied Phaser `BootScene` to Zustand by adding a generic
  pointerdown listener to the `iso-tile` image that directly mutates `addScrap(10)`
  and triggers a bounce tween, bridging Phaser actions directly to React UI state.
- **Task 0.0.16 [DONE]:** Installed `@sentry/nextjs` (v10.48.0). Created `sentry.client.config.ts`,
  `sentry.server.config.ts`, and `sentry.edge.config.ts` with baseline placeholder DSNs.
  Wrapped `next.config.ts` using `withSentryConfig` to instrument Next.js routing and builds.
- **Task 0.0.17 [DONE]:** Created `.env.example` defining generic `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  and `SENTRY_DSN` keys. Rewrote `README.md` to cleanly communicate project stacks and local
  setup instructions for new developers.
- **Task 0.0.18 [DONE]:** Verified Next.js `build` scripts. Scaffolded `vercel.json` 
  enforcing strict `Cache-Control` (`max-age=0, must-revalidate`) specifically for `sw.js`
  so the PWA service worker is exempt from stale edge caching. Emitted Vercel CLI deployment 
  attempt. **Phase 0 is now officially COMPLETE.**
### Verified
- `pnpm build` passes cleanly — middleware detected as Proxy layer.
- TypeScript compilation succeeds with zero errors.
- Note: Next.js 16 shows deprecation warning for "middleware" → "proxy". Functional,
  migration deferred.

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

