import type { EntryPoint, PlacedItem } from '@/lib/store/useRoomStore';
import type { RaidDifficulty } from '@/lib/store/useRaidStore';

/**
 * Hand-authored NPC room fixtures for the Phase 3 raid loop (tasks 3.0.13 +
 * 3.0.15). These are the target layouts the raid scene instantiates until
 * task 6.0.8 lands the `generate-npc-room` Edge Function that emits rooms
 * procedurally.
 *
 * Keep sprite keys aligned with `supabase/seed.sql::items.sprite_key` — the
 * same generator in `BootScene.preload` creates every placeholder texture.
 *
 * Each fixture is read by `/raid/[id]/page.tsx` (via `resolveFixture`) and
 * hydrated into `useRaidStore` + read directly by `RaidScene.create()`.
 */

export interface NpcPlacedItem extends Omit<PlacedItem, 'id'> {
  /** Catalog item type — drives pathfinding rules, defense behavior, and
   *  rating contribution. Must match `items.type` in seed.sql. */
  type: 'trap' | 'turret' | 'barricade' | 'guard' | 'furniture';
}

export interface NpcRoomFixture {
  id: string;
  name: string;
  /** Human-readable one-line summary shown on the raid-target list. */
  description: string;
  difficulty: RaidDifficulty;
  /** Player level required to unlock this raid target. */
  requiredLevel: number;
  /** Side-length of the grid. MVP fixtures are all 10×10 (the default
   *  `DEFAULT_GRID_SIZE` constant). */
  gridSize: number;
  /** Suggested squad-spawn tile, defaults to the first entry point's tile if
   *  omitted. */
  spawn?: { x: number; y: number };
  /** Loot stash tile. The squad must reach this tile and hold for a
   *  difficulty-dependent duration to win the raid. Must be on an
   *  `'empty'` tile (not occupied by furniture / defenses). */
  stash: { x: number; y: number };
  entryPoints: EntryPoint[];
  items: NpcPlacedItem[];
}

const ABANDONED_APARTMENT: NpcRoomFixture = {
  id: 'tier1-abandoned-apartment',
  name: 'Abandoned Apartment',
  description: 'Low-value target. Two traps and a single nailgun guard the far corner.',
  difficulty: 'easy',
  requiredLevel: 1,
  gridSize: 10,
  stash: { x: 8, y: 8 },
  entryPoints: [{ wall: 'north', type: 'door', position: 5 }],
  items: [
    { spriteKey: 'trap_pressure_plate', gridX: 5, gridY: 2, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_tripwire_alarm', gridX: 4, gridY: 4, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'turret_nailgun',      gridX: 9, gridY: 9, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'furniture_bed_twin',  gridX: 1, gridY: 7, footprintW: 2, footprintH: 1, rotation: 0, type: 'furniture' },
    { spriteKey: 'furniture_shelf_metal', gridX: 8, gridY: 1, footprintW: 1, footprintH: 2, rotation: 0, type: 'furniture' },
  ],
};

const STORAGE_UNIT: NpcRoomFixture = {
  id: 'tier1-storage-unit',
  name: 'Storage Unit',
  description: 'Barricaded rollup door. Light trap coverage, heavy cover.',
  difficulty: 'easy',
  requiredLevel: 1,
  gridSize: 10,
  stash: { x: 8, y: 7 },
  entryPoints: [{ wall: 'west', type: 'door', position: 4 }],
  items: [
    { spriteKey: 'barricade_sandbags',      gridX: 2, gridY: 4, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_bookshelf',     gridX: 3, gridY: 2, footprintW: 2, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_flipped_table', gridX: 3, gridY: 6, footprintW: 2, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'trap_glue',               gridX: 5, gridY: 4, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_spike_strip',        gridX: 6, gridY: 3, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'turret_taser',            gridX: 9, gridY: 4, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'furniture_dresser_wooden', gridX: 7, gridY: 8, footprintW: 2, footprintH: 1, rotation: 0, type: 'furniture' },
  ],
};

const CORNER_STORE: NpcRoomFixture = {
  id: 'tier1-corner-store',
  name: 'Corner Store',
  description: 'Two entry points, mixed defenses. A step up from the apartment.',
  difficulty: 'medium',
  requiredLevel: 3,
  gridSize: 10,
  stash: { x: 1, y: 1 },
  entryPoints: [
    { wall: 'south', type: 'door',   position: 5 },
    { wall: 'east',  type: 'window', position: 3 },
  ],
  items: [
    { spriteKey: 'trap_shock_pad',          gridX: 5, gridY: 7, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_pressure_plate',     gridX: 7, gridY: 3, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_tripwire_alarm',     gridX: 4, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'turret_nailgun',          gridX: 0, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_taser',            gridX: 0, gridY: 0, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'barricade_sandbags',      gridX: 5, gridY: 4, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_bookshelf',     gridX: 2, gridY: 2, footprintW: 2, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'furniture_table_folding', gridX: 6, gridY: 6, footprintW: 2, footprintH: 1, rotation: 0, type: 'furniture' },
    { spriteKey: 'furniture_tv_flatscreen', gridX: 1, gridY: 8, footprintW: 2, footprintH: 1, rotation: 0, type: 'furniture' },
  ],
};

export const NPC_ROOM_FIXTURES: Record<string, NpcRoomFixture> = {
  [ABANDONED_APARTMENT.id]: ABANDONED_APARTMENT,
  [STORAGE_UNIT.id]: STORAGE_UNIT,
  [CORNER_STORE.id]: CORNER_STORE,
};

export const NPC_ROOM_LIST: NpcRoomFixture[] = [
  ABANDONED_APARTMENT,
  STORAGE_UNIT,
  CORNER_STORE,
];

// Re-export boss rooms
export { BOSS_ROOM_FIXTURES, BOSS_ROOM_LIST, isBossFixture } from '../boss-rooms';
export type { BossRoomFixture, BossDefinition, BossPhase, BossAbility } from '../boss-rooms';

/** Default fixture id used when a raid route receives an unknown `id` (for
 *  example, a profile UUID from the map's Scout Base button — real NPC
 *  rooms associated with profiles will land with task 6.0.8). */
export const DEFAULT_FIXTURE_ID = ABANDONED_APARTMENT.id;

/**
 * Resolve a raid-target id to a fixture. Falls back to the apartment fixture
 * so every map-linked target still lands in a playable raid — the map's
 * "Scout Base" buttons use real profile UUIDs which won't match until the
 * procedural-NPC milestone (6.0.8).
 */
import { BOSS_ROOM_FIXTURES } from '../boss-rooms';

export function resolveFixture(id: string): NpcRoomFixture {
  if (id && id.startsWith('boss-') && id in BOSS_ROOM_FIXTURES) {
    return BOSS_ROOM_FIXTURES[id];
  }
  return NPC_ROOM_FIXTURES[id] ?? NPC_ROOM_FIXTURES[DEFAULT_FIXTURE_ID];
}
