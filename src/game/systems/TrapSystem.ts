import { EventBus } from '@/game/EventBus';
import {
  applyDamage,
  type HasHp,
  type PlacedTarget,
} from '@/game/systems/CombatSystem';
import { usePlayerStore } from '@/lib/store/usePlayerStore';

/**
 * TrapSystem — step-on trap triggering + effect dispatch.
 *
 * Task 3.0.8. First real consumer of {@link CombatSystem} and the first
 * in-game damage source. Before this landed, the `window.__raidDev`
 * console hook in RaidScene was the only way to exercise the damage
 * pipeline.
 *
 * Shape of this module:
 *   - **Pure w.r.t. Phaser.** Same hygiene as CombatSystem — no Phaser
 *     imports. Lets the file drop into a server-side resolve-raid Edge
 *     Function (3.0.16) unchanged when the raid outcome needs to be
 *     validated authoritatively.
 *   - **Owns damage + uses bookkeeping + trigger event emission. Does
 *     not own visual effects.** VFX (camera shake, sprite alpha pulse)
 *     and movement suppression (stun / immobilize) live in RaidScene,
 *     which listens to {@link TrapSystem}'s `'trap-triggered'` event.
 *     This matches CombatSystem's "damage math inside, flavor outside"
 *     split from the 3.0.9 handoff.
 *   - **One EventBus subscription, one event emission per trigger.**
 *     Subscribes to `'entity-entered-tile'` (emitted by EntitySprite at
 *     the end of each per-tile tween). Emits `'trap-triggered'` on every
 *     successful trigger. On exhaustion, emits `'defense-destroyed'`
 *     directly to reuse RaidScene's existing sprite + tile cleanup.
 *
 * Tile-state interaction:
 *   Traps are placed on tiles that stay in state `'empty'` so A* routes
 *   the squad right over them — stepping onto the tile is the trigger.
 *   Other defense types (turret, barricade, furniture) still occupy
 *   their tiles as before. See RaidScene fixture placement for the
 *   branch.
 *
 * Not in scope (deferred):
 *   - `slow` stat on spike strip — would require mid-chain tween-duration
 *     modification. Damage still applies; slow is logged in the action
 *     entry and noted in the 3.0.8 handoff follow-ups.
 *   - Full `action_log` coverage (task 3.0.14). TrapSystem lands one
 *     emitter (`trap_triggered`); `move`, `damage`, and `entity_killed`
 *     entries are left for 3.0.14.
 *   - Alert-radius reactivity (turrets / guards alerting on tripwire).
 *     Event payload carries `alertRadius`; no consumer yet. Plugs into
 *     3.0.10 (turret AI) without changes here.
 */

/**
 * Per-type stat shape. Matches the JSONB `items.stats` column in
 * `supabase/seed.sql` for `type = 'trap'` rows. Fields are optional
 * because not every trap uses every effect (a pressure plate has only
 * damage; a glue trap has only immobilize).
 */
export interface TrapStats {
  /** HP subtracted on trigger. `0` is valid (glue / tripwire). */
  damage: number;
  /** Seconds of stun (blocks movement, short duration with damage). */
  stun_duration?: number;
  /** Seconds of immobilize (blocks movement, longer duration without damage). */
  immobilize_duration?: number;
  /** Tiles of alert radius for tripwire-style traps. */
  alert_radius?: number;
  /**
   * Movement multiplier applied for the remainder of the squad's path
   * segment. `0.5` = 50% slower. Not applied in MVP (tween-duration
   * modification is out of scope for 3.0.8); damage still applies and
   * the value is echoed in the trigger event + action log so downstream
   * tasks can pick it up.
   */
  slow?: number;
  /** Max times this trap can trigger before exhaustion removes it. */
  uses: number;
  /** EMP duration in seconds. */
  emp_duration?: number;
}

