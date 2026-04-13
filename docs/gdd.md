# ROOM INVADERS — Game Design Document v1.0

## 1. Executive Summary

**Title:** Room Invaders
**Genre:** Asynchronous Strategy / Base-Builder / Raider
**Platform:** Progressive Web App (mobile-first, desktop-responsive)
**Perspective:** Isometric 2.5D
**Art Style:** Stylized low-poly/voxel hybrid — between Habbo Hotel's readability and Roblox's dimensionality
**Target Audience:** Ages 13–35, casual to mid-core strategy players
**Session Length:** 5–15 min daily maintenance, 30–60 min active play sessions
**Monetization:** Deferred (framework designed for F2P cosmetic model)
**Solo Dev + AI Agents | Ship fast, iterate often**

**Elevator Pitch:** Your bedroom is your last stronghold. Build it, fortify it, defend it — then kick down someone else's door and take their stuff. Set in a post-collapse world where every room is a battlefield, Room Invaders turns your personal space into a strategic warzone.

---

## 2. Core Concept & Design Pillars

**Concept:** Players build a digital recreation of their bedroom using a rich isometric editor, fortify it with traps and defenses, then raid other players' (and NPC) rooms for resources. Defense is automated; offense is player-controlled. The world map is seeded from real geography, making your neighbors your rivals.

### Design Pillars

| Pillar | Meaning |
|---|---|
| **My Room, My Fortress** | Emotional ownership. The room should feel personal. Customization is deep, not shallow. |
| **Fair Fight** | Standardized room dimensions and entry points. Skill and strategy win, not wallet or luck. |
| **Always Something To Do** | Daily quests, weekly events, PvE raids, PvP raids, room upgrades, tech tree. No dead sessions. |
| **Built To Grow** | Every system is modular. Architecture anticipates clans, real-time PvP, geo-maps, seasonal content, and systems that don't exist yet. |
| **Readable Tension** | The isometric view must communicate information clearly. A player should look at a room and *feel* whether it's dangerous. |

---

## 3. Setting & Lore

### The Fracture

Six months ago, the federal government collapsed in 72 hours. No war, no bombs — just a cascade failure. Power grid, supply chains, communications. The military fractured into competing factions. Police dissolved. Banks locked. In three days, every city became an island.

Now it's every household for itself.

You woke up in your room. The door is locked. The power flickers. Your phone gets one last broadcast: *"Secure your position. Trust no one. The Network is watching."*

**The Network** — a pirate radio/mesh-net collective — becomes the player's guide. They issue quests, coordinate supply drops, and maintain a fragile peace through "Safe Zones" for new survivors. But Safe Zones expire. Eventually, everyone is a target.

### Narrative Hooks for Expansion
- **Faction storylines** — align with military remnants, Network operatives, or go independent
- **The truth behind The Fracture** — long-form story quests over seasons
- **Named NPC rivals** — recurring raid bosses with personality and lore
- **Community-driven events** — "A faction is moving into your district..."

---

## 4. Core Gameplay Loop

```
┌─────────────────────────────────────────────────────┐
│                  PRIMARY LOOP (minutes)              │
│  Build/Edit Room → Place Defenses → Raid → Collect  │
│         ▲                                  │        │
│         └──────────── Loot ◄───────────────┘        │
├─────────────────────────────────────────────────────┤
│                SECONDARY LOOP (hours/days)           │
│  Complete Quests → Unlock Items → Upgrade Room      │
│  → Expand Tech Tree → Increase Defense Rating       │
├─────────────────────────────────────────────────────┤
│               TERTIARY LOOP (weeks/months)           │
│  Climb Ranks → Join Clan → Compete in Seasons       │
│  → Prestige Content → Leaderboards                  │
├─────────────────────────────────────────────────────┤
│                 META LOOP (months/years)             │
│  Seasonal Content → New Game Modes → Expansions     │
│  → Community Events → Live Ops                      │
└─────────────────────────────────────────────────────┘
```

