# architecture.md — Room Invaders
## Version: 0.0.1 | Last Updated: 2025-07-10

---

## 1. High-Level System Design

### System Topology

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (PWA)                          │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │    React UI Layer    │◄──►│     Phaser 3 Game Engine     │ │
│  │  (Next.js App Router │    │  (Isometric Canvas Renderer) │ │
│  │   TailwindCSS/shadcn)│    │                              │ │
│  └──────────┬──────────┘    └──────────────┬───────────────┘ │
│             │         ┌──────────┐         │                 │
│             └────────►│  Zustand  │◄────────┘                │
│                       │  (State)  │                          │
│                       └─────┬────┘                           │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │  Supabase SDK   │                       │
│                    │  (Client-side)  │                       │
│                    └────────┬────────┘                       │
└─────────────────────────────┼────────────────────────────────┘
                              │ HTTPS / WSS
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     SUPABASE BACKEND                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │   Auth   │  │ Postgres │  │   Edge     │  │  Storage  │  │
│  │ (JWT,    │  │ (RLS,    │  │ Functions  │  │ (Assets,  │  │
│  │  OAuth)  │  │  pg_cron)│  │ (Deno)     │  │  Uploads) │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────┘  │
│                                                              │
│  Edge Functions:                                             │
│  • resolve-raid — server-authoritative raid validation       │
│  • validate-defense — legal room layout enforcement          │
│  • generate-npc-room — procedural NPC room creation          │
│  • matchmaking — PvP target selection (v0.2+)                │
│  • process-quest — quest completion validation               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                        VERCEL                                │
│  • Next.js SSR / SSG hosting                                 │
│  • Global CDN for static assets                              │
│  • Edge Middleware (auth guards, redirects)                   │
│  • PWA manifest + service worker serving                     │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow — Raid Execution

```
Client                          Edge Function              Database
  │                                  │                        │
  │─── 1. Request raid target ──────►│                        │
  │                                  │── 2. Load target ─────►│
  │                                  │◄── 3. Room layout ─────│
  │◄── 4. Room data (filtered) ──────│                        │
  │                                  │                        │
  │  [Player plays raid locally]     │                        │
  │                                  │                        │
  │─── 5. Submit action log ────────►│                        │
  │                                  │── 6. Validate log ────►│
  │                                  │   (replay simulation)  │
  │                                  │── 7. Commit results ──►│
  │◄── 8. Confirmed results ────────│                        │
  │                                  │                        │
```

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Language | TypeScript | 5.x |
| Frontend Framework | Next.js (App Router) | 14+ |
| Game Engine | Phaser | 3.80+ |
| CSS Framework | TailwindCSS | 3.x |
| UI Components | shadcn/ui | latest |
| Client State | Zustand | 4.x |
| Backend Platform | Supabase | latest hosted |
| Database | PostgreSQL (via Supabase) | 15+ |
| Server Functions | Supabase Edge Functions (Deno) | latest |
| Hosting/CDN | Vercel | Pro (when needed) |
| Maps (Future) | Mapbox GL JS | 3.x |
| Error Tracking | Sentry | latest |
| Package Manager | pnpm | 9.x |

---

## 3. Repository Structure