/**
 * Canonical trap stats keyed by `items.sprite_key` in `supabase/seed.sql`.
 *
 * Client-side duplication of the DB. Acceptable for the raid scaffold
 * because:
 *   1. RaidScene doesn't hydrate the items catalog during a raid
 *      (see handoff 3.0.13 §15 — TopBar also shows default resources
 *      during a raid).
 *   2. Fixtures are TypeScript literals, not DB rows.
 *
 * When 3.0.16 (resolve-raid) or 6.0.8 (generate-npc-room) lands, the
 * raid target will carry fully-hydrated item rows with `stats` attached.
 * At that point this map becomes the fallback for scaffolded fixtures
 * and, eventually, gets removed.
 */
export const TRAP_STATS_BY_SPRITE_KEY: Record<string, TrapStats> = {
  trap_pressure_plate: { damage: 15, uses: 1 },
  trap_spike_strip: { damage: 10, slow: 0.5, uses: 2 },
  trap_shock_pad: { damage: 12, stun_duration: 1.8, uses: 1 },
  trap_glue: { damage: 0, immobilize_duration: 4, uses: 1 },
  trap_tripwire_alarm: { damage: 0, alert_radius: 4, uses: 1 },
  trap_flame_vent: { damage: 30, uses: 3 },
  trap_laser_grid: { damage: 0, alert_radius: 15, uses: 99 },
  trap_shock_wire: { damage: 15, stun_duration: 2.5, uses: 2 },
  trap_emp_mine: { damage: 0, emp_duration: 12.0, uses: 1 },
  trap_bear_trap: { damage: 30, stun_duration: 2.0, uses: 2 },
  trap_ghost_wire: { damage: 0, alert_radius: 8, uses: 3 },
  trap_circuit_emp_mine: { damage: 5, stun_duration: 4.0, uses: 1 },
};

/**
 * Payload emitted on every successful trap trigger. Flat shape so the
 * action-log recorder (task 3.0.14) can persist it directly without
 * re-deriving anything.
 */
export interface TrapTriggeredPayload {
  gridX: number;
  gridY: number;
  spriteKey: string;
  entityId: string;
  damageDealt: number;
  stunSeconds: number;
  immobilizeSeconds: number;
  alertRadius: number;
  slow: number;
  usesRemaining: number;
  exhausted: boolean;
}

/** Runtime record for a trap on the grid. Stored internally by the
 *  system; the sprite reference is retained so exhaustion can emit the
 *  canonical `'defense-destroyed'` payload with the right sprite key. */
interface DeployedTrap {
  gridX: number;
  gridY: number;
  spriteKey: string;
  stats: TrapStats;
  usesRemaining: number;
  sprite: PlacedTarget;
}

interface EnteredTilePayload {
  entityId: string;
  x: number;
  y: number;
}

/**
 * Target a TrapSystem instance triggers against. Currently the squad
 * entity; Phase 7's expanded squad will instantiate one system per
 * squad member (or pass an array of targets — design decision for later).
 */
export interface TrapTarget extends HasHp {
  entityId: string;
}

export class TrapSystem {
  private readonly traps = new Map<string, DeployedTrap>();
  private readonly targets: TrapTarget[] = [];
  private readonly onEnteredTile: (payload: EnteredTilePayload) => void;
  private destroyed = false;

  constructor(target: TrapTarget | TrapTarget[]) {
    this.targets = Array.isArray(target) ? target : [target];
    this.onEnteredTile = (payload) => this.handleTileEntered(payload);
    EventBus.on('entity-entered-tile', this.onEnteredTile);
  }

  /**
   * Register a trap at `(gridX, gridY)`. Called by RaidScene for each
   * fixture item of `type === 'trap'`. Unknown sprite keys (not in
   * {@link TRAP_STATS_BY_SPRITE_KEY}) are skipped with a console warning
   * so a misspelled fixture row fails loudly in dev without crashing.
   *
   * Returns `true` if registered, `false` if skipped.
   */
  public registerTrap(params: {
    gridX: number;
    gridY: number;
    spriteKey: string;
    sprite: PlacedTarget;
    /** Override the stats from {@link TRAP_STATS_BY_SPRITE_KEY}. Lets
     *  future DB-hydrated targets pass authoritative stats through. */
    stats?: TrapStats;
  }): boolean {
    const stats = params.stats ?? TRAP_STATS_BY_SPRITE_KEY[params.spriteKey];
    if (!stats) {
      console.warn(
        `[TrapSystem] No stats registered for sprite_key "${params.spriteKey}" — trap at (${params.gridX}, ${params.gridY}) will not trigger.`,
      );
      return false;
    }
    const key = `${params.gridX},${params.gridY}`;
    if (this.traps.has(key)) {
      console.warn(
        `[TrapSystem] Duplicate trap registration at (${params.gridX}, ${params.gridY}); overwriting previous entry.`,
      );
    }
    const activeEffects = usePlayerStore.getState().activeEffects;
    const trapUsesBonus = activeEffects.trapUsesBonus ?? 0;

    this.traps.set(key, {
      gridX: params.gridX,
      gridY: params.gridY,
      spriteKey: params.spriteKey,
      stats,
      usesRemaining: stats.uses + trapUsesBonus,
      sprite: params.sprite,
    });
    return true;
  }