### Session Flow (Typical Daily)
1. Open app → see overnight raid reports (if any)
2. Repair/adjust defenses
3. Check quest board → accept dailies
4. Run 1–3 raids (PvE or PvP)
5. Spend earned resources on upgrades
6. Tweak room layout
7. Close app (defenses remain active)

---

## 5. Detailed Mechanics

### 5.1 Room Building & Customization

**Grid:** Standardized 10×10 isometric tile grid (expandable to 12×12 and 14×14 via room level upgrades).

**Structural Standardization (Fairness):**
All rooms have identical structural parameters at each room level:

| Room Level | Grid Size | Entry Points | Defense Slots | Furniture Cap |
|---|---|---|---|---|
| 1 | 10×10 | 3 (Door, Window, Vent) | 8 | 15 |
| 5 | 10×10 | 4 (+Skylight) | 16 | 25 |
| 10 | 12×12 | 5 (+Breach Wall) | 28 | 40 |
| 15 | 12×12 | 6 (+Second Window) | 40 | 55 |
| 20 | 14×14 | 7 (+Tunnel) | 55 | 75 |

**Cosmetic Customization (Expression):**
- **Walls:** Color picker, material (paint, brick, wood paneling, concrete, wallpaper patterns)
- **Floors:** Hardwood, carpet, tile, concrete — color variants
- **Furniture:** 50+ items at launch. Categories:
  - Sleep (beds: twin, full, bunk, futon, mattress-on-floor)
  - Work (desks, chairs, monitors, laptops)
  - Storage (shelves, dressers, closets, safes)
  - Entertainment (TV, gaming setup, speakers, instruments)
  - Comfort (couch, bean bag, rug, curtains)
  - Decor (plants, posters, figures, lighting, tapestries)
- **Custom Uploads:** Players upload images → displayed as wall posters/art (moderated)
- **Lighting:** Overhead, desk lamp, RGB LED strips, window light — affects mood, no gameplay impact
- **Themes:** Pre-built starter templates (Gamer Den, Minimalist, Dorm Room, Bunker, etc.)

**Furniture serves dual purpose:**
- Cosmetic: makes the room yours
- Strategic: furniture blocks movement. Attackers must path around or destroy. A room full of furniture is a maze. An empty room is a killing field. Players balance aesthetics and defense.

### 5.2 Fortification & Defense System

Defenses are placed on the room grid during "Edit Mode." They activate automatically during raids.

**Defense Categories:**

| Category | Examples | Behavior |
|---|---|---|
| **Floor Traps** | Pressure Plate, Spike Strip, Shock Pad, Glue Trap | Triggered when an attacker steps on the tile. Single-use or multi-use depending on tier. |
| **Wall Traps** | Dart Launcher, Flame Vent, Net Launcher | Mounted on walls. Triggered by proximity or tripwire. Covers a cone/line. |
| **Turrets** | Nail Gun Turret, Taser Turret, Paintball Sentry | Auto-targets nearest attacker in range. Limited ammo. |
| **Barricades** | Bookshelf Barricade, Flipped Table, Sandbags | Blocks tiles. Has HP. Attackers must destroy or path around. |
| **Alarms** | Motion Sensor, Laser Grid, Camera | Doesn't deal damage. Triggers other defenses, alerts guard NPCs (if present), reduces attacker's intel. |
| **Guards** | Guard Dog, Drone, Roomba Mine (lol) | Mobile defense units. Patrol set routes. Engage attackers. |

**Defense Rating:** Calculated from total defense value. Used for matchmaking. Prevents sandbagging (stripping defenses to lower rating, then rebuilding after a match).

**Validation:** Server validates room layout on save. Prevents illegal placements (traps on entry point tiles, overlapping items, exceeding slot limits).

### 5.3 Raid System (Offense)

**Raid Flow:**

```
[Select Target] → [Scout] → [Prep Loadout] → [Choose Entry] → [Execute Raid] → [Results]
```

