import { describe, it, expect, vi, beforeEach } from "vitest";
import { BossAI } from "@/game/systems/BossAI";
import { GridSystem } from "@/game/systems/GridSystem";
import { EventBus } from "@/game/EventBus";
import type { BossDefinition } from "@/game/fixtures/boss-rooms";

describe("BossAI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createMockTarget = (id: string, x: number, y: number, hp = 100) => ({
    entityId: id,
    name: "Squad Member " + id,
    currentGridX: x,
    currentGridY: y,
    hp,
    maxHp: 100,
  });

  const createMockBossEntity = (x: number, y: number, hp = 200, maxHp = 200) => ({
    hp,
    maxHp,
    currentGridX: x,
    currentGridY: y,
    scene: {
      currentRotation: 0,
      offsetX: 10,
      offsetY: 20,
    },
    walkPath: vi.fn(),
  });

  const getTestBossDefinition = (): BossDefinition => ({
    entityId: "boss-test",
    name: "Test Boss",
    title: "The Ultimate Test",
    spriteKey: "boss_test",
    hp: 200,
    maxHp: 200,
    speed: 1.0,
    damage: 20,
    attackRate: 1.0,
    attackRange: 2,
    phases: [
      { hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 },
      // Phase 2 at 50% HP
      { 
        hpThreshold: 0.5, 
        speedMultiplier: 2.0, 
        damageMultiplier: 1.5, 
        attackRateMultiplier: 0.5, 
        onEnter: { type: "enrage", params: { amount: 1 } },
      },
    ],
    abilities: [
      {
        id: "scrap-toss",
        cooldownSeconds: 5,
        range: 4,
        damage: 15,
        stunSeconds: 1.0,
        description: "Tosses heavy scrap!",
      },
    ],
    spawnTile: { x: 5, y: 5 },
  });

  it("should initialize correct default properties", () => {
    const bossDef = getTestBossDefinition();
    const entity = createMockBossEntity(5, 5);
    const grid = new GridSystem(10);
    const ai = new BossAI(bossDef, entity as any, grid);

    const stats = ai.getCurrentStats();
    expect(stats.speed).toBe(1.0);
    expect(stats.damage).toBe(20);
    expect(stats.attackRate).toBe(1.0);
    expect(stats.attackRange).toBe(2);

    ai.destroy();
  });

  it("should trigger phase transition, update stats, and emit enrage phase events on HP drop", () => {
    const bossDef = getTestBossDefinition();
    // Start with 50% HP (100 / 200) to trigger Phase 2
    const entity = createMockBossEntity(5, 5, 100, 200);
    const grid = new GridSystem(10);
    const ai = new BossAI(bossDef, entity as any, grid);
    
    const emitSpy = vi.spyOn(EventBus, "emit");

    // Tick the AI to trigger checkPhaseTransition
    const target = createMockTarget("squad-1", 5, 5);
    ai.tick(1000, [target as any]);

    // Check stats are multiplied by Phase 2 multipliers: speed = 1.0 * 2.0 = 2.0, damage = 20 * 1.5 = 30, attackRate = 1.0 * 0.5 = 0.5
    const stats = ai.getCurrentStats();
    expect(stats.speed).toBe(2.0);
    expect(stats.damage).toBe(30);
    expect(stats.attackRate).toBe(0.5);

    // Verify boss-phase-changed was emitted
    expect(emitSpy).toHaveBeenCalledWith("boss-phase-changed", {
      bossId: "boss-test",
      newPhase: 2,
      totalPhases: 2,
      event: { type: "enrage", params: { amount: 1 } },
    });

    // Verify enrage phase enter event was executed and emitted boss-ability-used
    expect(emitSpy).toHaveBeenCalledWith("boss-ability-used", {
      bossId: "boss-test",
      abilityId: "enrage",
      description: "Test Boss has ENRAGED! Damage and speed drastically increased!",
    });

    ai.destroy();
  });

  it("should execute heal_self phase event and update boss HP", () => {
    const bossDef = getTestBossDefinition();
    // Set Phase 2 event to 'heal_self'
    bossDef.phases[1].onEnter = { type: "heal_self", params: { amount: 0.25 } };

    const entity = createMockBossEntity(5, 5, 100, 200); // 50% HP
    const grid = new GridSystem(10);
    const ai = new BossAI(bossDef, entity as any, grid);
    
    const emitSpy = vi.spyOn(EventBus, "emit");

    const target = createMockTarget("squad-1", 5, 5);
    ai.tick(1000, [target as any]);

    // Boss should heal self: maxHp (200) * 0.25 = 50. HP becomes 100 + 50 = 150.
    expect(entity.hp).toBe(150);

    expect(emitSpy).toHaveBeenCalledWith("entity-damaged", {
      entityId: "boss-test",
      damage: -50,
      hp: 150,
    });

    ai.destroy();
  });

  it("should execute other enter phase events (spawn_minions, area_denial, lockdown, overcharge_turrets)", () => {
    const bossDef = getTestBossDefinition();
    const grid = new GridSystem(10);

    // 1. spawn_minions
    bossDef.phases[1].onEnter = { type: "spawn_minions", params: { count: 3 } };
    let entity = createMockBossEntity(5, 5, 100, 200);
    let ai = new BossAI(bossDef, entity as any, grid);
    let emitSpy = vi.spyOn(EventBus, "emit");
    ai.tick(1000, [createMockTarget("squad-1", 5, 5) as any]);
    expect(emitSpy).toHaveBeenCalledWith("boss-spawn-minions", {
      bossId: "boss-test",
      count: 3,
      spriteKey: "entity_drone",
      hp: 80,
      damage: 5,
    });
    ai.destroy();

    // 2. overcharge_turrets
    bossDef.phases[1].onEnter = { type: "overcharge_turrets", params: { duration: 12 } };
    entity = createMockBossEntity(5, 5, 100, 200);
    ai = new BossAI(bossDef, entity as any, grid);
    emitSpy = vi.spyOn(EventBus, "emit");
    ai.tick(1000, [createMockTarget("squad-1", 5, 5) as any]);
    expect(emitSpy).toHaveBeenCalledWith("boss-overcharge-turrets", {
      bossId: "boss-test",
      duration: 12,
    });
    ai.destroy();

    // 3. area_denial
    bossDef.phases[1].onEnter = { type: "area_denial", params: { damage: 25 } };
    entity = createMockBossEntity(5, 5, 100, 200);
    ai = new BossAI(bossDef, entity as any, grid);
    emitSpy = vi.spyOn(EventBus, "emit");
    ai.tick(1000, [createMockTarget("squad-1", 5, 5) as any]);
    expect(emitSpy).toHaveBeenCalledWith("boss-area-denial", {
      bossId: "boss-test",
      damage: 25,
    });
    ai.destroy();

    // 4. lockdown
    bossDef.phases[1].onEnter = { type: "lockdown", params: { duration: 5 } };
    entity = createMockBossEntity(5, 5, 100, 200);
    ai = new BossAI(bossDef, entity as any, grid);
    emitSpy = vi.spyOn(EventBus, "emit");
    ai.tick(1000, [createMockTarget("squad-1", 5, 5) as any]);
    expect(emitSpy).toHaveBeenCalledWith("boss-lockdown", {
      bossId: "boss-test",
      duration: 5,
    });
    ai.destroy();
  });

  it("should cast special abilities when target is in range and respect cooldowns", () => {
    const bossDef = getTestBossDefinition();
    const entity = createMockBossEntity(5, 5);
    const grid = new GridSystem(10);
    const ai = new BossAI(bossDef, entity as any, grid);

    // Target is at (5, 8). Chebyshev distance is max(|5-5|, |8-5|) = 3.
    // "scrap-toss" range is 4, damage is 15, cooldown is 5s. Target is in range.
    const target = createMockTarget("squad-1", 5, 8);
    const emitSpy = vi.spyOn(EventBus, "emit");

    // 1. Tick at t = 1000ms: should cast ability immediately
    ai.tick(1000, [target as any]);

    expect(target.hp).toBe(85); // takes 15 damage
    expect(emitSpy).toHaveBeenCalledWith("boss-ability-used", {
      bossId: "boss-test",
      abilityId: "scrap-toss",
      targetGridX: 5,
      targetGridY: 8,
      targetEntityId: "squad-1",
      damageDealt: 15,
      stunSeconds: 1.0,
      description: "Tosses heavy scrap!",
    });

    emitSpy.mockClear();

    // 2. Tick at t = 3000ms: should NOT cast since 5s cooldown is active (expires at 1000 + 5000 = 6000ms)
    ai.tick(3000, [target as any]);
    expect(target.hp).toBe(85);
    expect(emitSpy).not.toHaveBeenCalledWith("boss-ability-used", expect.any(Object));

    // 3. Tick at t = 7000ms: cooldown expired, should cast again!
    ai.tick(7000, [target as any]);
    expect(target.hp).toBe(70);
    expect(emitSpy).toHaveBeenCalledWith("boss-ability-used", expect.objectContaining({
      abilityId: "scrap-toss",
    }));

    ai.destroy();
  });

  it("should perform basic attacks when targets are inside attackRange and respect attack cooldown", () => {
    const bossDef = getTestBossDefinition();
    // Remove abilities to prevent overlaps
    bossDef.abilities = [];

    const entity = createMockBossEntity(5, 5);
    const grid = new GridSystem(10);
    const ai = new BossAI(bossDef, entity as any, grid);

    const target = createMockTarget("squad-1", 5, 7);
    const emitSpy = vi.spyOn(EventBus, "emit");

    // Tick 1: t = 1000. Fires basic attack (20 dmg)
    ai.tick(1000, [target as any]);
    expect(target.hp).toBe(80);
    expect(emitSpy).toHaveBeenCalledWith("boss-attacked", {
      bossId: "boss-test",
      targetId: "squad-1",
      damage: 20,
      bossGridX: 5,
      bossGridY: 5,
      targetGridX: 5,
      targetGridY: 7,
    });

    emitSpy.mockClear();

    // Tick 2: t = 2000. Basic attack cooldown is 1.0s and ready! Fires basic attack (20 dmg)
    ai.tick(2000, [target as any]);
    expect(target.hp).toBe(60);

    emitSpy.mockClear();

    // Tick 3: t = 2500. Attack rate is 1.0s. Ticking 500ms later should NOT attack.
    ai.tick(2500, [target as any]);
    expect(target.hp).toBe(60);
    expect(emitSpy).not.toHaveBeenCalled();

    // Tick 4: t = 3100. Cooldown expired (1100ms since last attack). Should attack again!
    ai.tick(3100, [target as any]);
    expect(target.hp).toBe(40);

    ai.destroy();
  });

  it("should move towards target when target is outside attackRange and speed > 0, throttling pathfinding to 1.5s", () => {
    const bossDef = getTestBossDefinition();
    const entity = createMockBossEntity(5, 5);
    const grid = new GridSystem(10);
    const ai = new BossAI(bossDef, entity as any, grid);

    // To ensure boss only moves and doesn't cast scrap-toss, remove scrap-toss from abilities:
    bossDef.abilities = [];

    const target = createMockTarget("squad-1", 5, 9);

    // 1. Tick at t = 2000ms: first pathfind tick (elapsed 2000ms >= 1500ms throttle), should search path and move
    ai.tick(2000, [target as any]);

    // GridSystem.findPathToAdjacent from (5,5) to (5,9) will return a path ending adjacent to (5,9).
    // The next step should be (5,5) since the path includes the start tile.
    expect(entity.walkPath).toHaveBeenCalledWith(
      [{ x: 5, y: 5 }],
      10,
      20,
      0
    );

    entity.walkPath.mockClear();

    // 2. Tick at t = 3000ms: 1000ms later, which is < 1500ms throttle since last pathfind (t=2000ms). Should NOT pathfind again.
    ai.tick(3000, [target as any]);
    expect(entity.walkPath).not.toHaveBeenCalled();

    // 3. Tick at t = 3600ms: 1600ms later (>= 1500ms throttle since t=2000ms). Should pathfind again!
    ai.tick(3600, [target as any]);
    expect(entity.walkPath).toHaveBeenCalled();

    ai.destroy();
  });
});
