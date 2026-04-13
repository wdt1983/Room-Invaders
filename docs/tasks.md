# tasks.md — Room Invaders
## Version: 0.0.1 | Last Updated: 2025-07-10

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
- [TODO] 0.0.2 — Configure TailwindCSS + shadcn/ui (button, card, input, dialog, sheet)
- [TODO] 0.0.3 — Configure `next-pwa` plugin, create manifest.json, add PWA icons
- [TODO] 0.0.4 — Set up Supabase project (hosted), install `@supabase/supabase-js` + `@supabase/ssr`
- [TODO] 0.0.5 — Create Supabase client helpers (`client.ts`, `server.ts`, `middleware.ts`)
- [TODO] 0.0.6 — Implement auth flow: register (email/password), login, logout, session persistence
- [TODO] 0.0.7 — Create auth middleware — redirect unauthenticated users to `/login`
- [TODO] 0.0.8 — Run migration `00001_profiles.sql` — profiles table + trigger on auth signup
- [TODO] 0.0.9 — Run migration `00002_rooms.sql` — rooms table, auto-create room on profile insert
- [TODO] 0.0.10 — Run migration `00003_items_inventory.sql` — items + player_items + inventories
- [TODO] 0.0.11 — Create `seed.sql` — populate items table with starter furniture + traps
- [TODO] 0.0.12 — Create game layout: `(game)/layout.tsx` with BottomNav + TopBar (resource display)
- [TODO] 0.0.13 — Install Phaser 3, create `PhaserGame.ts` factory, create `GameCanvas.tsx` React wrapper
- [TODO] 0.0.14 — Create `BootScene.ts` that loads a single placeholder tile and renders it
- [TODO] 0.0.15 — Verify Phaser ↔ React bridge: Zustand store updates propagate to React HUD
- [TODO] 0.0.16 — Set up Sentry error tracking (client-side)
- [TODO] 0.0.17 — Create `.env.example`, update README with setup instructions
- [TODO] 0.0.18 — Deploy to Vercel, verify PWA installable on mobile Chrome/Safari

**Exit Criteria:** User can register, log in, see a game layout with bottom nav and a Phaser canvas rendering a single tile. PWA installable. Database seeded.

---

## Phase 1: The Room
**Goal:** Fully functional isometric room editor. Place, move, remove furniture. Save/load.

- [TODO] 1.0.1 — Implement `IsometricEngine.ts`: worldToScreen, screenToWorld coordinate transforms
- [TODO] 1.0.2 — Implement `GridSystem.ts`: 10×10 grid data structure, tile state management (empty, occupied, entry_point)
- [TODO] 1.0.3 — Implement `RoomScene.ts`: render floor tiles in isometric grid, draw wall boundaries
- [TODO] 1.0.4 — Implement camera controls: pan (touch drag / mouse drag), zoom (pinch / scroll wheel)
- [TODO] 1.0.5 — Implement 4-rotation camera (rotate grid 90° CW/CCW) with smooth transition
- [TODO] 1.0.6 — Create placeholder sprite set: 10 furniture items (bed, desk, chair, shelf, table, lamp, TV, rug, plant, dresser) as colored isometric blocks
- [TODO] 1.0.7 — Implement `FurnitureSprite.ts`: isometric game object with footprint, z-sorting, placement validation
- [TODO] 1.0.8 — Implement `RoomEditorScene.ts`: enter edit mode from RoomScene
- [TODO] 1.0.9 — Room editor: item selection panel (React overlay) — browse available furniture
- [TODO] 1.0.10 — Room editor: place item on grid (tap to select tile, validate footprint fits, snap to grid)
- [TODO] 1.0.11 — Room editor: move item (tap placed item → drag to new position → validate → snap)
- [TODO] 1.0.12 — Room editor: remove item (tap placed item → delete button → return to inventory)
- [TODO] 1.0.13 — Room editor: rotate item (tap placed item → rotate 90° → validate new footprint)
- [TODO] 1.0.14 — Implement z-sorting: items render in correct depth order (back-to-top, left-to-right)
- [TODO] 1.0.15 — Implement `useRoomStore.ts`: room layout state, sync between Phaser and React
- [TODO] 1.0.16 — Room persistence: save layout to Supabase `rooms.layout` JSONB on editor close/explicit save
- [TODO] 1.0.17 — Room persistence: load layout from Supabase on RoomScene init
- [TODO] 1.0.18 — Implement wall rendering: 4 walls with entry point indicators (door, window, vent)
- [TODO] 1.0.19 — Cosmetic: wall color picker (saves to `rooms.cosmetics`)
- [TODO] 1.0.20 — Cosmetic: floor type selector (wood, carpet, tile, concrete — saves to `rooms.cosmetics`)
- [TODO] 1.0.21 — Input handling: touch input (mobile) and mouse input (desktop) via `InputManager.ts`
- [TODO] 1.0.22 — Performance: implement tile culling (only render tiles within camera viewport)

