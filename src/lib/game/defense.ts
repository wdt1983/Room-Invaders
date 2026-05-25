/**
 * Defense math — shared between client scenes and server actions.
 *
 * - {@link defenseValueFor} computes a single item's contribution to
 *   `rooms.defense_rating`.
 * - {@link slotCategoryFor} maps an item type to its slot bucket
 *   (defense / furniture / none).
 * - {@link slotsForLevel} mirrors the GDD §5.1 standardized room-level table
 *   and returns the caps for a given `room_level`.
 * - {@link rangeTilesFor} returns the set of grid tiles inside a defense
 *   item's range/trigger zone — used by `RoomEditorScene` to render the
 *   ghost-sprite range overlay (task 2.0.10) and reusable at raid time
 *   when the same visualization cues are needed.
 *
 * Formulas are deliberately simple for MVP and are a target for a later
 * balance pass (task 4.0.2). Keeping everything in one place so the balance
 * pass only touches this file.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Stats = Record<string, any> | null | undefined;

export type SlotCategory = 'defense' | 'furniture' | 'none';

/** Item types that occupy a defense slot. */
const DEFENSE_TYPES = new Set<string>(['trap', 'turret', 'barricade', 'guard']);

/**
 * Defense-rating contribution for a single placed item.
 *
 * - `trap`      → `damage` (+ modest weights for stun/immobilize/alert utility)
 * - `turret`    → `damage * range` (area-of-effect proxy)
 * - `barricade` → `floor(hp / 10)` (chip damage absorbed per raid)
 * - `guard`     → `damage * 2` (mobile unit worth more per hit)
 * - `furniture` / `cosmetic` / `consumable` → 0
 *
 * Returns 0 for unknown types or missing stats.
 */
export function defenseValueFor(type: string | null | undefined, stats: Stats): number {
  if (!type) return 0;
  const damage = Number(stats?.damage) || 0;
  const range = Number(stats?.range) || 0;
  const hp = Number(stats?.hp) || 0;
  const stun = Number(stats?.stun_duration) || 0;
  const immobilize = Number(stats?.immobilize_duration) || 0;
  const alert = Number(stats?.alert_radius) || 0;
  const uses = Number(stats?.uses) || 1;
  const emp = Number(stats?.emp_duration) || 0;
  const fireRate = Number(stats?.fire_rate) || 1.0;
  const chainTargets = Number(stats?.chain_targets) || 1;
  const decoyRadius = Number(stats?.decoy_radius) || 0;

  switch (type) {
    case 'trap':
      // Value scaled by trigger uses (capped at 3 for rating stability), stuns, immobilizations, alerts, and EMPs
      return (damage * Math.min(3, uses)) + 
             Math.round(stun * 6) + 
             Math.round(immobilize * 4) + 
             Math.round(emp * 3) + 
             Math.round(alert * 2.5);
    case 'turret':
      // DPS proxy multiplied by Chebyshev coverage area and chaining targets
      const fireRateFactor = fireRate > 0 ? (1.0 / fireRate) : 1.0;
      return Math.round(damage * fireRateFactor * Math.max(1, range) * chainTargets);
    case 'barricade':
      // Barricades absorb combat hits: value scales with HP
      return Math.floor(hp / 8);
    case 'guard':
      // Guards are mobile high-threat targets: value scales with HP, damage, range, and decoy capability
      return Math.floor(hp / 5) + 
             Math.round(damage * 2.5) + 
             (range * 2) + 
             (decoyRadius * 10);
    default:
      return 0;
  }
}

/** Which slot bucket an item counts against. */
export function slotCategoryFor(type: string | null | undefined): SlotCategory {
  if (!type) return 'none';
  if (DEFENSE_TYPES.has(type)) return 'defense';
  if (type === 'furniture') return 'furniture';
  return 'none';
}

export interface SlotCaps {
  /** Max placeable defense items (traps + turrets + barricades + guards). */
  defense: number;
  /** Max placeable furniture items. */
  furniture: number;
  /** Canonical grid side-length at this room level. Informational — the
   *  authoritative value lives on `rooms.grid_size`. */
  grid: number;
}