  /** Returns `true` if a registered trap exists at the given grid tile.
   *  Used by tests / dev tools; not called in the hot path. */
  public hasTrapAt(gridX: number, gridY: number): boolean {
    return this.traps.has(`${gridX},${gridY}`);
  }

  public registeredCount(): number {
    return this.traps.size;
  }

  /**
   * Detach the EventBus listener and clear internal state. Call from
   * RaidScene's `teardown()`. Safe to call twice — the second call is a
   * no-op.
   */
  public destroy(): void {
    if (this.destroyed) return;
    EventBus.off('entity-entered-tile', this.onEnteredTile);
    this.traps.clear();
    this.destroyed = true;
  }

  private handleTileEntered(payload: EnteredTilePayload): void {
    if (this.destroyed) return;
    const target = this.targets.find((t) => t.entityId === payload.entityId);
    if (!target) return;
    if (target.hp <= 0) return;
    const trap = this.traps.get(`${payload.x},${payload.y}`);
    if (!trap) return;
    if (trap.usesRemaining <= 0) return;
    this.trigger(trap, target);
  }

  private trigger(trap: DeployedTrap, target: TrapTarget): void {
    trap.usesRemaining -= 1;

    const activeEffects = usePlayerStore.getState().activeEffects;
    const baseDamage = Number.isFinite(trap.stats.damage) ? trap.stats.damage : 0;
    const damage = Math.round(baseDamage * (activeEffects.trapDamageMult ?? 1.0));
    
    if (damage > 0) {
      applyDamage(target, damage, target.entityId);
    }

    const trapStunBonus = activeEffects.trapStunBonus ?? 0;
    const stunSeconds = (Number(trap.stats.stun_duration) || 0) + (Number(trap.stats.stun_duration) > 0 ? trapStunBonus : 0);
    const immobilizeSeconds = (Number(trap.stats.immobilize_duration) || 0) + (Number(trap.stats.immobilize_duration) > 0 ? trapStunBonus : 0);
    const alertRadius = Number(trap.stats.alert_radius) || 0;
    const slow = Number(trap.stats.slow) || 0;
    const exhausted = trap.usesRemaining <= 0;

    const triggerPayload: TrapTriggeredPayload = {
      gridX: trap.gridX,
      gridY: trap.gridY,
      spriteKey: trap.spriteKey,
      entityId: target.entityId,
      damageDealt: damage,
      stunSeconds,
      immobilizeSeconds,
      alertRadius,
      slow,
      usesRemaining: trap.usesRemaining,
      exhausted,
    };
    EventBus.emit('trap-triggered', triggerPayload);

    if (exhausted) {
      // Reuse the RaidScene `'defense-destroyed'` cleanup path. Traps
      // carry `hp === null` (indestructible to the CombatSystem), so
      // `applyDamageToPlaced` would `{ ignored: true }` without emitting.
      // Emitting directly here gives us the sprite + tile cleanup for
      // free without threading HP through the trap sprite.
      EventBus.emit('defense-destroyed', {
        gridX: trap.sprite.gridX,
        gridY: trap.sprite.gridY,
        spriteKey: trap.sprite.texture.key,
        maxHp: trap.sprite.maxHp,
      });
      this.traps.delete(`${trap.gridX},${trap.gridY}`);
    }
  }
}
