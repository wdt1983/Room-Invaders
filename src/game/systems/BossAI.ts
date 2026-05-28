import { EventBus } from '@/game/EventBus';
import { applyDamage } from '@/game/systems/CombatSystem';
import type { BossDefinition, BossAbility, BossPhaseEvent } from '../fixtures/boss-rooms';
import type { EntitySprite } from '../objects/EntitySprite';
import type { GridSystem } from './GridSystem';

export class BossAI {
  private boss: BossDefinition;
  private entity: EntitySprite;
  private gridSystem: GridSystem;
  private currentPhaseIndex: number = 0;
  private lastAttackMs: number = 0;
  private lastPathfindMs: number = 0;
  private abilityCooldowns: Map<string, number> = new Map();  // maps abilityId -> nextAllowedTimeMs
  private destroyed: boolean = false;

  constructor(boss: BossDefinition, entity: EntitySprite, grid: GridSystem) {
    this.boss = boss;
    this.entity = entity;
    this.gridSystem = grid;
  }

  public tick(timeMs: number, targets: EntitySprite[]): void {
    if (this.destroyed) return;
    if (this.entity.hp <= 0) return;

    // 1. Check phase transitions (HP thresholds)
    this.checkPhaseTransition(timeMs);

    const aliveTargets = targets.filter(t => t.hp > 0);
    if (aliveTargets.length === 0) return;

    // 2. Check ability triggers
    this.checkAbilities(timeMs, aliveTargets);

    // 3. Melee/Ranged basic attacks and movement
    let closestTarget: EntitySprite | null = null;
    let minDistance = Infinity;

    for (const target of aliveTargets) {
      const dx = Math.abs(target.currentGridX - this.entity.currentGridX);
      const dy = Math.abs(target.currentGridY - this.entity.currentGridY);
      const dist = Math.max(dx, dy); // Chebyshev distance
      if (dist < minDistance) {
        minDistance = dist;
        closestTarget = target;
      }
    }

    if (closestTarget) {
      const stats = this.getCurrentStats();
      if (minDistance <= stats.attackRange) {
        // If within attack range, attack
        if (timeMs - this.lastAttackMs >= stats.attackRate * 1000) {
          this.lastAttackMs = timeMs;
          this.attack(closestTarget, timeMs, stats.damage);
        }
      } else if (this.boss.speed > 0) {
        // If not in range, and mobile, move towards target
        // Throttle pathfinding to prevent CPU melt
        if (timeMs - this.lastPathfindMs >= 1500) {
          this.lastPathfindMs = timeMs;
          this.moveTowards(closestTarget);
        }
      }
    }
  }

  private checkPhaseTransition(timeMs: number): void {
    const currentHpRatio = this.entity.hp / this.entity.maxHp;
    
    // Check if we should advance to a higher phase index
    for (let i = this.currentPhaseIndex + 1; i < this.boss.phases.length; i++) {
      const phase = this.boss.phases[i];
      if (currentHpRatio <= phase.hpThreshold) {
        this.currentPhaseIndex = i;
        
        // Phase transition event
        console.log(`[BossAI] ${this.boss.name} entered Phase ${i + 1}! HP Ratio: ${currentHpRatio.toFixed(2)}`);
        
        EventBus.emit('boss-phase-changed', {
          bossId: this.boss.entityId,
          newPhase: i + 1,
          totalPhases: this.boss.phases.length,
          event: phase.onEnter
        });

        if (phase.onEnter) {
          this.executePhaseEvent(phase.onEnter, timeMs);
        }
      }
    }
  }