**Exit Criteria:** Player opens the room page, sees their 10×10 isometric room. Can enter edit mode, place/move/remove/rotate furniture from a catalog, change wall color and floor type. Room persists across sessions.

---

## Phase 2: Fortification
**Goal:** Defense placement system. Traps, barricades, turrets on the grid.

- [TODO] 2.0.1 — Create placeholder sprites: 5 trap types, 2 turret types, 3 barricade types
- [TODO] 2.0.2 — Implement `TrapSprite.ts`: floor trap game object, armed/triggered visual states
- [TODO] 2.0.3 — Implement `TurretSprite.ts`: turret game object with range indicator overlay
- [TODO] 2.0.4 — Implement `BarricadeSprite.ts`: barricade game object with HP bar
- [TODO] 2.0.5 — Room editor: defense tab in item selection panel (separate from furniture)
- [TODO] 2.0.6 — Placement rules: traps on empty floor tiles only, turrets on wall-adjacent tiles, barricades anywhere except entry points
- [TODO] 2.0.7 — Defense slot system: track placed defenses against room-level cap
- [TODO] 2.0.8 — Defense rating calculation: sum of defense item values → update `rooms.defense_rating`
- [TODO] 2.0.9 — Implement `validate-defense` Edge Function: verify layout legality server-side on save
- [TODO] 2.0.10 — Visual: defense items show range/trigger zones when selected in editor
- [TODO] 2.0.11 — Visual: defense items pulse/glow when room is in "defense view" mode
- [TODO] 2.0.12 — Resource cost: placing defenses deducts from inventory. Removing refunds 50%.

**Exit Criteria:** Player can place traps, turrets, and barricades in their room. Defense rating updates. Server validates layout. Resources are deducted.

---

## Phase 3: The Raid (PvE)
**Goal:** Player can raid NPC rooms. Full attack flow: prep → execute → results.

- [TODO] 3.0.1 — Create `npc-rooms.json`: 15 hand-crafted NPC room layouts (5 per tier: Easy/Medium/Hard)
- [TODO] 3.0.2 — Implement raid target list screen (React page): browse NPC rooms, see difficulty + loot range
- [TODO] 3.0.3 — Implement raid prep screen: select entry point, view squad loadout (1 unit for MVP)
- [TODO] 3.0.4 — Implement `RaidScene.ts`: load target room layout, render isometrically
- [TODO] 3.0.5 — Implement squad unit: `CharacterSprite.ts` with HP, speed, position on grid
- [TODO] 3.0.6 — Implement movement: tap tile → unit pathfinds to it (A* via `PathfindingSystem.ts`)
- [TODO] 3.0.7 — Implement `PathfindingSystem.ts`: A* algorithm on grid, respects occupied tiles and barricades
- [TODO] 3.0.8 — Implement `TrapSystem.ts`: when unit enters trapped tile, trigger trap effect (damage, slow, stun)
- [TODO] 3.0.9 — Implement `CombatSystem.ts`: HP tracking, damage application, death/knockout
- [TODO] 3.0.10 — Implement `DefenseAI.ts`: turrets acquire target when unit enters range, fire at interval
- [TODO] 3.0.11 — Implement barricade interaction: unit attacks barricade, deals damage over time, barricade has HP
- [TODO] 3.0.12 — Implement loot stash: marked tile in NPC room. Unit must reach it and hold for X seconds.
- [TODO] 3.0.13 — Implement raid timer: countdown (90s Easy, 120s Medium, 150s Hard). Raid fails at 0.
- [TODO] 3.0.14 — Implement `action_log` recording: every move, trap trigger, damage event logged to array
- [TODO] 3.0.15 — Implement raid results screen: victory/defeat, XP gained, loot gained, damage taken
- [TODO] 3.0.16 — Implement `resolve-raid` Edge Function: receive action_log, validate against NPC room layout, commit results to DB
- [TODO] 3.0.17 — Implement `LootSystem.ts`: calculate loot from NPC loot tables, apply to player inventory
- [TODO] 3.0.18 — Implement `useRaidStore.ts`: raid state management (target, phase, timer, results)
- [TODO] 3.0.19 — Update `usePlayerStore.ts`: XP gain triggers level-up check, resource updates
- [TODO] 3.0.20 — NPC room cooldowns: each NPC room has a 4-hour cooldown after being raided
- [TODO] 3.0.21 — Raid list: show cooldown timers, locked/unlocked state based on player level

**Exit Criteria:** Player can browse NPC targets, prep a raid, play through the room (move unit, dodge traps, destroy barricades, avoid turrets), reach the loot stash, and receive rewards. Server validates results.