1. **Target Selection:** Browse map for NPC buildings or player rooms. See: difficulty rating, potential loot range, distance, defense rating.
2. **Scout (costs Intel):** Reveals partial room layout — entry points and some obstacles. Higher intel spend = more revealed. Scouting is optional.
3. **Loadout:** Select squad members (start with 1, unlock up to 4). Equip gear (breach tools, medkits, EMP grenades, shields). Each squad member has an equipment slot limit.
4. **Entry Point:** Choose which entry point(s) to breach from. Multiple entry points = split forces, flank defenses. Single entry = concentrated power.
5. **Execute:** Isometric view of target room. Player issues move commands to squad. Traps trigger. Turrets fire. Player uses abilities (EMP to disable turrets, medkit to heal, breaching charge to destroy barricades). **Time limit** based on raid difficulty.
6. **Objective:** Reach the **Loot Stash** (fixed location: center of room or marked tile). Hold position for extraction timer. Escape with loot.
7. **Results:** XP gained, resources looted, squad damage taken (healing cost), replay generated for defender.

**Loot Protection:**
- Stash has a **protected amount** (based on storage upgrades) that can never be raided
- Only **overflow** (resources above protected capacity) is raidable
- Defender never loses more than 20% of total resources per raid
- Shield activates for 8 hours post-raid (cannot be raided again)