```
room-invaders/
├── public/
│   ├── assets/
│   │   ├── sprites/
│   │   │   ├── furniture/          # Isometric furniture spritesheets
│   │   │   ├── traps/              # Trap/defense sprites
│   │   │   ├── characters/         # Squad + NPC spritesheets
│   │   │   ├── tiles/              # Floor + wall tilesets
│   │   │   └── effects/            # VFX sprite animations
│   │   ├── audio/
│   │   │   ├── music/
│   │   │   └── sfx/
│   │   ├── ui/                     # UI icons, backgrounds
│   │   └── maps/                   # Map view tilesets
│   ├── icons/                      # PWA icons (192, 512, etc.)
│   └── manifest.json               # PWA manifest
│
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── (game)/
│   │   │   ├── room/
│   │   │   │   └── page.tsx        # Room view + editor
│   │   │   ├── map/
│   │   │   │   └── page.tsx        # Neighborhood map
│   │   │   ├── raid/
│   │   │   │   ├── [targetId]/
│   │   │   │   │   └── page.tsx    # Active raid screen
│   │   │   │   └── page.tsx        # Raid target selection
│   │   │   ├── quests/
│   │   │   │   └── page.tsx
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx          # Game layout (nav, HUD)
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Landing page
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── game/                   # React wrappers for Phaser
│   │   │   ├── GameCanvas.tsx      # Mounts Phaser instance
│   │   │   ├── RoomView.tsx        # Room display wrapper
│   │   │   ├── RaidView.tsx        # Raid gameplay wrapper
│   │   │   └── MapView.tsx         # Map display wrapper
│   │   ├── hud/                    # In-game overlay components
│   │   │   ├── ResourceBar.tsx
│   │   │   ├── ActionMenu.tsx
│   │   │   ├── DefensePanel.tsx
│   │   │   └── RaidTimer.tsx
│   │   └── layout/
│   │       ├── BottomNav.tsx
│   │       ├── TopBar.tsx
│   │       └── AuthGuard.tsx
│   │
│   ├── game/                       # Pure Phaser code (no React)
│   │   ├── PhaserGame.ts           # Phaser.Game factory
│   │   ├── config.ts               # Phaser config constants
│   │   ├── scenes/
│   │   │   ├── BootScene.ts        # Asset preloading
│   │   │   ├── RoomScene.ts        # Room view (read-only)
│   │   │   ├── RoomEditorScene.ts  # Room edit mode
│   │   │   ├── RaidScene.ts        # Raid gameplay
│   │   │   └── PreloaderScene.ts   # Loading screen
│   │   ├── objects/                # Phaser GameObjects
│   │   │   ├── IsometricTile.ts
│   │   │   ├── FurnitureSprite.ts
│   │   │   ├── TrapSprite.ts
│   │   │   ├── TurretSprite.ts
│   │   │   ├── BarricadeSprite.ts
│   │   │   ├── CharacterSprite.ts
│   │   │   └── EntryPoint.ts
│   │   ├── systems/                # Game logic systems
│   │   │   ├── GridSystem.ts       # Tile grid management
│   │   │   ├── IsometricEngine.ts  # Coordinate transforms
│   │   │   ├── PathfindingSystem.ts # A* on grid
│   │   │   ├── CombatSystem.ts     # Damage calc, HP tracking
│   │   │   ├── TrapSystem.ts       # Trap trigger logic
│   │   │   ├── DefenseAI.ts        # Turret targeting, guard patrol
│   │   │   └── LootSystem.ts       # Loot calc on raid complete
│   │   ├── managers/               # Singleton-pattern managers
│   │   │   ├── AssetManager.ts
│   │   │   ├── RoomManager.ts      # Room state ↔ grid sync
│   │   │   ├── RaidManager.ts      # Raid flow state machine
│   │   │   ├── InputManager.ts     # Touch/click → grid coord
│   │   │   └── SoundManager.ts
│   │   └── utils/
│   │       ├── isometric.ts        # worldToScreen, screenToWorld
│   │       ├── constants.ts        # TILE_WIDTH, TILE_HEIGHT, etc.
│   │       └── helpers.ts
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser Supabase client
│   │   │   ├── server.ts           # Server-side Supabase client
│   │   │   ├── middleware.ts        # Auth middleware for Next.js
│   │   │   └── types.ts            # Generated DB types
│   │   ├── store/                  # Zustand state stores
│   │   │   ├── useGameStore.ts     # Global game state
│   │   │   ├── useRoomStore.ts     # Room layout + items
│   │   │   ├── useRaidStore.ts     # Active raid state
│   │   │   ├── usePlayerStore.ts   # Player stats + resources
│   │   │   └── useUIStore.ts       # UI mode, menus, modals
│   │   ├── hooks/                  # React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useRoom.ts
│   │   │   ├── useRaid.ts
│   │   │   ├── useQuests.ts
│   │   │   └── useResources.ts
│   │   └── utils/
│   │       ├── api.ts              # Supabase query helpers
│   │       └── validators.ts       # Shared validation logic
│   │
│   ├── data/                       # Static game data (JSON)
│   │   ├── furniture.json
│   │   ├── traps.json
│   │   ├── items.json
│   │   ├── quests.json
│   │   ├── npc-rooms.json
│   │   └── tech-tree.json
│   │
│   └── types/                      # TypeScript type definitions
│       ├── game.ts
│       ├── room.ts
│       ├── raid.ts
│       ├── player.ts
│       ├── items.ts
│       └── index.ts
│
├── supabase/
│   ├── migrations/                 # SQL migrations (ordered)
│   │   ├── 00001_profiles.sql
│   │   ├── 00002_rooms.sql
│   │   ├── 00003_items_inventory.sql
│   │   ├── 00004_raids.sql
│   │   ├── 00005_quests.sql
│   │   └── 00006_social.sql
│   ├── functions/                  # Edge Functions
│   │   ├── resolve-raid/
│   │   │   └── index.ts
│   │   ├── validate-defense/
│   │   │   └── index.ts
│   │   ├── generate-npc-room/
│   │   │   └── index.ts
│   │   └── process-quest/
│   │       └── index.ts
│   ├── seed.sql                    # Dev seed data
│   └── config.toml                 # Supabase local config
│
├── docs/
│   ├── GDD.md
│   ├── architecture.md             # This file
│   ├── tasks.md
│   ├── changelog.md
│   └── handoff.md
│
├── tests/
│   ├── game/                       # Game logic unit tests
│   │   ├── GridSystem.test.ts
│   │   ├── PathfindingSystem.test.ts
│   │   ├── CombatSystem.test.ts
│   │   └── isometric.test.ts
│   └── api/                        # Edge function tests
│       ├── resolve-raid.test.ts
│       └── validate-defense.test.ts
│
├── .env.local                      # Local env vars (gitignored)
├── .env.example                    # Template env vars
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml
├── sentry.client.config.ts
└── README.md
```

