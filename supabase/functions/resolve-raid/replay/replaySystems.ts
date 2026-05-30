// supabase/functions/resolve-raid/replay/replaySystems.ts

import type { ActiveEffects } from "./techTree.ts";

// ==========================================
// 1. Deno-Safe EventBus (CustomEventEmitter)
// ==========================================
type EventHandler = (...args: any[]) => void;

class CustomEventEmitter {
  private events: Record<string, EventHandler[]> = {};

  on(event: string, listener: EventHandler) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event: string, ...args: unknown[]) {
    if (this.events[event]) {
      this.events[event].forEach((listener) => listener(...args));
    }
  }

  off(event: string, listener: EventHandler) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((l) => l !== listener);
  }

  clearAll() {
    this.events = {};
  }
}

export const EventBus = new CustomEventEmitter();

// ==========================================
// 2. Pure Deno CombatSystem
// ==========================================
export interface HasHp {
  hp: number;
  maxHp: number;
}

export interface DamageResult {
  hp: number;
  dead: boolean;
}

export function applyDamage(
  target: HasHp,
  amount: number,
  entityId: string,
): DamageResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { hp: target.hp, dead: false };
  }
  if (target.hp <= 0) {
    return { hp: 0, dead: false };
  }

  const wasAlive = target.hp > 0;
  target.hp = Math.max(0, target.hp - amount);
  const died = wasAlive && target.hp === 0;

  EventBus.emit("entity-damaged", {
    entityId,
    hp: target.hp,
    maxHp: target.maxHp,
    amount,
  });

  if (died) {
    EventBus.emit("entity-killed", {
      entityId,
      maxHp: target.maxHp,
    });
  }

  return { hp: target.hp, dead: died };
}

export function heal(target: HasHp, amount: number, entityId: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return target.hp;
  if (target.hp <= 0) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  if (target.hp !== before) {
    EventBus.emit("entity-healed", {
      entityId,
      hp: target.hp,
      maxHp: target.maxHp,
      amount: target.hp - before,
    });
  }
  return target.hp;
}

export interface PlacedTarget {
  hp: number | null;
  maxHp: number | null;
  gridX: number;
  gridY: number;
  spriteKey: string;
}

export interface PlacedDamageResult {
  hp: number | null;
  destroyed: boolean;
  ignored: boolean;
}

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

  EventBus.emit("defense-damaged", {
    gridX: target.gridX,
    gridY: target.gridY,
    spriteKey: target.spriteKey,
    hp: target.hp,
    maxHp: target.maxHp,
    amount,
  });

  if (destroyed) {
    EventBus.emit("defense-destroyed", {
      gridX: target.gridX,
      gridY: target.gridY,
      spriteKey: target.spriteKey,
      maxHp: target.maxHp,
    });
  }

  return { hp: target.hp, destroyed, ignored: false };
}

// ==========================================
// 3. Pure Deno TrapSystem
// ==========================================
export interface TrapStats {
  damage: number;
  stun_duration?: number;
  immobilize_duration?: number;
  alert_radius?: number;
  slow?: number;
  uses: number;
  emp_duration?: number;
}

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
};

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

interface DeployedTrap {
  gridX: number;
  gridY: number;
  spriteKey: string;
  stats: TrapStats;
  usesRemaining: number;
  sprite: PlacedTarget;
}

export interface TrapTarget extends HasHp {
  entityId: string;
}

export class TrapSystem {
  private readonly traps = new Map<string, DeployedTrap>();
  private readonly targets: TrapTarget[] = [];
  private readonly activeEffects: ActiveEffects;
  private readonly onEnteredTile: (payload: { entityId: string; x: number; y: number }) => void;
  private destroyed = false;

  constructor(target: TrapTarget | TrapTarget[], activeEffects: ActiveEffects) {
    this.targets = Array.isArray(target) ? target : [target];
    this.activeEffects = activeEffects;
    this.onEnteredTile = (payload) => this.handleTileEntered(payload);
    EventBus.on("entity-entered-tile", this.onEnteredTile);
  }