**NPC Raids:**
- NPC rooms are procedurally generated based on difficulty tier (1-10)
- Fixed loot tables per tier
- No revenge mechanic
- Respawn on cooldown (can't farm the same NPC infinitely)
- Story-quest NPCs have hand-crafted rooms and unique loot

### 5.4 Resource Economy

| Resource | Source | Primary Use | Raidable? |
|---|---|---|---|
| **Scrap** | NPC raids, quests, passive gen | Basic construction, repairs, barricades | Yes |
| **Components** | PvE raids (tier 3+), quests | Traps, turrets, electronics | Yes |
| **Credits** | Quest rewards, daily login, NPC raids | Shop purchases, upgrades | Yes |
| **Contraband** | PvP raids, weekly missions, high-tier PvE | High-tier items, prestige upgrades | Yes |
| **Intel** | Passive gen, quest rewards | Scouting before raids | No |

**Resource Generation:**
- Small passive generation while offline (scrap/intel only, slow rate)
- Boosted by certain furniture items (workbench generates components, radio generates intel)
- Capped by storage — must collect or it stops generating

**Economic Sink Design:**
- Repairs after being raided (scrap)
- Trap re-arming after triggering (components)
- Squad healing after raids (credits)
- Room level upgrades (large resource dumps)
- Tech tree unlocks (escalating costs)
- Cosmetic purchases (credits, contraband)

### 5.5 Quest System

| Type | Frequency | Example | Reward Scale |
|---|---|---|---|
| **Tutorial** | One-time | "Place your first trap" | Guided unlocks |
| **Daily** | 3 per day, reset at midnight | "Raid 2 NPC rooms" / "Rearrange 5 furniture" | Low-medium |
| **Weekly** | 3 per week | "Successfully defend 3 raids" / "Raid a Tier 5+ NPC" | Medium-high |
| **Story** | Permanent, sequential | "The Network needs you to investigate Sector 7..." | High + unique items |
| **Special/Event** | Limited time | "Halloween: Survive the Haunted House" | Exclusive cosmetics |

**Initial Quest Sequence (New Player Onboarding):**
1. "Wake Up" — View your room for the first time
2. "Make It Yours" — Place 3 furniture items
3. "Lock the Door" — Place your first trap
4. "Know Your Enemy" — Scout an NPC room
5. "First Strike" — Raid an NPC room (tutorial difficulty)
6. "Spoils of War" — Spend resources on an upgrade
7. "Dig In" — Reach Defense Rating 50
8. "Safe Mode Briefing" — Explanation of safe mode timer and PvP

### 5.6 Map & World

**MVP — Instanced Neighborhood:**
- Each player sees a "block" view — their room in the center, surrounded by 15-20 NPC buildings
- NPC buildings refresh based on player level (harder ones appear as you level)
- Friends appear as named buildings on the map (visitable, raidable if out of safe mode)
- Map is stylized top-down / slight isometric — not Google Maps, but feels like a neighborhood

**V2 — Geo-Located City Map:**
- Integrate Mapbox GL JS
- Player pins their room to their real address
- Actual streets and building footprints rendered in game art style
- Other Room Invaders players appear at their real locations
- NPC buildings fill empty real-world addresses
- Proximity-based discovery: "A new player appeared 2 blocks from you"
- District control: clans contest control of neighborhoods (future)

### 5.7 Safe Mode (New Player Protection)

- Activated on account creation
- Duration: 7 real-time days OR until player manually deactivates
- During Safe Mode:
  - Room **cannot** be raided by other players
  - Player **cannot** raid other players (PvE only)
  - Full access to building, customization, quests, NPC raids
  - UI shows countdown timer prominently
- Narrative justification: "The Network is broadcasting your Safe Zone signal. In 7 days, the signal dies."
- Purpose: Give players time to learn mechanics, build defenses, accumulate resources before exposure to PvP

---

## 6. Progression Systems

### 6.1 Player Level & XP (1–100+)

XP gained from: raids (attack), successful defenses, quest completion, first-time achievements.

**Milestone Unlocks:**
- Level 3: Second trap type unlocked
- Level 5: PvP raiding enabled (if safe mode expired)
- Level 8: Tech tree access
- Level 10: Squad member slot 2
- Level 15: Room expansion (12×12)
- Level 20: Clan creation/joining
- Level 25: Squad member slot 3
- Level 30+: Prestige cosmetics, advanced content

### 6.2 Room Level (1–20)

Upgraded by spending large resource amounts. Unlocks:
- Grid size increases
- Additional entry points
- More defense slots
- Higher furniture cap
- New defense types
- Higher passive resource generation

Room level is the primary matchmaking input for PvP.

### 6.3 Tech Tree

Three branches. Players spend **Tech Points** (earned from leveling + quests):

```
                    [TECH TREE]
                   /     |      \
            OFFENSE   DEFENSE   UTILITY
            /    \     /    \     /    \
        Squad  Gear  Traps Turrets Intel  Economy
```

- **Offense/Squad:** More squad members, better HP/speed
- **Offense/Gear:** Better breach tools, EMP, flashbangs
- **Defense/Traps:** Advanced traps, multi-trigger, chain reactions
- **Defense/Turrets:** Longer range, higher damage, special ammo
- **Utility/Intel:** Cheaper scouting, auto-scout on defense, counter-intel
- **Utility/Economy:** Higher storage cap, faster generation, trade unlocks

### 6.4 Reputation & Ranking

- **Reputation Points (RP):** +RP for successful attacks, +RP for successful defenses, -RP for failed attacks
- **Brackets:** Survivor (0-500) → Raider (500-1500) → Warlord (1500-3000) → Overlord (3000+)
- **Seasonal Reset:** RP soft-resets each season. End-of-season rewards based on bracket.
- **Leaderboards:** Global, Regional (if geo-enabled), Friends

---

## 7. Social Systems

| Feature | MVP? | Description |
|---|---|---|
| **Friends List** | Yes | Add by username. See online status, visit rooms, raid (post-safe-mode). |
| **Raid Replays** | Yes | Share replay links. Watch how your defense held or failed. |
| **Chat** | Post-MVP | Text chat: global, friends, clan channels. |
| **Clans** | Post-MVP | 10-50 members. Clan bank, joint raids, clan wars, clan leaderboard. |
| **Joint Raids** | Post-MVP | 2-4 players coordinate a raid on a single target. Each controls their squad. |
| **Voice Chat** | Future | During joint raids and clan activities. |

---

## 8. UI/UX Design

### Screen Map

```
[Landing Page / Auth]
        │
[Home - Room View] ◄──── Primary Hub
   │    │    │    │
   │    │    │    └── [Profile / Settings]
   │    │    └── [Quest Board]
   │    └── [Map View] → [Target Selection] → [Scout] → [Raid Prep] → [Raid Active] → [Results]
   └── [Room Editor] (toggle from Room View)
              │
         [Inventory] ◄──► [Tech Tree]
```

### Navigation
- **Bottom Nav Bar** (5 slots, thumb-reachable):  `🏠 Room` | `🗺️ Map` | `⚔️ Raid` | `📋 Quests` | `👤 Profile`
- **Contextual HUD** (overlays during gameplay): Resource bar (top), action buttons (bottom), minimap (corner)
- **Room Editor** accessed via toggle button from Room View. Same screen, different mode.

### UX Principles
- **Touch-first:** All interactions designed for thumb reach on mobile. Desktop gets hover states and keyboard shortcuts as bonus.
- **Progressive disclosure:** New players see simplified UI. Features reveal as they level/unlock.
- **Visual affordances:** Traps glow when armed. Damaged items show cracks. Resource bars pulse when full.
- **No text walls:** Tutorial is play-driven. Tooltips on demand. Lore delivered through quest dialogue, not menus.
- **Offline-capable PWA:** Service worker caches room editor, inventory, and static assets. Room editing works offline, syncs on reconnect.

---

## 9. Monetization Framework (Deferred)

Architecture will support the following when activated. **No pay-to-win. Ever.** This is a design pillar commitment.

| Category | Examples | Notes |
|---|---|---|
| **Cosmetics** | Room themes, furniture skins, avatar outfits, trap skins, custom entry animations | Primary revenue driver |
| **Battle Pass** | Seasonal pass with free + premium reward tracks | Content cadence driver |
| **Convenience** | Instant repair, extra daily quests, resource boost (capped) | Must not create power gap |
| **Custom Uploads** | Premium feature: upload custom poster images | Low moderation cost gate |

Premium currency: **Fracture Coins (FC)** — purchased with real money, spent on cosmetic shop items. Never purchasable with gameplay resources. Never buys power.

---

## 10. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | Next.js 14+ (App Router, TypeScript) | SSR, PWA-native via `next-pwa`, Vercel-optimized, top-tier AI-agent documentation coverage |
| **Game Engine** | Phaser 3.80+ | Battle-tested browser game engine, isometric tilemap support, WebGL rendering, excellent plugin ecosystem |
| **UI Components** | TailwindCSS + shadcn/ui | Rapid, polished UI for menus/HUD. Phaser handles in-game rendering. |
| **Client State** | Zustand | Lightweight, React-native, bridges React UI ↔ Phaser game state |
| **Backend** | Supabase (hosted) | PostgreSQL, Auth, Realtime subscriptions, Edge Functions (Deno), Storage. Eliminates 80% of backend work for solo dev. |
| **Server Logic** | Supabase Edge Functions | Raid resolution, defense validation, matchmaking, quest processing. Deno runtime. |
| **Maps (Future)** | Mapbox GL JS | Superior custom styling vs Google Maps, generous free tier, offline-capable |
| **Hosting** | Vercel | Next.js native, global CDN, edge middleware, auto-scaling, free tier covers MVP |
| **Asset CDN** | Supabase Storage + Cloudflare | User uploads + game assets |
| **Error Tracking** | Sentry | Real-time error monitoring, session replay |
| **Analytics** | Vercel Analytics + PostHog (future) | Core metrics + product analytics for retention tuning |

---

## 11. Asset Requirements

### Art (MVP Minimums)

| Category | Count | Notes |
|---|---|---|
| Isometric floor tiles | 8 types × 4 color variants | Wood, carpet, tile, concrete... |
| Wall segments | 6 types × 4 colors | Paint, brick, wood panel, concrete... |
| Furniture | 30 items minimum | Covers all categories in 5.1 |
| Traps/Defenses | 12 types | 2-3 per category in 5.2 |
| Characters | 4 squad member variants | 8-directional walk + idle + action |
| NPC Characters | 6 enemy types | Varying difficulty appearance |
| UI Icons | 60+ | Resources, items, actions, navigation |
| Map tiles | 10 building types + road | For neighborhood view |
| VFX sprites | 15 | Explosions, sparks, smoke, heal, shield |
| Posters/Decor | 20 default options | Players can also upload custom |

### Audio (MVP)
- 3 music tracks (ambient, tension, combat)
- 20-30 SFX (footsteps, trap triggers, UI clicks, combat hits, loot pickup, notifications)

### Art Pipeline Strategy (Solo Dev)
- **Phase 1:** Placeholder art (colored rectangles, free asset packs, kenney.nl)
- **Phase 2:** AI-generated concept art → manual cleanup → sprite sheet creation
- **Phase 3:** Commission key character art and hero furniture pieces
- **Phase 4:** Consistent art pass before public launch

---

## 12. MVP Scope Definition

**MVP = "One Room, One Raid"**

A single player can:
1. ✅ Create account, log in
2. ✅ Build and customize a room (10×10 grid, 15 furniture items, starter set)
3. ✅ Place defenses (5 trap types, 2 barricade types)
4. ✅ View room in isometric perspective
5. ✅ Complete tutorial quest sequence (8 quests)
6. ✅ Raid NPC rooms (3 difficulty tiers, 5 rooms per tier)
7. ✅ Earn and spend resources (Scrap, Components, Credits)
8. ✅ Safe mode active (7-day timer)
9. ✅ Save/load room state (persistent)
10. ✅ PWA installable, works on mobile and desktop

**Explicitly NOT in MVP:**
- ❌ PvP raiding
- ❌ Friends system
- ❌ Map view (raids accessed from a list)
- ❌ Tech tree
- ❌ Clans
- ❌ Leaderboards
- ❌ Sound/music
- ❌ Custom image uploads
- ❌ Geo-location

---

## 13. Expansion Roadmap

| Version | Codename | Key Features |
|---|---|---|
| **v0.1** | First Room | MVP as defined above |
| **v0.2** | First Blood | PvP async raids, matchmaking, defense replays, safe mode expiration |
| **v0.3** | The Block | Instanced neighborhood map, more NPC variety, daily/weekly quests |
| **v0.4** | Gear Up | Tech tree, expanded loadout system, squad upgrades |
| **v0.5** | Open Doors | Friends list, room visiting, revenge raids |
| **v0.6** | The Network | Clans, clan chat, clan raids |
| **v0.7** | City Limits | Mapbox geo-located map, real-world positioning |
| **v0.8** | Season One | Battle pass, seasonal ranking, event quests, cosmetic shop |
| **v0.9** | War Room | Real-time PvP mode, joint raids |
| **v1.0** | Full Fracture | Public launch, full feature set, marketing push |

---

## 14. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Scope creep — solo dev, massive vision | **Critical** | Strict MVP. Ship playable v0.1 before adding ANY v0.2 features. Phases are iron walls. |
| Phaser ↔ React integration complexity | High | Isolate Phaser in a single canvas component. Communication via Zustand store + event bus. Prototype this FIRST. |
| Isometric rendering performance on mobile PWA | High | Tile culling, sprite batching, lazy loading. Profile early on low-end Android. |
| Anti-cheat for async raids | High | Server-authoritative raid resolution from v0.2. MVP (PvE only) can be client-side. |
| Art consistency (AI-gen + placeholders + commissions) | Medium | Establish a strict style guide before Phase 2 art pass. Consistent palette, outline weight, proportions. |
| Player retention before PvP exists | Medium | Strong quest chain, NPC raid variety, room customization depth must carry the pre-PvP experience. |
| User-uploaded content moderation | Medium | Defer custom uploads until moderation pipeline exists. Use pre-made poster options for MVP. |

---

*End of GDD v1.0. All subsequent documents are derived from this.*

---