---

## 4. Database Schema (PostgreSQL via Supabase)

### Core Tables

```sql
-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    player_level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    reputation INTEGER NOT NULL DEFAULT 0,
    safe_mode_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    tutorial_step INTEGER NOT NULL DEFAULT 0,
    tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ROOMS
-- ============================================
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    room_level INTEGER NOT NULL DEFAULT 1,
    grid_size INTEGER NOT NULL DEFAULT 10,
    layout JSONB NOT NULL DEFAULT '[]',
    cosmetics JSONB NOT NULL DEFAULT '{}',
    entry_points JSONB NOT NULL DEFAULT '[
        {"type":"door","wall":"south","position":5},
        {"type":"window","wall":"east","position":5},
        {"type":"vent","wall":"north","position":5}
    ]',
    defense_rating INTEGER NOT NULL DEFAULT 0,
    times_raided INTEGER NOT NULL DEFAULT 0,
    last_raided_at TIMESTAMPTZ,
    shield_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id)  -- one room per player (MVP)
);

-- ============================================
-- INVENTORIES
-- ============================================
CREATE TABLE inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scrap INTEGER NOT NULL DEFAULT 200,
    components INTEGER NOT NULL DEFAULT 50,
    credits INTEGER NOT NULL DEFAULT 100,
    contraband INTEGER NOT NULL DEFAULT 0,
    intel INTEGER NOT NULL DEFAULT 10,
    storage_capacity INTEGER NOT NULL DEFAULT 500,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id)
);

-- ============================================
-- ITEMS (master catalog)
-- ============================================
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN (
        'furniture','trap','turret','barricade','cosmetic','consumable','guard'
    )),
    name TEXT NOT NULL,
    description TEXT,
    tier INTEGER NOT NULL DEFAULT 1,
    cost JSONB NOT NULL DEFAULT '{}',
    stats JSONB NOT NULL DEFAULT '{}',
    footprint JSONB NOT NULL DEFAULT '{"w":1,"h":1}',
    sprite_key TEXT NOT NULL,
    unlock_level INTEGER NOT NULL DEFAULT 1,
    tech_tree_node TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PLAYER_ITEMS (inventory instances)
-- ============================================
CREATE TABLE player_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    placed_in_room BOOLEAN NOT NULL DEFAULT FALSE,
    grid_position JSONB,  -- {"x":3,"y":5} if placed
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- RAIDS
-- ============================================
CREATE TABLE raids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attacker_id UUID NOT NULL REFERENCES profiles(id),
    defender_id UUID REFERENCES profiles(id),  -- NULL for NPC raids
    npc_room_id TEXT,  -- references npc-rooms.json entry
    status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN (
        'preparing','in_progress','completed','abandoned'
    )),
    result TEXT CHECK (result IN ('victory','defeat','partial')),
    attacker_loadout JSONB NOT NULL DEFAULT '{}',
    action_log JSONB NOT NULL DEFAULT '[]',
    replay_data JSONB,
    loot_gained JSONB NOT NULL DEFAULT '{}',
    loot_lost JSONB NOT NULL DEFAULT '{}',
    xp_gained INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- QUESTS (master definitions - can also live in JSON)
-- ============================================
CREATE TABLE player_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quest_key TEXT NOT NULL,  -- references quests.json
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active','completed','abandoned'
    )),
    progress JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- TECH TREE PROGRESS
-- ============================================
CREATE TABLE tech_tree_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, node_id)
);

-- ============================================
-- SEASONAL BATTLE PASS (Milestone 9F)
-- ============================================
CREATE TABLE battle_pass_tiers (
    season_id TEXT NOT NULL,
    tier_number INTEGER NOT NULL CHECK (tier_number >= 1),
    required_xp INTEGER NOT NULL CHECK (required_xp >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (season_id, tier_number)
);

CREATE TABLE player_battle_pass_progress (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    season_id TEXT NOT NULL,
    current_tier INTEGER NOT NULL DEFAULT 1 CHECK (current_tier >= 1),
    current_xp INTEGER NOT NULL DEFAULT 0 CHECK (current_xp >= 0),
    is_premium_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_free_rewards INTEGER[] NOT NULL DEFAULT '{}',
    claimed_premium_rewards INTEGER[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, season_id),
    FOREIGN KEY (season_id, current_tier) REFERENCES battle_pass_tiers(season_id, tier_number)
);

CREATE TABLE battle_pass_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id TEXT NOT NULL,
    tier_number INTEGER NOT NULL,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('scrap', 'components', 'credits', 'contraband', 'intel', 'item', 'xp')),
    reward_amount INTEGER NOT NULL DEFAULT 1 CHECK (reward_amount >= 1),
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (season_id, tier_number) REFERENCES battle_pass_tiers(season_id, tier_number) ON DELETE CASCADE
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_rooms_owner ON rooms(owner_id);
CREATE INDEX idx_rooms_defense_rating ON rooms(defense_rating);
CREATE INDEX idx_player_items_owner ON player_items(owner_id);
CREATE INDEX idx_raids_attacker ON raids(attacker_id);
CREATE INDEX idx_raids_defender ON raids(defender_id);
CREATE INDEX idx_raids_status ON raids(status);
CREATE INDEX idx_player_quests_player ON player_quests(player_id);
```