  public registerTrap(params: {
    gridX: number;
    gridY: number;
    spriteKey: string;
    sprite: PlacedTarget;
    stats?: TrapStats;
  }): boolean {
    const stats = params.stats ?? TRAP_STATS_BY_SPRITE_KEY[params.spriteKey];
    if (!stats) return false;

    const key = `${params.gridX},${params.gridY}`;
    const trapUsesBonus = this.activeEffects.trapUsesBonus ?? 0;

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

  public hasTrapAt(gridX: number, gridY: number): boolean {
    return this.traps.has(`${gridX},${gridY}`);
  }

  public registeredCount(): number {
    return this.traps.size;
  }

  public destroy(): void {
    if (this.destroyed) return;
    EventBus.off("entity-entered-tile", this.onEnteredTile);
    this.traps.clear();
    this.destroyed = true;
  }

  private handleTileEntered(payload: { entityId: string; x: number; y: number }): void {
    if (this.destroyed) return;
    const target = this.targets.find((t) => t.entityId === payload.entityId);
    if (!target || target.hp <= 0) return;

    const trap = this.traps.get(`${payload.x},${payload.y}`);
    if (!trap || trap.usesRemaining <= 0) return;

    this.trigger(trap, target);
  }

  private trigger(trap: DeployedTrap, target: TrapTarget): void {
    trap.usesRemaining -= 1;

    const baseDamage = Number.isFinite(trap.stats.damage) ? trap.stats.damage : 0;
    const damage = Math.round(baseDamage * (this.activeEffects.trapDamageMult ?? 1.0));

    if (damage > 0) {
      applyDamage(target, damage, target.entityId);
    }

    const trapStunBonus = this.activeEffects.trapStunBonus ?? 0;
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
    EventBus.emit("trap-triggered", triggerPayload);

    if (exhausted) {
      EventBus.emit("defense-destroyed", {
        gridX: trap.sprite.gridX,
        gridY: trap.sprite.gridY,
        spriteKey: trap.sprite.spriteKey,
        maxHp: trap.sprite.maxHp,
      });
      this.traps.delete(`${trap.gridX},${trap.gridY}`);
    }
  }
}

// ==========================================
// 4. Pure Deno DefenseAI (Turret AI)
// ==========================================
export interface TurretStats {
  damage: number;
  range: number;
  fire_rate: number;
  ammo: number;
  stun_duration?: number;
  chain_targets?: number;
  spread_cone?: boolean;
}

export const TURRET_STATS_BY_SPRITE_KEY: Record<string, TurretStats> = {
  turret_nailgun: { damage: 8, range: 3, fire_rate: 1.0, ammo: 15 },
  turret_taser: { damage: 6, range: 2, fire_rate: 0.8, ammo: 12, stun_duration: 1.2 },
  turret_tesla: { damage: 18, range: 3, fire_rate: 1.1, ammo: 20, chain_targets: 3 },
  turret_autocannon: { damage: 45, range: 5, fire_rate: 1.8, ammo: 12 },
  turret_shotgun: { damage: 25, range: 2, fire_rate: 1.4, ammo: 10, spread_cone: true },
  turret_autocannon_mk2: { damage: 25, range: 6, fire_rate: 1.5, ammo: 10 },
};

export const ALERT_DURATION_MS = 5000;
export const ALERT_RANGE_BONUS = 1;

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
  alerted: boolean;
}

export interface TurretTarget extends HasHp {
  entityId: string;
  currentGridX: number;
  currentGridY: number;
}

interface DeployedTurret {
  gridX: number;
  gridY: number;
  spriteKey: string;
  stats: TurretStats;
  ammoRemaining: number;
  lastFiredAtMs: number;
  alertedUntilMs: number;
  sprite: PlacedTarget;
}

export class TurretAI {
  private readonly turrets = new Map<string, DeployedTurret>();
  private targets: TurretTarget[] = [];
  private readonly activeEffects: ActiveEffects;
  private readonly onTrapTriggered: (payload: { gridX: number; gridY: number; alertRadius: number }) => void;
  private destroyed = false;
  private activeEvent: any = null;

  constructor(activeEffects: ActiveEffects, target: TurretTarget | TurretTarget[] | null = null) {
    this.activeEffects = activeEffects;
    if (target) {
      this.targets = Array.isArray(target) ? target : [target];
    }
    this.onTrapTriggered = (payload) => this.handleTrapTriggered(payload);
    EventBus.on("trap-triggered", this.onTrapTriggered);
  }

  public setTargets(targets: TurretTarget[]): void {
    this.targets = targets;
  }

  public setActiveEvent(event: any): void {
    this.activeEvent = event;
  }

  public registerTurret(params: {
    gridX: number;
    gridY: number;
    spriteKey: string;
    sprite: PlacedTarget;
    stats?: TurretStats;
  }): boolean {
    const stats = params.stats ?? TURRET_STATS_BY_SPRITE_KEY[params.spriteKey];
    if (!stats) return false;

    const key = `${params.gridX},${params.gridY}`;
    const turretAmmoMult = this.activeEffects.turretAmmoMult ?? 1.0;

    this.turrets.set(key, {
      gridX: params.gridX,
      gridY: params.gridY,
      spriteKey: params.spriteKey,
      stats,
      ammoRemaining: Math.round(stats.ammo * turretAmmoMult),
      lastFiredAtMs: Number.NEGATIVE_INFINITY,
      alertedUntilMs: 0,
      sprite: params.sprite,
    });
    return true;
  }

  public hasTurretAt(gridX: number, gridY: number): boolean {
    return this.turrets.has(`${gridX},${gridY}`);
  }