export const MAX_ROOM_LEVEL = 20;

/**
 * Room-level upgrade costs.
 * Deducted in `upgradeRoomLevel` server action.
 * Cost scales quadratically with the current level.
 */
export function roomUpgradeCost(currentRoomLevel: number): { scrap: number; components: number } {
  const level = Math.max(1, Math.floor(currentRoomLevel));
  return {
    scrap: level * level * 100 + level * 300,
    components: level * level * 20 + level * 60,
  };
}

/**
 * Room-level → slot caps, per GDD §5.1 table.
 *
 * | Level | Grid | Defense | Furniture |
 * |-------|------|---------|-----------|
 * | 1     | 10   | 8       | 15        |
 * | 5     | 10   | 16      | 25        |
 * | 10    | 12   | 28      | 40        |
 * | 15    | 12   | 40      | 55        |
 * | 20    | 14   | 55      | 75        |
 *
 * Values interpolate with a step function — caller is expected to pass the
 * stored `rooms.room_level` (integer). Clamps at the extremes.
 */
export function slotsForLevel(roomLevel: number): SlotCaps {
  const level = Number.isFinite(roomLevel) ? roomLevel : 1;
  if (level >= 20) return { defense: 55, furniture: 75, grid: 14 };
  if (level >= 15) return { defense: 40, furniture: 55, grid: 12 };
  if (level >= 10) return { defense: 28, furniture: 40, grid: 12 };
  if (level >= 5)  return { defense: 16, furniture: 25, grid: 10 };
  return                  { defense: 8,  furniture: 15, grid: 10 };
}

/** Tile coordinate used by {@link RangeTiles}. */
export interface RangeTile {
  x: number;
  y: number;
}

/** Two independent tile sets for a defense item's effect zone. */
export interface RangeTiles {
  /** Core effect radius — the turret's firing range or similar. */
  primary: RangeTile[];
  /** Secondary / advisory radius — e.g. a tripwire alarm's alert range. */
  alert: RangeTile[];
}

/**
 * Tiles inside a defense item's range / trigger zone when placed at
 * `(originX, originY)` on a `gridSize × gridSize` grid.
 *
 * Current rules:
 * - `turret` → `primary` = Chebyshev disk of radius `stats.range`.
 * - `trap`   → `alert`   = Chebyshev disk of radius `stats.alert_radius`.
 * - Everything else returns empty.
 *
 * Chebyshev (king-move) distance is used because it renders as a clean
 * grid-aligned diamond in the isometric view and needs no corner-clipping.
 * The balance pass (task 4.0.2) may switch to Euclidean for a more
 * "circular" firing-range feel — only this function needs to change.
 *
 * The origin tile is always excluded from both sets: it's already visually
 * indicated by the ghost sprite itself, so showing range on top of it
 * would double-tint the placement preview.
 *
 * Tiles outside `[0, gridSize)` on either axis are omitted (the helper
 * handles wall-adjacent turrets and corner placements without the caller
 * having to clip).
 */
export function rangeTilesFor(
  type: string | null | undefined,
  stats: Stats,
  originX: number,
  originY: number,
  gridSize: number,
): RangeTiles {
  const result: RangeTiles = { primary: [], alert: [] };
  if (!type || !Number.isFinite(gridSize) || gridSize <= 0) return result;

  const fillChebyshev = (bucket: RangeTile[], rawRadius: number): void => {
    const radius = Math.floor(Number(rawRadius) || 0);
    if (radius <= 0) return;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = originX + dx;
        const y = originY + dy;
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
        bucket.push({ x, y });
      }
    }
  };

  if (type === 'turret') {
    fillChebyshev(result.primary, Number(stats?.range) || 0);
  } else if (type === 'trap') {
    fillChebyshev(result.alert, Number(stats?.alert_radius) || 0);
  }

  return result;
}