### Row-Level Security (RLS) Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | Own row + public fields of others | Trigger on auth signup | Own row only | Never (soft delete) |
| rooms | Own room + opponent room during raid | Own only | Own only | Own only |
| inventories | Own only | Own only | Own only | Never |
| player_items | Own only | Own only | Own only | Own only |
| raids | Participant only | Own as attacker | Participants only | Never |
| player_quests | Own only | Own only | Own only | Own only |
| battle_pass_tiers | Publicly readable | System managed | System managed | System managed |
| battle_pass_rewards | Publicly readable | System managed | System managed | System managed |
| player_battle_pass_progress | Own progress only | Own only | Own only | Never |

---

## 5. Component Communication

### React ↔ Phaser Bridge

Phaser runs in a single `<canvas>` element managed by `GameCanvas.tsx`. Communication is mediated exclusively through Zustand stores and a typed event bus.

```
React Component
     │
     ├── reads from ──► Zustand Store ◄── writes to ── Phaser Scene
     │                                                      │
     └── dispatches ──► EventBus.emit('event') ── listens ──┘
```

**Rules:**
1. React never directly calls Phaser scene methods.
2. Phaser never directly calls React setState.
3. All shared state lives in Zustand.
4. One-off commands (e.g., "switch to edit mode") use a typed EventBus.
5. Phaser scenes read game data from Zustand on scene init.
6. Phaser scenes write back to Zustand on state changes (item placed, unit moved).