  private executePhaseEvent(event: BossPhaseEvent, _timeMs: number): void {
    switch (event.type) {
      case 'spawn_minions':
        EventBus.emit('boss-spawn-minions', {
          bossId: this.boss.entityId,
          count: event.params.count ?? 2,
          spriteKey: 'entity_drone',
          hp: 80,
          damage: 5
        });
        break;

      case 'overcharge_turrets':
        EventBus.emit('boss-overcharge-turrets', {
          bossId: this.boss.entityId,
          duration: event.params.duration ?? 10
        });
        break;

      case 'area_denial':
        EventBus.emit('boss-area-denial', {
          bossId: this.boss.entityId,
          damage: event.params.damage ?? 15
        });
        break;

      case 'heal_self':
        const healAmt = Math.round(this.entity.maxHp * (event.params.amount ?? 0.25));
        this.entity.hp = Math.min(this.entity.maxHp, this.entity.hp + healAmt);
        EventBus.emit('entity-damaged', {
          entityId: this.boss.entityId,
          damage: -healAmt, // Negative damage is heal
          hp: this.entity.hp
        });
        break;

      case 'enrage':
        // Permanently sets a red glow or visual highlight
        EventBus.emit('boss-ability-used', {
          bossId: this.boss.entityId,
          abilityId: 'enrage',
          description: `${this.boss.name} has ENRAGED! Damage and speed drastically increased!`
        });
        break;

      case 'lockdown':
        EventBus.emit('boss-lockdown', {
          bossId: this.boss.entityId,
          duration: event.params.duration ?? 3
        });
        break;
    }
  }

  private checkAbilities(timeMs: number, targets: EntitySprite[]): void {
    for (const ability of this.boss.abilities) {
      const nextTime = this.abilityCooldowns.get(ability.id) ?? 0;
      if (timeMs >= nextTime) {
        // Find if any targets in range
        const targetsInRange = targets.filter(t => {
          const dx = Math.abs(t.currentGridX - this.entity.currentGridX);
          const dy = Math.abs(t.currentGridY - this.entity.currentGridY);
          return Math.max(dx, dy) <= ability.range;
        });

        if (targetsInRange.length > 0) {
          // Cast ability! Target the first one or random one in range
          const target = targetsInRange[0];
          this.abilityCooldowns.set(ability.id, timeMs + (ability.cooldownSeconds * 1000));
          this.castAbility(ability, target);
        }
      }
    }
  }

  private castAbility(ability: BossAbility, target: EntitySprite): void {
    console.log(`[BossAI] ${this.boss.name} used ability: ${ability.id} on ${target.name}`);
    
    if (ability.damage && ability.damage > 0) {
      applyDamage(target, ability.damage, target.entityId);
    }

    EventBus.emit('boss-ability-used', {
      bossId: this.boss.entityId,
      abilityId: ability.id,
      targetGridX: target.currentGridX,
      targetGridY: target.currentGridY,
      targetEntityId: target.entityId,
      damageDealt: ability.damage ?? 0,
      stunSeconds: ability.stunSeconds ?? 0,
      description: ability.description
    });
  }

  private attack(target: EntitySprite, timeMs: number, damage: number): void {
    applyDamage(target, damage, target.entityId);

    EventBus.emit('boss-attacked', {
      bossId: this.boss.entityId,
      targetId: target.entityId,
      damage: damage,
      bossGridX: this.entity.currentGridX,
      bossGridY: this.entity.currentGridY,
      targetGridX: target.currentGridX,
      targetGridY: target.currentGridY
    });
  }

  private moveTowards(target: EntitySprite): void {
    // Pathfind to adjacent walkable tile of target using GridSystem
    const path = this.gridSystem.findPathToAdjacent(
      this.entity.currentGridX,
      this.entity.currentGridY,
      target.currentGridX,
      target.currentGridY
    );

    if (path && path.length > 0) {
      // Get RaidScene rotation and offsets
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scene = this.entity.scene as any;
      const currentRotation = scene.currentRotation ?? 0;
      const offsetX = scene.offsetX ?? 0;
      const offsetY = scene.offsetY ?? 0;
      
      // Move 1 tile or follow path
      // Slice to move only the next tile in the path for staggered step-by-step movement
      const nextStep = path.slice(0, 1);
      
      this.entity.walkPath(nextStep, offsetX, offsetY, currentRotation);
    }
  }

  public getCurrentStats() {
    let speed = this.boss.speed;
    let damage = this.boss.damage;
    let attackRate = this.boss.attackRate;
    const attackRange = this.boss.attackRange;

    // Apply cumulative multipliers from active phases
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
