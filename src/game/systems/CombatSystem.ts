import { EventBus } from '@/game/EventBus';

/**
 * CombatSystem — HP tracking, damage application, death/destruction events.
 *
 * Task 3.0.9 scaffold. The functions here are the *authoritative* damage
 * pipeline for Phase 3 — every trap trigger (3.0.8), turret shot (3.0.10),
 * barricade attack (3.0.11), and future melee / ability interaction must
 * flow through one of these calls so death events are emitted consistently.
 *
 * Shape of this module:
 *   - **Pure w.r.t. Phaser.** Operates on arbitrary objects that satisfy
 *     {@link HasHp}; no Phaser imports. Easy to reuse in a server-side
 *     resolve-raid Edge Function (3.0.16) later.
 *   - **Side effect is one EventBus emit per kill frame.** Damage that
 *     doesn't kill is a silent mutation — each subsystem chooses whether
 *     to emit its own "damaged" event. The kill frame fires exactly one
 *     `'entity-killed'` / `'defense-destroyed'` event.
 *   - **Heal is symmetric.** Same function, negative amount would clamp
 *     to zero but not interact with death — so we expose `heal` as a
 *     separate call that clamps to `maxHp` and never revives a dead
 *     entity (revive semantics are out of scope for MVP).
 */

/** Minimum contract a target must satisfy to be damaged by the combat
 *  system. `maxHp` stays constant; `hp` is the mutable field. */
export interface HasHp {
  hp: number;
  maxHp: number;
}

export interface DamageResult {
  hp: number;
  /** True if this specific `applyDamage` call is the one that crossed the
   *  death threshold (i.e., was alive before, dead after). Further damage
   *  to an already-dead target returns `{ hp: 0, dead: false }` — kill
   *  events fire exactly once per entity. */
  dead: boolean;
}

/**
 * Apply damage to an entity. Negative `amount` is clamped to 0 (no heal
 * via negative — use {@link heal} instead). Non-finite amounts are
 * ignored.
 *
 * Fires `EventBus.emit('entity-damaged', { entityId, hp, maxHp, amount })`
 * on every non-zero damage. Fires `EventBus.emit('entity-killed',
 * { entityId, maxHp })` exactly once, on the kill frame.
 */
export function applyDamage(
  target: HasHp,
  amount: number,
  entityId: string,
): DamageResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { hp: target.hp, dead: false };
  }
  if (target.hp <= 0) {
    // Already dead; damage is a no-op and no event fires (kill already
    // announced on the earlier frame).
    return { hp: 0, dead: false };
  }

  const wasAlive = target.hp > 0;
  target.hp = Math.max(0, target.hp - amount);
  const died = wasAlive && target.hp === 0;

  EventBus.emit('entity-damaged', {
    entityId,
    hp: target.hp,
    maxHp: target.maxHp,
    amount,
  });
  if (died) {
    EventBus.emit('entity-killed', {
      entityId,
      maxHp: target.maxHp,
    });
  }

  return { hp: target.hp, dead: died };
}

/**
 * Heal an entity up to `maxHp`. Never revives a dead entity (`hp === 0`);
 * call sites that want revive semantics should set `hp = 1` explicitly
 * first. Fires `EventBus.emit('entity-healed', ...)` on non-zero heal.
 */
export function heal(target: HasHp, amount: number, entityId: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return target.hp;
  if (target.hp <= 0) return 0; // Death is permanent without explicit revive.
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  if (target.hp !== before) {
    EventBus.emit('entity-healed', {
      entityId,
      hp: target.hp,
      maxHp: target.maxHp,
      amount: target.hp - before,
    });
  }
  return target.hp;
}

/** Placed-item HP is optional — furniture, traps, turrets, and cosmetics
 *  default to indestructible. Barricades (and any future destructible
 *  defense) opt in by setting a numeric `hp`. */
export interface PlacedTarget {
  hp: number | null;
  maxHp: number | null;
  gridX: number;
  gridY: number;
  /** Phaser image texture reference — read-only access, we only need
   *  `.key`. Typed loosely so this module stays Phaser-import-free. */
  texture: { key: string };
}

export interface PlacedDamageResult {
  hp: number | null;
  destroyed: boolean;
  /** True when `hp` was null (indestructible — damage was ignored) so
   *  callers can distinguish "nothing happened" from "damage applied". */
  ignored: boolean;
}

/**
 * Apply damage to a placed item on the grid (barricades, turrets with HP,
 * any future destructible furniture). Indestructible items (`hp === null`)
 * no-op with `{ ignored: true }`.
 *
 * Fires `EventBus.emit('defense-damaged', { gridX, gridY, spriteKey,
 * hp, maxHp, amount })` on every non-zero damage.
 *
 * Fires `EventBus.emit('defense-destroyed', { gridX, gridY, spriteKey,
 * maxHp })` exactly once, on the destruction frame. RaidScene listens to
 * this to destroy the sprite + clear the tile state.
 */
export function applyDamageToPlaced(
  target: PlacedTarget,
  amount: number,
): PlacedDamageResult {
  if (target.hp === null || target.maxHp === null) {
    return { hp: null, destroyed: false, ignored: true };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { hp: target.hp, destroyed: false, ignored: false };
  }
  if (target.hp <= 0) {
    return { hp: 0, destroyed: false, ignored: false };
  }

  const wasAlive = target.hp > 0;
  target.hp = Math.max(0, target.hp - amount);
  const destroyed = wasAlive && target.hp === 0;
  const spriteKey = target.texture.key;

  EventBus.emit('defense-damaged', {
    gridX: target.gridX,
    gridY: target.gridY,
    spriteKey,
    hp: target.hp,
    maxHp: target.maxHp,
    amount,
  });
  if (destroyed) {
    EventBus.emit('defense-destroyed', {
      gridX: target.gridX,
      gridY: target.gridY,
      spriteKey,
      maxHp: target.maxHp,
    });
  }

  return { hp: target.hp, destroyed, ignored: false };
}

/** Default squad HP baseline. Calibration belongs in the 4.0.2 balance
 *  pass; this is deliberately generous (enough to survive ~4 small trap
 *  triggers at 20 dmg each) so the MVP scaffold reads as survivable. */
export const DEFAULT_SQUAD_HP = 100;
