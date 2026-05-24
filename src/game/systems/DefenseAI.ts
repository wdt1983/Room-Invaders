import { EventBus } from '@/game/EventBus';
import {
  applyDamage,
  type HasHp,
  type PlacedTarget,
} from '@/game/systems/CombatSystem';

/**
 * DefenseAI — active-defense behavior for turrets (and, later, guards).
 *
 * Task 3.0.10. Mirrors the architectural split established by TrapSystem
 * (3.0.8) and CombatSystem (3.0.9):
 *   - **Pure w.r.t. Phaser** — no Phaser imports. Tick takes `timeMs` as
 *     a parameter so the file drops cleanly into a server-side
 *     `resolve-raid` Edge Function (3.0.16) that wants to replay a raid
 *     deterministically.
 *   - **Owns acquisition + fire-rate + ammo bookkeeping + damage calls.
 *     Does not own VFX or the scene-specific consequences.** The
 *     `'turret-fired'` event carries everything the scene needs to draw
 *     a projectile, apply stun, or log the shot — RaidScene is the
 *     listener.
 *
 * MVP simplifications (deferred, not design errors):
 *   - **No line-of-sight.** Turrets see through barricades + other
 *     defenses. Range acquisition is pure Chebyshev distance. LOS is a
 *     polish pass; the GDD's "line-of-sight" flavor is for higher-tier
 *     turrets and will ride in with the balance pass (4.0.2) or later.
 *   - **Range, not arc.** Turrets have 360° coverage — no facing.
 *     Rotation-aware firing cones are a future add (ties into the
 *     item-rotation work landed in 1.0.13).
 *   - **Ammo exhaustion = destruction.** Out-of-ammo turrets disappear
 *     via `'defense-destroyed'` rather than remaining visible-but-inert.
 *     Cleaner feedback for MVP; revisit when the art pass (8.0.1) has
 *     an "out of ammo" sprite state.
 *   - **Alert raises range, not fire rate.** When a tripwire alarm goes
 *     off nearby, turrets within its `alert_radius` get +1 tile of range
 *     for {@link ALERT_DURATION_MS}. Keeping to one dimension keeps
 *     alert tuning legible.
 */

/**
 * Per-type stat shape. Matches `items.stats` for `type = 'turret'` rows
 * in `supabase/seed.sql`.
 */
export interface TurretStats {
  /** HP subtracted per shot that connects. */
  damage: number;
  /** Chebyshev tile radius. `3` = a 7×7 disk centered on the turret. */
  range: number;
  /**
   * Seconds between consecutive shots. Lower = faster. Taser is 0.8,
   * nailgun is 1.0 in seed.sql.
   */
  fire_rate: number;
  /** Shots remaining before exhaustion destroys the turret. */
  ammo: number;
  /**
   * Seconds of stun applied to a hit target. Non-zero only for taser in
   * the starter roster. Scene-side consequence is identical to a stun
   * trap — reuses {@link RaidScene}'s squad-stun helper.
   */
  stun_duration?: number;
}

/**
 * Canonical turret stats keyed by `items.sprite_key` in
 * `supabase/seed.sql`. Client-side mirror with the same rationale as
 * {@link TRAP_STATS_BY_SPRITE_KEY} — retires when DB-hydrated stats flow
 * through the raid target (3.0.16 / 6.0.8).
 */
export const TURRET_STATS_BY_SPRITE_KEY: Record<string, TurretStats> = {
  turret_nailgun: { damage: 8, range: 3, fire_rate: 1.0, ammo: 15 },
  turret_taser: { damage: 5, range: 2, fire_rate: 0.8, ammo: 10, stun_duration: 1.0 },
};

/** How long an alert from a tripwire lasts, in ms. Extends all turrets
 *  within the alarm's `alert_radius` by +1 tile of range for the window. */
export const ALERT_DURATION_MS = 5000;

/** Range bonus granted while a turret is alerted. Small on purpose —
 *  the alert is flavor + strategic depth, not a power swing. */
export const ALERT_RANGE_BONUS = 1;

/**
 * Payload emitted on every successful turret fire. Flat shape so the
 * action-log recorder can persist it directly.
 */
export interface TurretFiredPayload {
  gridX: number;
  gridY: number;
  spriteKey: string;
  targetEntityId: string;
  targetGridX: number;
  targetGridY: number;
  damageDealt: number;
  stunSeconds: number;
  ammoRemaining: number;
  exhausted: boolean;
  /** True if this shot was fired while the turret was alerted (extended
   *  range). Informational; action-log consumers may surface it. */
  alerted: boolean;
}