---

## Phase 4: Economy & Quests
**Goal:** Resource management loop and quest-driven progression feel complete.

- [TODO] 4.0.1 — Implement `ResourceBar.tsx`: display all resource counts in TopBar HUD
- [TODO] 4.0.2 — Resource costs for all placeable items (furniture + defenses) — balance pass
- [TODO] 4.0.3 — Implement repair system: after being raided (future), damaged defenses require scrap to repair
- [TODO] 4.0.4 — Implement passive resource generation: scrap + intel tick every 30 min (offline-capable via server timestamp delta)
- [TODO] 4.0.5 — Implement storage cap: resources above cap are "overflow" (raidable in v0.2)
- [TODO] 4.0.6 — Create `quests.json`: full tutorial quest chain (8 quests) + 10 daily quest templates + 5 weekly templates
- [TODO] 4.0.7 — Implement quest board UI (`/quests` page): active quests, available quests, completed quests
- [TODO] 4.0.8 — Implement quest tracking: `player_quests` table, progress JSONB updated on relevant events
- [TODO] 4.0.9 — Implement quest event hooks: raid_completed, item_placed, defense_placed, resource_spent → check active quest progress
- [TODO] 4.0.10 — Implement quest completion: validate via `process-quest` Edge Function, grant rewards
- [TODO] 4.0.11 — Implement tutorial quest sequence: gated progression, each quest unlocks next
- [TODO] 4.0.12 — Implement tutorial UI overlay: highlight relevant UI elements during tutorial quests
- [TODO] 4.0.13 — Implement player level-up: XP thresholds, level-up notification, unlock message
- [TODO] 4.0.14 — Implement room level upgrade: UI to spend resources, increase grid/slots/entry points
- [TODO] 4.0.15 — Daily quest refresh: server-side via pg_cron, 3 new dailies at midnight UTC
- [TODO] 4.0.16 — Weekly quest refresh: 3 new weeklies on Monday 00:00 UTC

**Exit Criteria:** Player earns resources from raids, spends them on room upgrades and items. Quest board shows tutorial + daily + weekly quests. Completing quests grants rewards. Player can level up.

---

## Phase 5: PvP & Social (v0.2)
**Goal:** Async PvP raids. Safe mode expiration. Defense replays. Friends.

- [TODO] 5.0.1 — Implement safe mode timer display in HUD, expiration logic
- [TODO] 5.0.2 — Implement manual safe mode deactivation (player choice)
- [TODO] 5.0.3 — Implement PvP matchmaking: `matchmaking` Edge Function — find opponent by room level bracket ±1
- [TODO] 5.0.4 — PvP target info screen: show defender's defense rating, room level, replay count (not layout)
- [TODO] 5.0.5 — Adapt `RaidScene.ts` to load player room layouts (from DB) instead of NPC JSON
- [TODO] 5.0.6 — Implement loot transfer: attacker gains % of defender's overflow resources
- [TODO] 5.0.7 — Implement post-raid shield: defender gets 8h shield after being raided
- [TODO] 5.0.8 — Implement raid notification: defender sees "You were raided by [username]" on next login
- [TODO] 5.0.9 — Implement replay system: store action_log, build replay viewer in `RaidScene.ts` (playback mode)
- [TODO] 5.0.10 — Implement replay UI: defense log screen showing all received raids, watch replay button
- [TODO] 5.0.11 — Implement revenge raid: button on raid notification → directly target that player
- [TODO] 5.0.12 — Run migration `00006_social.sql`: friendships table
- [TODO] 5.0.13 — Implement friends system: search by username, send/accept/decline friend requests
- [TODO] 5.0.14 — Implement room visiting: view friend's room (read-only, no defense info visible)
- [TODO] 5.0.15 — Implement raid cap: max 3 PvP raids received per day per player
- [TODO] 5.0.16 — Implement defense rating anti-sandbagging: snapshot rating before raid, compare to current
- [TODO] 5.0.17 — Implement reputation system: +RP for wins, -RP for losses, brackets

**Exit Criteria:** Safe mode expires. Players can raid each other asynchronously. Defenders get replays. Friends can visit each others' rooms. Matchmaking prevents unfair pairings.

---

## Phase 6: The Neighborhood Map (v0.3)
**Goal:** Instanced neighborhood map. NPC variety. Visual target selection.

