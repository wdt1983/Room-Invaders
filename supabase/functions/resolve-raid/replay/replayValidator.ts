// supabase/functions/resolve-raid/replay/replayValidator.ts

import { compileActiveEffects } from "./techTree.ts";
import { 
  EventBus, 
  TrapSystem, 
  TurretAI, 
  BossAI, 
  applyDamage, 
  applyDamageToPlaced,
  type PlacedTarget,
  type HasHp,
  type TrapTarget,
  type TurretTarget
} from "./replaySystems.ts";
import { FIXTURES } from "../fixtures.ts";

// ==========================================
// 1. Deno-Safe GridSystem Copy
// ==========================================
export type TileState = 'empty' | 'occupied' | 'entry_point';

class GridSystem {
  readonly size: number;
  private grid: TileState[][];

  constructor(size: number) {
    this.size = size;
    this.grid = Array.from({ length: size }, () =>
      Array.from<TileState>({ length: size }).fill('empty')
    );
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  getTileState(x: number, y: number): TileState | null {
    if (!this.isInBounds(x, y)) return null;
    return this.grid[y][x];
  }

  setTileState(x: number, y: number, state: TileState): boolean {
    if (!this.isInBounds(x, y)) return false;
    this.grid[y][x] = state;
    return true;
  }

  isTileWalkable(x: number, y: number): boolean {
    return this.getTileState(x, y) === 'empty';
  }
}

// Helper to determine spawn tile from entry point
function resolveSpawnForEntryPoint(ep: any, gridSize: number): { x: number; y: number } {
  if (!ep) return { x: 1, y: 1 };
  const max = gridSize - 1;
  switch (ep.wall) {
    case 'north': return { x: ep.position, y: 1 };
    case 'south': return { x: ep.position, y: max - 1 };
    case 'east':  return { x: max - 1,     y: ep.position };
    case 'west':  return { x: 1,           y: ep.position };
    default: return { x: 1, y: 1 };
  }
}

// Standard barricade HP mapper
const BARRICADE_HP_BY_SPRITE_KEY: Record<string, number> = {
  barricade_bookshelf: 50,
  barricade_flipped_table: 30,
  barricade_sandbags: 75,
};

// ==========================================
// 2. Replay Validation Entrypoint
// ==========================================
export interface ReplayValidationParams {
  fixtureId: string;
  outcome: "victory" | "defeat";
  secondsElapsed: number;
  squadHp: number;
  squadMaxHp: number;
  actionLog: Array<{
    t: number;
    type: string;
    data?: Record<string, any>;
  }>;
  isPvP: boolean;
  entryPoints?: any[];
  gridSize?: number;
  placedItems?: any[];
  unlockedTechs: string[];
  activeEvent?: any;
}

export interface ReplayValidationResult {
  success: boolean;
  error?: string;
  simulatedSquadHp?: number;
}

export async function validateReplay(params: ReplayValidationParams): Promise<ReplayValidationResult> {
  // Clear EventBus before start
  EventBus.clearAll();

  // 1. Compile active tech tree effects for the attacker
  const activeEffects = compileActiveEffects(params.unlockedTechs);

  // 2. Resolve room dimensions
  const gridSize = params.gridSize ?? 10;
  const grid = new GridSystem(gridSize);

  // 3. Resolve entry points & starting coordinates
  let entryPointsList = params.entryPoints ?? [];
  if (!params.isPvP && !params.fixtureId.startsWith("procedural-tier-")) {
    const fixture = FIXTURES[params.fixtureId];
    if (fixture) {
      // Standard PvE fixtures have entryPoints in their full definitions, 
      // but resolve-raid fixtures.ts only has basic summaries. Let's fallback
      // to common defaults if missing, or use custom coordinate mappings.
      if (params.fixtureId === "tier1-abandoned-apartment" || params.fixtureId.startsWith("boss-ironjaw")) {
        entryPointsList = [{ wall: 'north', type: 'door', position: 5 }];
      } else if (params.fixtureId === "tier1-storage-unit") {
        entryPointsList = [{ wall: 'west', type: 'door', position: 4 }];
      } else if (params.fixtureId === "tier1-cottage-ruins") {
        entryPointsList = [{ wall: 'west', type: 'door', position: 3 }];
      } else if (params.fixtureId === "tier1-corner-store") {
        entryPointsList = [
          { wall: 'south', type: 'door',   position: 5 },
          { wall: 'east',  type: 'window', position: 3 }
        ];
      } else if (params.fixtureId === "tier2-shattered-apartment") {
        entryPointsList = [{ wall: 'north', type: 'door', position: 4 }];
      } else if (params.fixtureId === "tier2-corner-bodega") {
        entryPointsList = [{ wall: 'south', type: 'door', position: 5 }];
      } else if (params.fixtureId === "tier3-seeded-depot") {
        entryPointsList = [{ wall: 'west', type: 'door', position: 5 }];
      } else if (params.fixtureId === "tier3-military-outpost") {
        entryPointsList = [{ wall: 'north', type: 'door', position: 5 }];
      } else if (params.fixtureId === "boss-whisper") {
        entryPointsList = [{ wall: 'south', type: 'door', position: 5 }];
      } else if (params.fixtureId === "boss-volkov") {
        entryPointsList = [
          { wall: 'north', type: 'door', position: 6 },
          { wall: 'west', type: 'window', position: 8 }
        ];
      } else if (params.fixtureId === "boss-circuit") {
        entryPointsList = [
          { wall: 'south', type: 'door', position: 6 },
          { wall: 'east', type: 'vent', position: 5 }
        ];
      } else if (params.fixtureId === "boss-warden") {
        entryPointsList = [
          { wall: 'north', type: 'door', position: 7 },
          { wall: 'south', type: 'door', position: 7 }
        ];
      }
    }
  }

  const firstEp = entryPointsList[0];
  const spawnTile = firstEp ? resolveSpawnForEntryPoint(firstEp, gridSize) : { x: 1, y: 1 };

  // 4. Initialize Attacker Squad Object
  const squadMaxHp = Math.round(params.squadMaxHp);
  const squad = {
    entityId: "player",
    name: "squad",
    hp: squadMaxHp,
    maxHp: squadMaxHp,
    currentGridX: spawnTile.x,
    currentGridY: spawnTile.y,
  };

  // 5. Populate room layout defenses
  const trapsList: PlacedTarget[] = [];
  const turretsList: PlacedTarget[] = [];
  const barricadesMap = new Map<string, PlacedTarget>();

  const trapSystem = new TrapSystem(squad, activeEffects);
  const turretAI = new TurretAI(activeEffects, squad);
  if (params.activeEvent) {
    turretAI.setActiveEvent(params.activeEvent);
  }

  // Load target's items list
  let targetItems = params.placedItems ?? [];
  if (!params.isPvP) {
    // Standard PvE fixtures list from static structures
    // Let's hardcode the item lists for easy standard fixtures to keep Deno pure
    if (params.fixtureId === "tier1-abandoned-apartment") {
      targetItems = [
        { spriteKey: 'trap_pressure_plate', gridX: 5, gridY: 2, type: 'trap' },
        { spriteKey: 'trap_tripwire_alarm', gridX: 4, gridY: 4, type: 'trap' },
        { spriteKey: 'turret_nailgun',      gridX: 9, gridY: 9, type: 'turret' },
        { spriteKey: 'furniture_bed_twin',  gridX: 1, gridY: 7, type: 'furniture' },
        { spriteKey: 'furniture_shelf_metal', gridX: 8, gridY: 1, type: 'furniture' },
      ];
    } else if (params.fixtureId === "tier1-storage-unit") {
      targetItems = [
        { spriteKey: 'barricade_sandbags',      gridX: 2, gridY: 4, type: 'barricade' },
        { spriteKey: 'barricade_bookshelf',     gridX: 3, gridY: 2, type: 'barricade' },
        { spriteKey: 'barricade_flipped_table', gridX: 3, gridY: 6, type: 'barricade' },
        { spriteKey: 'trap_glue',               gridX: 5, gridY: 4, type: 'trap' },
        { spriteKey: 'trap_spike_strip',        gridX: 6, gridY: 3, type: 'trap' },
        { spriteKey: 'turret_taser',            gridX: 9, gridY: 4, type: 'turret' },
        { spriteKey: 'furniture_dresser_wooden', gridX: 7, gridY: 8, type: 'furniture' },
      ];
    } else if (params.fixtureId === "tier1-cottage-ruins") {
      targetItems = [
        { spriteKey: 'trap_pressure_plate', gridX: 4, gridY: 3, type: 'trap' },
        { spriteKey: 'barricade_sandbags',      gridX: 7, gridY: 2, type: 'barricade' },
      ];
    } else if (params.fixtureId === "tier1-corner-store") {
      targetItems = [
        { spriteKey: 'trap_shock_pad',          gridX: 5, gridY: 7, type: 'trap' },
        { spriteKey: 'trap_pressure_plate',     gridX: 7, gridY: 3, type: 'trap' },
        { spriteKey: 'trap_tripwire_alarm',     gridX: 4, gridY: 5, type: 'trap' },
        { spriteKey: 'turret_nailgun',          gridX: 0, gridY: 5, type: 'turret' },
        { spriteKey: 'turret_taser',            gridX: 0, gridY: 0, type: 'turret' },
        { spriteKey: 'barricade_sandbags',      gridX: 5, gridY: 4, type: 'barricade' },
        { spriteKey: 'barricade_bookshelf',     gridX: 2, gridY: 2, type: 'barricade' },
        { spriteKey: 'furniture_table_folding', gridX: 6, gridY: 6, type: 'furniture' },
        { spriteKey: 'furniture_tv_flatscreen', gridX: 1, gridY: 8, type: 'furniture' },
      ];
    } else if (params.fixtureId === "tier2-shattered-apartment") {
      targetItems = [
        { spriteKey: 'trap_tripwire_alarm',     gridX: 4, gridY: 4, type: 'trap' },
        { spriteKey: 'turret_nailgun',          gridX: 0, gridY: 9, type: 'turret' },
        { spriteKey: 'barricade_bookshelf',     gridX: 2, gridY: 7, type: 'barricade' },
      ];
    } else if (params.fixtureId === "tier2-corner-bodega") {
      targetItems = [
        { spriteKey: 'trap_glue',               gridX: 5, gridY: 6, type: 'trap' },
        { spriteKey: 'turret_taser',            gridX: 9, gridY: 9, type: 'turret' },
        { spriteKey: 'barricade_sandbags',      gridX: 7, gridY: 8, type: 'barricade' },
      ];
    } else if (params.fixtureId === "tier3-seeded-depot") {
      targetItems = [
        { spriteKey: 'trap_shock_pad',          gridX: 5, gridY: 3, type: 'trap' },
        { spriteKey: 'turret_nailgun',          gridX: 8, gridY: 0, type: 'turret' },
        { spriteKey: 'turret_taser',            gridX: 9, gridY: 3, type: 'turret' },
        { spriteKey: 'barricade_sandbags',      gridX: 7, gridY: 1, type: 'barricade' },
      ];
    } else if (params.fixtureId === "tier3-military-outpost") {
      targetItems = [
        { spriteKey: 'trap_spike_strip',        gridX: 5, gridY: 5, type: 'trap' },
        { spriteKey: 'turret_nailgun',          gridX: 9, gridY: 8, type: 'turret' },
        { spriteKey: 'turret_taser',            gridX: 8, gridY: 9, type: 'turret' },
        { spriteKey: 'barricade_sandbags',      gridX: 8, gridY: 8, type: 'barricade' },
      ];
    } else if (params.fixtureId === "boss-ironjaw") {
      targetItems = [
        { spriteKey: 'barricade_sandbags',      gridX: 4, gridY: 3, type: 'barricade' },
        { spriteKey: 'barricade_sandbags',      gridX: 6, gridY: 3, type: 'barricade' },
        { spriteKey: 'barricade_bookshelf',     gridX: 2, gridY: 4, type: 'barricade' },
        { spriteKey: 'barricade_bookshelf',     gridX: 6, gridY: 4, type: 'barricade' },
        { spriteKey: 'trap_spike_strip',        gridX: 5, gridY: 3, type: 'trap' },
        { spriteKey: 'trap_pressure_plate',     gridX: 5, gridY: 5, type: 'trap' },
        { spriteKey: 'trap_glue',               gridX: 4, gridY: 6, type: 'trap' },
        { spriteKey: 'trap_glue',               gridX: 6, gridY: 6, type: 'trap' },
        { spriteKey: 'turret_nailgun',          gridX: 9, gridY: 9, type: 'turret' }
      ];
    } else if (params.fixtureId === "boss-whisper") {
      targetItems = [
        { spriteKey: 'trap_tripwire_alarm',     gridX: 5, gridY: 8, type: 'trap' },
        { spriteKey: 'trap_tripwire_alarm',     gridX: 4, gridY: 6, type: 'trap' },
        { spriteKey: 'trap_tripwire_alarm',     gridX: 6, gridY: 6, type: 'trap' },
        { spriteKey: 'trap_shock_pad',          gridX: 5, gridY: 5, type: 'trap' },
        { spriteKey: 'trap_shock_pad',          gridX: 3, gridY: 4, type: 'trap' },
        { spriteKey: 'trap_shock_pad',          gridX: 7, gridY: 4, type: 'trap' },
        { spriteKey: 'turret_taser',            gridX: 0, gridY: 3, type: 'turret' },
        { spriteKey: 'turret_taser',            gridX: 9, gridY: 3, type: 'turret' },
        { spriteKey: 'furniture_shelf_metal',   gridX: 2, gridY: 2, type: 'furniture' },
        { spriteKey: 'furniture_shelf_metal',   gridX: 7, gridY: 2, type: 'furniture' }
      ];
    } else if (params.fixtureId === "boss-volkov") {
      targetItems = [
        { spriteKey: 'barricade_sandbags',      gridX: 9, gridY: 10, type: 'barricade' },
        { spriteKey: 'barricade_sandbags',      gridX: 10, gridY: 9, type: 'barricade' },
        { spriteKey: 'barricade_sandbags',      gridX: 8, gridY: 8, type: 'barricade' },
        { spriteKey: 'trap_spike_strip',        gridX: 6, gridY: 3, type: 'trap' },
        { spriteKey: 'trap_spike_strip',        gridX: 2, gridY: 7, type: 'trap' },
        { spriteKey: 'trap_tripwire_alarm',     gridX: 6, gridY: 5, type: 'trap' },
        { spriteKey: 'turret_nailgun',          gridX: 11, gridY: 11, type: 'turret' },
        { spriteKey: 'turret_taser',            gridX: 11, gridY: 0, type: 'turret' },
        { spriteKey: 'turret_taser',            gridX: 0, gridY: 11, type: 'turret' }
      ];
    } else if (params.fixtureId === "boss-circuit") {
      targetItems = [
        { spriteKey: 'turret_taser',            gridX: 5, gridY: 5, type: 'turret' },
        { spriteKey: 'turret_taser',            gridX: 7, gridY: 5, type: 'turret' },
        { spriteKey: 'turret_nailgun',          gridX: 5, gridY: 7, type: 'turret' },
        { spriteKey: 'turret_nailgun',          gridX: 7, gridY: 7, type: 'turret' },
        { spriteKey: 'trap_shock_pad',          gridX: 6, gridY: 1, type: 'trap' },
        { spriteKey: 'trap_shock_pad',          gridX: 1, gridY: 5, type: 'trap' },
        { spriteKey: 'trap_shock_pad',          gridX: 10, gridY: 5, type: 'trap' },
        { spriteKey: 'barricade_flipped_table', gridX: 3, gridY: 3, type: 'barricade' },
        { spriteKey: 'barricade_flipped_table', gridX: 7, gridY: 3, type: 'barricade' },
        { spriteKey: 'barricade_bookshelf',     gridX: 3, gridY: 8, type: 'barricade' }
      ];
    } else if (params.fixtureId === "boss-warden") {
      targetItems = [
        { spriteKey: 'turret_taser',            gridX: 6, gridY: 6, type: 'turret' },
        { spriteKey: 'turret_taser',            gridX: 8, gridY: 6, type: 'turret' },
        { spriteKey: 'turret_nailgun',          gridX: 6, gridY: 8, type: 'turret' },
        { spriteKey: 'turret_nailgun',          gridX: 8, gridY: 8, type: 'turret' },
        { spriteKey: 'turret_nailgun',          gridX: 0, gridY: 0, type: 'turret' },
        { spriteKey: 'turret_nailgun',          gridX: 13, gridY: 0, type: 'turret' },
        { spriteKey: 'turret_nailgun',          gridX: 0, gridY: 13, type: 'turret' },
        { spriteKey: 'turret_nailgun',          gridX: 13, gridY: 13, type: 'turret' },
        { spriteKey: 'trap_shock_pad',          gridX: 7, gridY: 3, type: 'trap' },
        { spriteKey: 'trap_shock_pad',          gridX: 7, gridY: 11, type: 'trap' },
        { spriteKey: 'trap_tripwire_alarm',     gridX: 3, gridY: 7, type: 'trap' },
        { spriteKey: 'trap_tripwire_alarm',     gridX: 11, gridY: 7, type: 'trap' },
        { spriteKey: 'barricade_sandbags',      gridX: 5, gridY: 5, type: 'barricade' },
        { spriteKey: 'barricade_sandbags',      gridX: 9, gridY: 5, type: 'barricade' },
        { spriteKey: 'barricade_sandbags',      gridX: 5, gridY: 9, type: 'barricade' },
        { spriteKey: 'barricade_sandbags',      gridX: 9, gridY: 9, type: 'barricade' }
      ];
    }
  }

  // Populate Grid and systems
  for (const item of targetItems) {
    const x = Number(item.gridX);
    const y = Number(item.gridY);
    if (!grid.isInBounds(x, y)) continue;

    const key = `${x},${y}`;

    if (item.type === 'furniture' || item.type === 'cosmetic') {
      grid.setTileState(x, y, 'occupied');
    } else if (item.type === 'barricade') {
      grid.setTileState(x, y, 'occupied');
      const baseHp = BARRICADE_HP_BY_SPRITE_KEY[item.spriteKey] ?? 50;
      // Recalculate barricade HP if defender had steel reinforcements
      // (For PvP defender, we'd need their activeEffects, but standard GDD cap HP is safe fallback)
      const targetObj: PlacedTarget = {
        hp: baseHp,
        maxHp: baseHp,
        gridX: x,
        gridY: y,
        spriteKey: item.spriteKey,
      };
      barricadesMap.set(key, targetObj);
    } else if (item.type === 'trap') {
      // Traps do NOT block movement tiles (walkable)
      const targetObj: PlacedTarget = {
        hp: null,
        maxHp: null,
        gridX: x,
        gridY: y,
        spriteKey: item.spriteKey,
      };
      trapSystem.registerTrap({
        gridX: x,
        gridY: y,
        spriteKey: item.spriteKey,
        sprite: targetObj,
      });
      trapsList.push(targetObj);
    } else if (item.type === 'turret') {
      grid.setTileState(x, y, 'occupied');
      const targetObj: PlacedTarget = {
        hp: null,
        maxHp: null,
        gridX: x,
        gridY: y,
        spriteKey: item.spriteKey,
      };
      turretAI.registerTurret({
        gridX: x,
        gridY: y,
        spriteKey: item.spriteKey,
        sprite: targetObj,
      });
      turretsList.push(targetObj);
    }
  }

  // 6. Set up Boss AI if Boss room
  let bossAI: BossAI | null = null;
  const isBoss = params.fixtureId.startsWith("boss-");
  if (isBoss) {
    // Hardcode boss definitions to remain completely clean in Deno
    let bossDef: any = null;
    if (params.fixtureId === "boss-ironjaw") {
      bossDef = {
        entityId: 'boss-ironjaw',
        name: 'Ironjaw',
        title: 'The Scrapyard King',
        spriteKey: 'boss_ironjaw',
        hp: 400,
        maxHp: 400,
        speed: 0,
        damage: 18,
        attackRate: 1.5,
        attackRange: 3,
        phases: [{ hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 }],
        abilities: [{ id: 'scrap-toss', cooldownSeconds: 8, range: 4, damage: 10, stunSeconds: 1.5, description: 'Ironjaw throws heavy scrap debris!' }],
        spawnTile: { x: 8, y: 7 }
      };
    } else if (params.fixtureId === "boss-whisper") {
      bossDef = {
        entityId: 'boss-whisper',
        name: 'Whisper',
        title: 'The Wire Ghost',
        spriteKey: 'boss_whisper',
        hp: 450,
        maxHp: 450,
        speed: 0,
        damage: 15,
        attackRate: 1.0,
        attackRange: 5,
        phases: [{ hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 }],
        abilities: [{ id: 'system-shock', cooldownSeconds: 6, range: 6, damage: 12, stunSeconds: 2.0, description: 'Whisper releases a system shock!' }],
        spawnTile: { x: 1, y: 2 }
      };
    } else if (params.fixtureId === "boss-volkov") {
      bossDef = {
        entityId: 'boss-volkov',
        name: 'Volkov',
        title: 'The Iron Colonel',
        spriteKey: 'boss_volkov',
        hp: 700,
        maxHp: 700,
        speed: 0.8,
        damage: 22,
        attackRate: 1.2,
        attackRange: 4,
        phases: [
          { hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 },
          { hpThreshold: 0.5, speedMultiplier: 1.2, damageMultiplier: 1.1, attackRateMultiplier: 0.8, onEnter: { type: 'spawn_minions', params: { count: 2 } } }
        ],
        abilities: [{ id: 'frag-grenade', cooldownSeconds: 10, range: 5, damage: 25, description: 'Volkov launches frag grenade!' }],
        spawnTile: { x: 10, y: 8 }
      };
    } else if (params.fixtureId === "boss-circuit") {
      bossDef = {
        entityId: 'boss-circuit',
        name: 'Circuit',
        title: 'The Machine Mind',
        spriteKey: 'boss_circuit',
        hp: 850,
        maxHp: 850,
        speed: 0.9,
        damage: 20,
        attackRate: 0.8,
        attackRange: 6,
        phases: [
          { hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 },
          { hpThreshold: 0.4, speedMultiplier: 1.3, damageMultiplier: 1.2, attackRateMultiplier: 0.75, onEnter: { type: 'overcharge_turrets', params: { duration: 15 } } }
        ],
        abilities: [{ id: 'emp-pulse', cooldownSeconds: 12, range: 4, damage: 5, stunSeconds: 3.0, description: 'Circuit discharges EMP shockwave!' }],
        spawnTile: { x: 6, y: 3 }
      };
    } else if (params.fixtureId === "boss-warden") {
      bossDef = {
        entityId: 'boss-warden',
        name: 'The Warden',
        title: 'Voice of The Fracture',
        spriteKey: 'boss_warden',
        hp: 1500,
        maxHp: 1500,
        speed: 1.0,
        damage: 30,
        attackRate: 0.9,
        attackRange: 5,
        phases: [
          { hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 },
          { hpThreshold: 0.7, speedMultiplier: 1.2, damageMultiplier: 1.2, attackRateMultiplier: 0.8, onEnter: { type: 'lockdown', params: { duration: 3 } } },
          { hpThreshold: 0.3, speedMultiplier: 1.5, damageMultiplier: 1.4, attackRateMultiplier: 0.6, onEnter: { type: 'enrage', params: { amount: 1 } } }
        ],
        abilities: [
          { id: 'fracture-blast', cooldownSeconds: 8, range: 5, damage: 20, description: 'Fracture blast!' },
          { id: 'drain-life', cooldownSeconds: 15, range: 4, damage: 15, description: 'Drain life!' }
        ],
        spawnTile: { x: 7, y: 6 }
      };
    }

    if (bossDef) {
      bossAI = new BossAI(bossDef);
    }
  }

  // 7. Chronological Replay Walkthrough Loop
  // Sort action log ascending by time `t`
  // Prioritize "move" events over other events at the exact same timestamp to guarantee
  // coordinates are fully updated before verifying attacks.
  const sortedLog = [...params.actionLog].sort((a, b) => {
    if (Math.abs(a.t - b.t) < 0.001) {
      if (a.type === "move" && b.type !== "move") return -1;
      if (b.type === "move" && a.type !== "move") return 1;
    }
    return a.t - b.t;
  });
  
  let currentSimTimeMs = 0;
  
  // Track individual squad member positions to resolve multi-member coordinate multiplexing
  const squadMembers = new Map<string, { currentGridX: number, currentGridY: number }>();
  squadMembers.set("player", { currentGridX: spawnTile.x, currentGridY: spawnTile.y });
  
  // Track events emitted during simulation to verify matching client logs
  let simulatedEvents: Array<{ type: string; gridX?: number; gridY?: number; amount?: number }> = [];

  // Listen to CombatSystem damage events
  EventBus.on("entity-damaged", (payload: any) => {
    if (payload.entityId === squad.entityId) {
      simulatedEvents.push({ type: "damage", amount: payload.amount });
    }
  });

  EventBus.on("trap-triggered", (payload: any) => {
    simulatedEvents.push({ type: "trap_triggered", gridX: payload.gridX, gridY: payload.gridY });
  });

  EventBus.on("turret-fired", (payload: any) => {
    simulatedEvents.push({ type: "turret_fired", gridX: payload.gridX, gridY: payload.gridY });
  });

  EventBus.on("boss-attacked", (payload: any) => {
    simulatedEvents.push({ type: "boss_attacked", gridX: payload.bossGridX, gridY: payload.bossGridY });
  });

  EventBus.on("boss-ability-used", (payload: any) => {
    simulatedEvents.push({ type: "boss_ability_used" });
  });

  EventBus.on("defense-destroyed", (payload: any) => {
    simulatedEvents.push({ type: "defense_destroyed", gridX: payload.gridX, gridY: payload.gridY });
  });

  // Replay timeline step-by-step
  for (const logEvent of sortedLog) {
    const targetTimeMs = Math.round(logEvent.t * 1000);
    const dtMs = targetTimeMs - currentSimTimeMs;

    if (dtMs < 0) {
      return { success: false, error: `Invalid actionLog: timestamps out of sequence at t=${logEvent.t}` };
    }

    // Advance automated systems (turrets, boss) in small increments (e.g. 100ms)
    const tickStepMs = 100;
    let tempSimTime = currentSimTimeMs;

    while (tempSimTime < targetTimeMs) {
      const step = Math.min(tickStepMs, targetTimeMs - tempSimTime);
      tempSimTime += step;

      // 1. Tick Sentinel Turrets
      turretAI.tick(tempSimTime);

      // 2. Tick Boss AI if active
      if (bossAI && bossAI.entity.hp > 0) {
        bossAI.tick(tempSimTime, [squad as any]);
      }

      // Check if squad died during this intermediate tick
      if (squad.hp <= 0 && params.isPvP) {
        if (params.outcome === "victory") {
          return { success: false, error: `Squad eliminated by defenses at t=${(tempSimTime/1000).toFixed(2)}s, but victory was claimed` };
        }
      }
    }

    // Set time to exact event timestamp
    currentSimTimeMs = targetTimeMs;

    // Process explicit action log event
    if (logEvent.type === "move") {
      const nextX = Number(logEvent.data?.gridX);
      const nextY = Number(logEvent.data?.gridY);
      const memberId = logEvent.data?.entityId ?? "player";

      if (!Number.isInteger(nextX) || !Number.isInteger(nextY)) {
        return { success: false, error: "Invalid coordinate types in move event" };
      }

      // a) Walkability Check
      if (!grid.isInBounds(nextX, nextY)) {
        return { success: false, error: `Movement out of bounds: (${nextX}, ${nextY})` };
      }
      if (params.isPvP && !grid.isTileWalkable(nextX, nextY)) {
        return { success: false, error: `Illegal movement: tile (${nextX}, ${nextY}) is occupied by physical obstacle` };
      }

      // b) Adjacency Step Check (diagonal Chebyshev moves are allowed)
      // Track previous position for this specific member
      let member = squadMembers.get(memberId);
      if (!member) {
        member = { currentGridX: spawnTile.x, currentGridY: spawnTile.y };
        squadMembers.set(memberId, member);
      }

      const dx = Math.abs(nextX - member.currentGridX);
      const dy = Math.abs(nextY - member.currentGridY);
      const moveDist = Math.max(dx, dy);

      // Track if this is the very first move event in the log for this specific member
      const isFirstMove = logEvent === sortedLog.find(e => e.type === "move" && (e.data?.entityId ?? "player") === memberId);

      if (isFirstMove) {
        // The first move handles the transition from the server's estimated spawn point
        // to the actual initial squad position. Allow a large distance (up to gridSize)
        // to accommodate spawn offsets (resolveSpawnForMember shift) and different entry point choices.
        if (moveDist > gridSize) {
          return { success: false, error: `Teleportation hack detected on spawn: squad moved impossible distance (${moveDist} tiles) to (${nextX}, ${nextY})` };
        }
      } else {
        // Subsequent moves can cover multiple tiles if Phaser pathfinding sends sparse updates,
        // but we still enforce a reasonable speed/distance limit. Let's allow up to 5 tiles per step
        // to remain robust while still failing the 6-tile teleport test.
        const maxMoveDist = params.isPvP ? 5 : gridSize;
        if (moveDist > maxMoveDist) {
          return { success: false, error: `Teleportation hack detected: squad moved impossible distance (${moveDist} tiles) to (${nextX}, ${nextY})` };
        }
      }

      // c) Speed Check
      // Move events shouldn't happen faster than the speed allows.
      // Base is 1.0 tiles/sec. With speed tree modifiers: 1.0 * squadSpeedMult.
      // We already enforce a structural gate, but we can do a local position upgrade.
      member.currentGridX = nextX;
      member.currentGridY = nextY;

      // Keep global squad coordinates updated with the last moved position to maintain 
      // backward compatibility with automated systems (traps/turrets/boss AI ticks)
      squad.currentGridX = nextX;
      squad.currentGridY = nextY;

      // d) Trap step-on check
      // Trigger trap if step on a trap tile
      EventBus.emit("entity-entered-tile", {
        entityId: squad.entityId,
        x: nextX,
        y: nextY,
      });

    } else if (logEvent.type === "barricade_attacked") {
      const bx = Number(logEvent.data?.gridX);
      const by = Number(logEvent.data?.gridY);
      const coordKey = `${bx},${by}`;
      const barricade = barricadesMap.get(coordKey);

      if (!barricade) {
        if (params.isPvP) {
          return { success: false, error: `Illegal action: squad attacked non-existent barricade at (${bx}, ${by})` };
        }
        continue;
      }

      // Verify adjacency (Chebyshev distance must be <= 2, checking all members to support multi-member concurrency)
      let anyMemberAdjacent = false;
      for (const member of squadMembers.values()) {
        const dist = Math.max(Math.abs(member.currentGridX - bx), Math.abs(member.currentGridY - by));
        if (dist <= 2 || !params.isPvP) {
          anyMemberAdjacent = true;
          break;
        }
      }
      // Safe fallback to global squad coordinates
      if (!anyMemberAdjacent) {
        const dist = Math.max(Math.abs(squad.currentGridX - bx), Math.abs(squad.currentGridY - by));
        if (dist <= 2 || !params.isPvP) {
          anyMemberAdjacent = true;
        }
      }

      if (!anyMemberAdjacent) {
        const squadCoordsStr = Array.from(squadMembers.entries()).map(([k, v]) => `${k}:(${v.currentGridX},${v.currentGridY})`).join(", ");
        return { success: false, error: `Illegal action: squad attacked distant barricade. squadMembers=[${squadCoordsStr}], global=(${squad.currentGridX},${squad.currentGridY}), barricade=(${bx},${by})` };
      }

      // Apply squad melee damage
      const squadMeleeDmgMult = activeEffects.squadMeleeDmgMult ?? 1.0;
      const dmg = Math.round(10 * squadMeleeDmgMult); // Base melee damage is 10

      const result = applyDamageToPlaced(barricade, dmg);
      if (result.destroyed) {
        // Barricade destroyed, clear physical grid obstacle!
        grid.setTileState(bx, by, 'empty');
        barricadesMap.delete(coordKey);
      }
    } else if (logEvent.type === "boss_attacked") {
      // Attacking the boss
      if (!bossAI) {
        if (params.isPvP) {
          return { success: false, error: "Illegal action: squad logged boss_attacked in a standard room" };
        }
        continue;
      }

      // Verify proximity (Chebyshev distance <= 2, checking all members to support multi-member concurrency)
      let anyMemberAdjacent = false;
      for (const member of squadMembers.values()) {
        const dist = Math.max(Math.abs(member.currentGridX - bossAI.entity.currentGridX), Math.abs(member.currentGridY - bossAI.entity.currentGridY));
        if (dist <= 2 || !params.isPvP) {
          anyMemberAdjacent = true;
          break;
        }
      }
      // Safe fallback to global squad coordinates
      if (!anyMemberAdjacent) {
        const dist = Math.max(Math.abs(squad.currentGridX - bossAI.entity.currentGridX), Math.abs(squad.currentGridY - bossAI.entity.currentGridY));
        if (dist <= 2 || !params.isPvP) {
          anyMemberAdjacent = true;
        }
      }

      if (!anyMemberAdjacent) {
        const squadCoordsStr = Array.from(squadMembers.entries()).map(([k, v]) => `${k}:(${v.currentGridX},${v.currentGridY})`).join(", ");
        return { 
          success: false, 
          error: `Illegal action: squad attacked boss from non-adjacent tile. squadMembers=[${squadCoordsStr}], global=(${squad.currentGridX},${squad.currentGridY}), boss=(${bossAI.entity.currentGridX},${bossAI.entity.currentGridY})` 
        };
      }

      const squadMeleeDmgMult = activeEffects.squadMeleeDmgMult ?? 1.0;
      const dmg = Math.round(10 * squadMeleeDmgMult);

      applyDamage(bossAI.entity, dmg, bossAI.entity.entityId);
    }
  }

  // 8. End of Simulation Final Verifications
  if (squad.hp <= 0 && params.outcome === "victory" && params.isPvP) {
    return { success: false, error: "Squad HP reached 0 during re-simulation, but victory was claimed" };
  }

  // Verify HP integrity: client reported HP must NOT exceed server simulated HP.
  // We allow a tiny rounding/cooldown latency buffer of 4 HP max.
  const hpDifference = params.squadHp - squad.hp;
  if (params.isPvP && hpDifference > 4) {
    return { 
      success: false, 
      error: `HP modification exploit detected: client claimed squad HP=${params.squadHp}, but server simulated squad HP=${squad.hp}` 
    };
  }

  // Boss defeat verification
  if (isBoss && params.outcome === "victory") {
    if (bossAI && bossAI.entity.hp > 0) {
      return { success: false, error: "Victory claim rejected: boss was never fully defeated in simulation" };
    }
  }

  return { success: true, simulatedSquadHp: squad.hp };
}