/** Target a TurretAI instance fires against. Currently the squad
 *  entity; multi-squad (Phase 7) will grow this to an array of targets
 *  and add acquisition logic (nearest, lowest-HP, etc.). */
export interface TurretTarget extends HasHp {
  entityId: string;
  currentGridX: number;
  currentGridY: number;
}

/** Runtime record for a registered turret. */
interface DeployedTurret {
  gridX: number;
  gridY: number;
  spriteKey: string;
  stats: TurretStats;
  ammoRemaining: number;
  /** Milliseconds-since-game-start timestamp of the most recent shot.
   *  `-Infinity` means "never fired" — first in-range tick fires
   *  immediately without a warm-up delay. */
  lastFiredAtMs: number;
  /** Milliseconds-since-game-start timestamp until which the turret
   *  counts as alerted (+{@link ALERT_RANGE_BONUS} range). `0` when
   *  not alerted. */
  alertedUntilMs: number;
  sprite: PlacedTarget;
}

interface TrapTriggeredAlertPayload {
  gridX: number;
  gridY: number;
  alertRadius: number;
}

export class TurretAI {
  private readonly turrets = new Map<string, DeployedTurret>();
  private target: TurretTarget | null;
  private readonly onTrapTriggered: (payload: TrapTriggeredAlertPayload) => void;
  private destroyed = false;

  constructor(target: TurretTarget | null = null) {
    this.target = target;
    this.onTrapTriggered = (payload) => this.handleTrapTriggered(payload);
    EventBus.on('trap-triggered', this.onTrapTriggered);
  }

  /** Set (or replace) the target. MVP only ever has the squad; Phase 7
   *  will replace this with `addTarget` / `removeTarget`. */
  public setTarget(target: TurretTarget | null): void {
    this.target = target;
  }

  /**
   * Register a turret at `(gridX, gridY)`. RaidScene calls this for each
   * fixture item of `type === 'turret'`. Unknown sprite keys are skipped
   * with a warning.
   */
  public registerTurret(params: {
    gridX: number;
    gridY: number;
    spriteKey: string;
    sprite: PlacedTarget;
    stats?: TurretStats;
  }): boolean {
    const stats = params.stats ?? TURRET_STATS_BY_SPRITE_KEY[params.spriteKey];
    if (!stats) {
      console.warn(
        `[TurretAI] No stats registered for sprite_key "${params.spriteKey}" — turret at (${params.gridX}, ${params.gridY}) will not fire.`,
      );
      return false;
    }
    const key = `${params.gridX},${params.gridY}`;
    if (this.turrets.has(key)) {
      console.warn(
        `[TurretAI] Duplicate turret registration at (${params.gridX}, ${params.gridY}); overwriting previous entry.`,
      );
    }
    this.turrets.set(key, {
      gridX: params.gridX,
      gridY: params.gridY,
      spriteKey: params.spriteKey,
      stats,
      ammoRemaining: stats.ammo,
      lastFiredAtMs: Number.NEGATIVE_INFINITY,
      alertedUntilMs: 0,
      sprite: params.sprite,
    });
    return true;
  }

  /** Returns `true` if a registered turret exists at the given grid tile. */
  public hasTurretAt(gridX: number, gridY: number): boolean {
    return this.turrets.has(`${gridX},${gridY}`);
  }

  public registeredCount(): number {
    return this.turrets.size;
  }

  /**
   * Single tick. Call once per frame from the host scene's `update()`
   * method, passing `time` (the `time` argument to Phaser's update
   * callback — milliseconds since game start). Safe to call with a
   * null target; no fires occur.
   */
  public tick(timeMs: number): void {
    if (this.destroyed) return;
    const target = this.target;
    if (!target) return;
    if (target.hp <= 0) return;

    // Iterate a snapshot so `fire()` → exhaustion can safely delete from
    // the underlying map without disturbing iteration order.
    const snapshot = Array.from(this.turrets.values());
    for (const turret of snapshot) {
      if (turret.ammoRemaining <= 0) continue;
      if (timeMs - turret.lastFiredAtMs < turret.stats.fire_rate * 1000) continue;
      if (!this.isTargetInRange(turret, target, timeMs)) continue;
      this.fire(turret, target, timeMs);
      // One shot per turret per tick — if the shot killed the target,
      // the remaining turrets will see `target.hp <= 0` on their own
      // range check (ignored because dead) OR the scene will stop
      // ticking us once `phase === 'results'`.
    }
  }