---

## 6. Isometric Engine Spec

| Parameter | Value |
|---|---|
| Tile width | 64px |
| Tile height | 32px |
| Coordinate system | Cartesian grid (x, y) → isometric projection |
| World-to-screen | `screenX = (x - y) * (TILE_W / 2) + offsetX` |
| | `screenY = (x + y) * (TILE_H / 2) + offsetY` |
| Screen-to-world | Inverse of above (for input handling) |
| Z-layers | 0: Floor, 1: Ground objects, 2: Wall-mounted, 3: Ceiling, 4: VFX |
| Camera | Fixed isometric angle, 4-rotation support (90° increments), zoom: 0.5x–2.0x |
| Tile states | empty, occupied (furniture), trapped, barricaded, entry_point, loot_stash |

---

## 7. PWA Configuration

| Feature | Implementation |
|---|---|
| Manifest | `/public/manifest.json` — name, icons, theme_color, display: standalone |
| Service Worker | `next-pwa` plugin — precache static assets, game data JSONs |
| Offline Support | Room editor functional offline, syncs on reconnect |
| Install Prompt | Custom deferred prompt UI after tutorial completion |
| Push Notifications | Future — raid alerts, quest completions, safe mode expiry |

---

## 8. Procedural Voxel Engine & Customization

The game uses a dynamic, zero-overhead 3D Voxel rendering engine drawn directly onto Phaser textures via standard canvas drawing APIs (`BootScene.generateIsoBlock` using `drawVolumetricSubBlock`).

### Raider Cosmetics & Loadout Syncing
* **Zustand Bindings**: Zustand stores are bound globally to `(window as any).useSquadStore` and `(window as any).usePlayerStore` on client mount.
* **Slot-specific Textures**: The engine preloads and dynamically regenerates slot-specific textures (`entity_drone_slot_1` through `entity_drone_slot_4`, along with 4-directional maps) whenever the player customizes character appearance or equips new armor/weapons.
* **Custom Models**: Armors (e.g., `reinforced_vest`, `tactical_armor`) and weapons (e.g., `heavy_machete`, `demo_hammer`) are rendered block-by-block using beveled voxel overlays.

### Enemy & Boss Customization
* **Hostile vs. Friendly sentinels**: Placed `guard_drone` sentries render with green searchlights and cyan cores when in the safe Room view (friendly state), and auto-regenerate with red/amber/purple searchlights when in a Raid scene (hostile states).
* **Faction-colored overlays**:
  - **Easy strongholds**: Orange searchlights/cores.
  - **Medium strongholds**: Crimson Red searchlights/cores.
  - **Hard strongholds**: Void Purple searchlights/cores.