- [TODO] 6.0.1 — Design neighborhood map layout: player room center, surrounding NPC slots
- [TODO] 6.0.2 — Implement `MapScene.ts` (or React-based map): top-down neighborhood view
- [TODO] 6.0.3 — Render player room as central building on map
- [TODO] 6.0.4 — Render NPC buildings at surrounding positions (scaled difficulty by distance from center)
- [TODO] 6.0.5 — Render friend rooms on map (if friends exist)
- [TODO] 6.0.6 — Map interaction: tap building → info popup → raid button
- [TODO] 6.0.7 — NPC building visual variety: house, apartment, store, warehouse, military outpost
- [TODO] 6.0.8 — Implement NPC room procedural generation: `generate-npc-room` Edge Function
- [TODO] 6.0.9 — NPC difficulty tiers 1-10 (expand from initial 1-3)
- [TODO] 6.0.10 — Map refresh: NPC buildings change on daily reset
- [TODO] 6.0.11 — Map navigation: pan/zoom across neighborhood

**Exit Criteria:** Player opens map, sees their neighborhood. NPC buildings of varying difficulty surround them. Friends appear. Tapping a building lets them raid it.

---

## Phase 7: Tech Tree & Loadouts (v0.4)
**Goal:** Strategic depth. Branching upgrades. Squad customization.

- [TODO] 7.0.1 — Create `tech-tree.json`: full tree structure with 3 branches, ~30 nodes
- [TODO] 7.0.2 — Implement tech tree UI: visual node graph, unlockable with tech points
- [TODO] 7.0.3 — Implement tech point earning: 1 per player level, bonus from certain quests
- [TODO] 7.0.4 — Tech tree effects: unlock new items, stat boosts, new abilities
- [TODO] 7.0.5 — Implement expanded loadout system: equipment slots per squad member
- [TODO] 7.0.6 — Implement squad member slots 2-4: unlocked via player level
- [TODO] 7.0.7 — Implement raid abilities: EMP grenade (disable turrets), medkit (heal), breaching charge (destroy barricade instantly)
- [TODO] 7.0.8 — Implement multi-entry raids: split squad across 2+ entry points
- [TODO] 7.0.9 — Add 10+ new defense items gated behind tech tree nodes
- [TODO] 7.0.10 — Balance pass: defense values, raid difficulty, resource costs across all content

**Exit Criteria:** Player can invest tech points into branching specializations. Squad is customizable with gear and abilities. Raids have tactical depth with multiple entry points and abilities.

---

## Phase 8: Polish & MVP Launch Prep
**Goal:** The game feels finished. Onboarding is smooth. Performance is solid.

- [TODO] 8.0.1 — Art pass: replace ALL placeholder sprites with consistent final art
- [TODO] 8.0.2 — Implement sound: background music (3 tracks), SFX (25+ sounds)
- [TODO] 8.0.3 — Implement `SoundManager.ts`: volume control, mute, contextual music switching
- [TODO] 8.0.4 — Onboarding flow polish: first-time user experience from register to first raid
- [TODO] 8.0.5 — Loading screen: branded, progress bar, tips/lore snippets
- [TODO] 8.0.6 — Performance audit: profile on low-end Android (budget phone), target 30fps minimum
- [TODO] 8.0.7 — PWA audit: Lighthouse score ≥90, offline functionality verified
- [TODO] 8.0.8 — Responsive design audit: test 320px–1440px widths
- [TODO] 8.0.9 — Security audit: RLS policies, Edge Function input validation, rate limiting
- [TODO] 8.0.10 — Accessibility pass: color contrast, font sizes, touch target sizes (48px min)
- [TODO] 8.0.11 — Error handling: graceful fallbacks, user-friendly error messages, Sentry coverage
- [TODO] 8.0.12 — Analytics: track key events (registration, first_raid, first_defense_placed, retention_d1/d7)
- [TODO] 8.0.13 — Create landing page (marketing): game description, screenshots, install CTA
- [TODO] 8.0.14 — Write Terms of Service, Privacy Policy
- [TODO] 8.0.15 — Beta test: invite 10-20 testers, collect feedback, iterate
- [TODO] 8.0.16 — Final bug fix sprint based on beta feedback

**Exit Criteria:** Game is publicly shippable. Smooth onboarding, consistent art, sound, solid performance on mobile, security hardened, analytics tracking.

---

## Future Phases (Post-Launch Backlog)

- [ ] Geo-located map via Mapbox GL JS integration
- [ ] Clan system: creation, management, clan bank, clan chat
- [ ] Joint raids: 2-4 player cooperative raids
- [ ] Seasonal battle pass framework
- [ ] Real-time PvP mode (WebSocket-based)
- [ ] Chat system (text): global, friends, clan channels
- [ ] Custom image uploads for wall posters (with moderation pipeline)
- [ ] Expanded room sizes: full apartment/house
- [ ] Named NPC raid bosses with story quests
- [ ] Community event framework
- [ ] District/territory control system (clan-based)
- [ ] Achievement system with cosmetic rewards
- [ ] Trading system between players
```