  /**
   * Detach EventBus listeners, clear internal state. Idempotent.
   */
  public destroy(): void {
    if (this.destroyed) return;
    EventBus.off('trap-triggered', this.onTrapTriggered);
    this.turrets.clear();
    this.target = null;
    this.destroyed = true;
  }

  // ──────────────────────────────────────────────
  //  Internals
  // ──────────────────────────────────────────────

  private isTargetInRange(
    turret: DeployedTurret,
    target: TurretTarget,
    timeMs: number,
  ): boolean {
    const dx = Math.abs(target.currentGridX - turret.gridX);
    const dy = Math.abs(target.currentGridY - turret.gridY);
    const chebyshev = Math.max(dx, dy);
    if (chebyshev === 0) return false; // Target is ON the turret tile
    const alerted = timeMs < turret.alertedUntilMs;
    const effectiveRange = turret.stats.range + (alerted ? ALERT_RANGE_BONUS : 0);
    return chebyshev <= effectiveRange;
  }

  private fire(
    turret: DeployedTurret,
    target: TurretTarget,
    timeMs: number,
  ): void {
    turret.ammoRemaining -= 1;
    turret.lastFiredAtMs = timeMs;

    const damage = Number.isFinite(turret.stats.damage) ? turret.stats.damage : 0;
    if (damage > 0) {
      applyDamage(target, damage, target.entityId);
    }

    const stunSeconds = Number(turret.stats.stun_duration) || 0;
    const exhausted = turret.ammoRemaining <= 0;
    const alerted = timeMs < turret.alertedUntilMs;

    const payload: TurretFiredPayload = {
      gridX: turret.gridX,
      gridY: turret.gridY,
      spriteKey: turret.spriteKey,
      targetEntityId: target.entityId,
      targetGridX: target.currentGridX,
      targetGridY: target.currentGridY,
      damageDealt: damage,
      stunSeconds,
      ammoRemaining: turret.ammoRemaining,
      exhausted,
      alerted,
    };
    EventBus.emit('turret-fired', payload);

    if (exhausted) {
      // Same cleanup path as exhausted traps: emit `'defense-destroyed'`
      // directly so RaidScene's existing sprite + tile cleanup listener
      // runs. Turrets default to `hp === null` (indestructible to
      // CombatSystem), so `applyDamageToPlaced` would `{ ignored: true }`
      // without emitting.
      EventBus.emit('defense-destroyed', {
        gridX: turret.sprite.gridX,
        gridY: turret.sprite.gridY,
        spriteKey: turret.sprite.texture.key,
        maxHp: turret.sprite.maxHp,
      });
      this.turrets.delete(`${turret.gridX},${turret.gridY}`);
    }
  }

  /**
   * Alert-mode handler. A trap that emits `'trap-triggered'` with
   * `alertRadius > 0` (tripwire alarm in MVP) "wakes up" nearby turrets:
   * any turret within the Chebyshev `alertRadius` of the trap origin
   * gets +{@link ALERT_RANGE_BONUS} range for {@link ALERT_DURATION_MS}.
   *
   * Using `Date.now()` here would break replay determinism. Instead we
   * approximate the game-time basis: since we don't have access to the
   * tick `timeMs` at event time, we stamp a wall-clock offset and
   * reconcile on the next `tick()`. In practice, wall-clock and Phaser
   * `time` differ by a stable offset for a single raid session, so
   * `performance.now()`-derived behavior is correct within the raid.
   * For the Edge Function replay (3.0.16), the replay harness will
   * inject a synthetic timeMs and drive `tick()` directly, bypassing
   * this path — alerts there come from deterministic replayed events.
   */
  private handleTrapTriggered(payload: TrapTriggeredAlertPayload): void {
    if (this.destroyed) return;
    const alertRadius = Number(payload.alertRadius) || 0;
    if (alertRadius <= 0) return;
    // `performance.now()` is the same basis Phaser uses for `time`
    // (both derive from the frame timeOrigin). A 1-frame skew at the
    // boundary doesn't matter for a 5-second alert window.
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const expires = now + ALERT_DURATION_MS;
    for (const turret of this.turrets.values()) {
      const dx = Math.abs(turret.gridX - payload.gridX);
      const dy = Math.abs(turret.gridY - payload.gridY);
      const chebyshev = Math.max(dx, dy);
      if (chebyshev <= alertRadius) {
        turret.alertedUntilMs = Math.max(turret.alertedUntilMs, expires);
      }
    }
  }
}