* **Boss Faction Skins**:
  - **Ironjaw**: Rust-brown armor plates, warning cores, and optional steel shoulder spikes.
  - **Whisper**: Camouflage panels and glowing green active circuits.
  - **Volkov**: Navy blue tread base casing and glowing autocannon barrels.
  - **Circuit**: Server modular casing, blinking computation LEDs, and glowing copper busbars.
  - **Warden**: Void purple chassis, energy containment shields, and glowing pink beacon searchlights.

---

## 9. Dynamic Searchlights & Ambient Lighting Overlays

To create a realistic, high-fidelity atmosphere in both safe room customization and active raid combat, Room Invaders utilizes a zero-overhead, dual-layer graphics lighting pipeline inside the Phaser rendering context:

### 9.1 Rendering Pipeline Architecture
Two dedicated `Phaser.GameObjects.Graphics` layers are initialized at high depths to ensure they sit above tiles, walls, and entities, but below the head-up display (HUD) elements:
1. **Ambient Dark Overlay** (`ambientOverlay` at depth `900`): Draws a translucent dark rectangle (`0x060913`) covering the active camera viewport.
   - *Safe Room (RoomScene)*: Soft dimming (`alpha = 0.25`) to establish a high-tech bunker mood.
   - *Standard Raid (RaidScene)*: Tactical dimming (`alpha = 0.42`) for combat visibility.
   - *Sector Blackout Event (RaidScene)*: Pitch-black darkness (`alpha = 0.78`) to intensify the survival atmosphere.
2. **Neon Glow Overlay** (`lightGlowOverlay` at depth `901`): A secondary layer set to the additive blend mode (`Phaser.BlendModes.ADD`) for volumetric light projection and colored beams.

### 9.2 Real-time Blend Mode Shading
The engine performs hardware-accelerated stencil masking without custom WebGL fragment shaders:
* **ERASE Blend Mode**: Every frame, the ambient dark overlay is set to `Phaser.BlendModes.ERASE`, and the light cutout shapes (circular flashlights and slice-wedged searchlight cones) are drawn onto it as solid white shapes. This cleanly subtracts opacity from the ambient layer, revealing the fully lit game assets underneath.
* **NORMAL Blend Mode**: The ambient overlay is then set back to normal drawing mode.
* **ADD Blend Mode**: Glowing volumetric light cones and beam outlines are drawn onto the neon glow overlay using the additive blend mode, providing the visual effect of colored dust and vapor illuminated by searchlights.

### 9.3 Dynamic Light Sources
1. **Player Squad Flashlights**: Warm cyan-white (`0xe0f7fa`) light cones sweeping at a `0.45` spread angle with a radius of `110px`, dynamically rotating to align with the character's movement path direction (`dir_0` through `dir_3`).
2. **Sentry Hover Drones (`guard_drone`)**:
   - *Friendly Sentinels*: Green searchlight beams (`0x10b981`) scanning back and forth.
   - *Hostile Drones*: Color-tinted based on difficulty (Easy: Orange `0xf97316`, Medium/Hard: Red `0xef4444` or Void Purple `0xa855f7`).
   - *Motion*: Sweeps back and forth dynamically based on a sinusoidal function: `Math.sin(time / 800) * 0.5` radians.
3. **Boss Warlords**: Specialized light mechanics based on faction type:
   - *Ironjaw*: Red sweeps (`0xef4444`), radius `160px`, spread `0.60` rads.
   - *Whisper*: active-camo green pulsator (`0x22c55e`), radius `35 + 5 * Math.sin(time / 200)px` at 360°.
   - *Volkov*: Tactical orange command beam (`0xf97316`), radius `200px`, spread `0.70` rads.
   - *Circuit*: Quad yellow/cyan LED beams (`0x06b6d4`), rotating in multi-array directions.
   - *Warden*: Top warning beacon (`0xec4899`) rotating continuously in a full 360° circle: `angle = (time / 1500) * Math.PI * 2`.