  public getTurret(gridX: number, gridY: number): DeployedTurret | undefined {
    return this.turrets.get(`${gridX},${gridY}`);
  }

  public getTurrets(): Map<string, DeployedTurret> {
    return this.turrets;
  }

  public registeredCount(): number {
    return this.turrets.size;
  }

  public tick(timeMs: number): void {
    if (this.destroyed || this.targets.length === 0) return;

    const aliveTargets = this.targets.filter((t) => t.hp > 0);
    if (aliveTargets.length === 0) return;

    // Support Community Event Penalties
    const isMalfunctionActive = this.activeEvent?.eventType === "turret_malfunction";
    const jamChance = isMalfunctionActive ? (Number(this.activeEvent?.parameters?.turret_jam_chance) || 0.15) : 0;
    const isBlackoutActive = this.activeEvent?.eventType === "sector_blackout";
    const blackoutPenalty = isBlackoutActive ? 1 : 0;

    const snapshot = Array.from(this.turrets.values());
    for (const turret of snapshot) {
      if (turret.ammoRemaining <= 0) continue;
      if (timeMs - turret.lastFiredAtMs < turret.stats.fire_rate * 1000) continue;

      // Event Malfunction Jam check (skipped during pure validation mock unless exact random matches,
      // but we support it for completeness)
      if (isMalfunctionActive && Math.random() < jamChance) {
        turret.lastFiredAtMs = timeMs - (turret.stats.fire_rate * 1000 * 0.5);
        continue;
      }

      let bestTarget: TurretTarget | null = null;
      let minDistance = Infinity;

      for (const target of aliveTargets) {
        const dx = Math.abs(target.currentGridX - turret.gridX);
        const dy = Math.abs(target.currentGridY - turret.gridY);
        const chebyshev = Math.max(dx, dy);
        if (chebyshev === 0) continue; // target ON turret tile (impossible since turret occupies grid, but guard check)

        const alerted = timeMs < turret.alertedUntilMs;
        const turretRangeBonus = this.activeEffects.turretRangeBonus ?? 0;
        const effectiveRange = turret.stats.range + turretRangeBonus + (alerted ? ALERT_RANGE_BONUS : 0) - blackoutPenalty;

        if (chebyshev <= effectiveRange && chebyshev < minDistance) {
          minDistance = chebyshev;
          bestTarget = target;
        }
      }

      if (bestTarget) {
        this.fire(turret, bestTarget, timeMs);
      }
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    EventBus.off("trap-triggered", this.onTrapTriggered);
    this.turrets.clear();
    this.targets = [];
    this.destroyed = true;
  }

  private fire(turret: DeployedTurret, target: TurretTarget, timeMs: number): void {
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
    EventBus.emit("turret-fired", payload);

    if (exhausted) {
      EventBus.emit("defense-destroyed", {
        gridX: turret.sprite.gridX,
        gridY: turret.sprite.gridY,
        spriteKey: turret.sprite.spriteKey,
        maxHp: turret.sprite.maxHp,
      });
      this.turrets.delete(`${turret.gridX},${turret.gridY}`);
    }
  }

  private handleTrapTriggered(payload: { gridX: number; gridY: number; alertRadius: number }): void {
    if (this.destroyed) return;
    const alertRadius = Number(payload.alertRadius) || 0;
    if (alertRadius <= 0) return;

    // Use performance.now() fallback or current timestamp
    const now = typeof performance !== "undefined" && typeof performance.now === "function"
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

// ==========================================
// 5. Pure Deno BossAI
// ==========================================
export interface BossPhase {
  hpThreshold: number;
  speedMultiplier: number;
  damageMultiplier: number;
  attackRateMultiplier: number;
  onEnter?: {
    type: string;
    params: Record<string, number>;
  };
}

export interface BossAbility {
  id: string;
  cooldownSeconds: number;
  range: number;
  damage?: number;
  stunSeconds?: number;
  description: string;
}

export interface BossDefinition {
  entityId: string;
  name: string;
  title: string;
  spriteKey: string;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackRate: number;
  attackRange: number;
  phases: BossPhase[];
  abilities: BossAbility[];
  spawnTile: { x: number; y: number };
}

export interface BossTarget extends HasHp {
  entityId: string;
  currentGridX: number;
  currentGridY: number;
}

export class BossAI {
  private boss: BossDefinition;
  private currentPhaseIndex: number = 0;
  private lastAttackMs: number = 0;
  private abilityCooldowns = new Map<string, number>();
  private destroyed: boolean = false;
  
  // Simulated Boss Entity
  public entity: {
    entityId: string;
    hp: number;
    maxHp: number;
    currentGridX: number;
    currentGridY: number;
  };

  constructor(boss: BossDefinition) {
    this.boss = boss;
    this.entity = {
      entityId: boss.entityId,
      hp: boss.hp,
      maxHp: boss.maxHp,
      currentGridX: boss.spawnTile.x,
      currentGridY: boss.spawnTile.y,
    };
  }

  public tick(timeMs: number, targets: BossTarget[]): void {
    if (this.destroyed || this.entity.hp <= 0) return;

    // 1. Check phase transitions (HP thresholds)
    this.checkPhaseTransition(timeMs);

    const aliveTargets = targets.filter((t) => t.hp > 0);
    if (aliveTargets.length === 0) return;

    // 2. Check ability triggers
    this.checkAbilities(timeMs, aliveTargets);

    // 3. Basic attacks
    let closestTarget: BossTarget | null = null;
    let minDistance = Infinity;

    for (const target of aliveTargets) {
      const dx = Math.abs(target.currentGridX - this.entity.currentGridX);
      const dy = Math.abs(target.currentGridY - this.entity.currentGridY);
      const dist = Math.max(dx, dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestTarget = target;
      }
    }

    if (closestTarget) {
      const stats = this.getCurrentStats();
      if (minDistance <= stats.attackRange) {
        if (timeMs - this.lastAttackMs >= stats.attackRate * 1000) {
          this.lastAttackMs = timeMs;
          this.attack(closestTarget, stats.damage);
        }
      }
    }
  }

  private checkPhaseTransition(timeMs: number): void {
    const currentHpRatio = this.entity.hp / this.entity.maxHp;

    for (let i = this.currentPhaseIndex + 1; i < this.boss.phases.length; i++) {
      const phase = this.boss.phases[i];
      if (currentHpRatio <= phase.hpThreshold) {
        this.currentPhaseIndex = i;

        EventBus.emit("boss-phase-changed", {
          bossId: this.boss.entityId,
          newPhase: i + 1,
          totalPhases: this.boss.phases.length,
          event: phase.onEnter,
        });

        if (phase.onEnter) {
          this.executePhaseEvent(phase.onEnter);
        }
      }
    }
  }

  private executePhaseEvent(event: any): void {
    switch (event.type) {
      case "heal_self":
        const healAmt = Math.round(this.entity.maxHp * (event.params.amount ?? 0.25));
        this.entity.hp = Math.min(this.entity.maxHp, this.entity.hp + healAmt);
        break;
      // Other events are descriptive, visual overlays on client (spawn minions, overcharge, etc.)
    }
  }

  private checkAbilities(timeMs: number, targets: BossTarget[]): void {
    for (const ability of this.boss.abilities) {
      const nextTime = this.abilityCooldowns.get(ability.id) ?? 0;
      if (timeMs >= nextTime) {
        const targetsInRange = targets.filter((t) => {
          const dx = Math.abs(t.currentGridX - this.entity.currentGridX);
          const dy = Math.abs(t.currentGridY - this.entity.currentGridY);
          return Math.max(dx, dy) <= ability.range;
        });

        if (targetsInRange.length > 0) {
          const target = targetsInRange[0];
          this.abilityCooldowns.set(ability.id, timeMs + (ability.cooldownSeconds * 1000));
          this.castAbility(ability, target);
        }
      }
    }
  }

  private castAbility(ability: BossAbility, target: BossTarget): void {
    if (ability.damage && ability.damage > 0) {
      applyDamage(target, ability.damage, target.entityId);
    }

    EventBus.emit("boss-ability-used", {
      bossId: this.boss.entityId,
      abilityId: ability.id,
      targetGridX: target.currentGridX,
      targetGridY: target.currentGridY,
      targetEntityId: target.entityId,
      damageDealt: ability.damage ?? 0,
      stunSeconds: ability.stunSeconds ?? 0,
      description: ability.description,
    });
  }

  private attack(target: BossTarget, damage: number): void {
    applyDamage(target, damage, target.entityId);

    EventBus.emit("boss-attacked", {
      bossId: this.boss.entityId,
      targetId: target.entityId,
      damage: damage,
      bossGridX: this.entity.currentGridX,
      bossGridY: this.entity.currentGridY,
      targetGridX: target.currentGridX,
      targetGridY: target.currentGridY,
    });
  }

  public getCurrentStats() {
    let speed = this.boss.speed;
    let damage = this.boss.damage;
    let attackRate = this.boss.attackRate;
    const attackRange = this.boss.attackRange;

    for (let i = 1; i <= this.currentPhaseIndex; i++) {
      const phase = this.boss.phases[i];
      if (phase) {
        speed *= phase.speedMultiplier;
        damage *= phase.damageMultiplier;
        attackRate *= phase.attackRateMultiplier;
      }
    }

    return { speed, damage, attackRate, attackRange };
  }

  public destroy(): void {
    this.destroyed = true;
    this.abilityCooldowns.clear();
  }
}
