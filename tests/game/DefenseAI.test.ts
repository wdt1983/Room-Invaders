import { describe, it, expect, vi, beforeEach } from "vitest";
import { TurretAI } from "@/game/systems/DefenseAI";
import { EventBus } from "@/game/EventBus";
import { usePlayerStore, DEFAULT_ACTIVE_EFFECTS } from "@/lib/store/usePlayerStore";
import { useRaidStore } from "@/lib/store/useRaidStore";

describe("DefenseAI / TurretAI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePlayerStore.setState({ activeEffects: { ...DEFAULT_ACTIVE_EFFECTS } });
    useRaidStore.setState({ activeEvent: null });
  });

  const createMockSprite = (x: number, y: number, key: string) => ({
    hp: null,
    maxHp: null,
    gridX: x,
    gridY: y,
    texture: { key },
  });

  it("should register turrets successfully with default stats", () => {
    const system = new TurretAI();
    const sprite = createMockSprite(3, 3, "turret_nailgun");
    
    const registered = system.registerTurret({
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      sprite,
    });

    expect(registered).toBe(true);
    expect(system.hasTurretAt(3, 3)).toBe(true);
    expect(system.registeredCount()).toBe(1);

    const turret = system.getTurret(3, 3);
    expect(turret.ammoRemaining).toBe(15); // Nailgun default ammo is 15
    
    system.destroy();
  });

  it("should warn and fail to register turret with unknown sprite key", () => {
    const system = new TurretAI();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sprite = createMockSprite(3, 3, "unknown_turret");
    
    const registered = system.registerTurret({
      gridX: 3,
      gridY: 3,
      spriteKey: "unknown_turret",
      sprite,
    });

    expect(registered).toBe(false);
    expect(system.hasTurretAt(3, 3)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();

    system.destroy();
  });

  it("should fire at target inside Chebyshev range immediately and respect fire rate cooldowns", () => {
    const target = {
      entityId: "squad-1",
      currentGridX: 5,
      currentGridY: 5,
      hp: 100,
      maxHp: 100,
    };
    const system = new TurretAI(target);
    const sprite = createMockSprite(3, 3, "turret_nailgun");
    system.registerTurret({
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      sprite,
    });

    const emitSpy = vi.spyOn(EventBus, "emit");

    // 1. Tick at t = 1000ms. Since lastFiredAtMs is -Infinity, it should fire immediately.
    system.tick(1000);

    // Nailgun damage is 8, so target HP should be 92
    expect(target.hp).toBe(92);
    expect(emitSpy).toHaveBeenCalledWith("entity-damaged", {
      entityId: "squad-1",
      hp: 92,
      maxHp: 100,
      amount: 8,
    });

    expect(emitSpy).toHaveBeenCalledWith("turret-fired", {
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      targetEntityId: "squad-1",
      targetGridX: 5,
      targetGridY: 5,
      damageDealt: 8,
      stunSeconds: 0,
      ammoRemaining: 14,
      exhausted: false,
      alerted: false,
    });

    emitSpy.mockClear();

    // 2. Tick at t = 1500ms. Fire rate is 1.0s, so it should NOT fire.
    system.tick(1500);
    expect(target.hp).toBe(92);
    expect(emitSpy).not.toHaveBeenCalled();

    // 3. Tick at t = 2100ms. 1100ms elapsed since first shot, which is >= fire_rate (1000ms). Should fire again.
    system.tick(2100);
    expect(target.hp).toBe(84);
    expect(emitSpy).toHaveBeenCalledWith("turret-fired", {
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      targetEntityId: "squad-1",
      targetGridX: 5,
      targetGridY: 5,
      damageDealt: 8,
      stunSeconds: 0,
      ammoRemaining: 13,
      exhausted: false,
      alerted: false,
    });

    system.destroy();
  });

  it("should respect Chebyshev range limits and ignore targets that are too far or on the same tile", () => {
    const target = {
      entityId: "squad-1",
      currentGridX: 7, // distance is max(|7-3|, |3-3|) = 4. Default range is 3.
      currentGridY: 3,
      hp: 100,
      maxHp: 100,
    };
    const system = new TurretAI(target);
    const sprite = createMockSprite(3, 3, "turret_nailgun");
    system.registerTurret({
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      sprite,
    });

    // Tick: Target is out of range, should not fire.
    system.tick(1000);
    expect(target.hp).toBe(100);

    // Move target to same tile as turret (distance 0)
    target.currentGridX = 3;
    target.currentGridY = 3;
    system.tick(2000);
    expect(target.hp).toBe(100); // Should not fire on same tile

    // Move target to distance 3 (in range)
    target.currentGridX = 6;
    system.tick(3000);
    expect(target.hp).toBe(92); // Fires successfully

    system.destroy();
  });

  it("should exhaust ammo, emit defense-destroyed and clean up the turret", () => {
    const target = {
      entityId: "squad-1",
      currentGridX: 4,
      currentGridY: 4,
      hp: 100,
      maxHp: 100,
    };
    const system = new TurretAI(target);
    const sprite = createMockSprite(3, 3, "turret_nailgun");
    
    // Override nailgun stats to only have 1 ammo
    system.registerTurret({
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      sprite,
      stats: { damage: 8, range: 3, fire_rate: 1.0, ammo: 1 },
    });

    const emitSpy = vi.spyOn(EventBus, "emit");

    system.tick(1000);

    expect(target.hp).toBe(92);
    expect(emitSpy).toHaveBeenCalledWith("turret-fired", expect.objectContaining({
      ammoRemaining: 0,
      exhausted: true,
    }));

    expect(emitSpy).toHaveBeenCalledWith("defense-destroyed", {
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      maxHp: null,
    });

    expect(system.hasTurretAt(3, 3)).toBe(false); // Removed on exhaustion

    system.destroy();
  });

  it("should increase range when alerted by a tripwire alarm", () => {
    const target = {
      entityId: "squad-1",
      currentGridX: 7, // distance is 4. Range is 3. Out of range initially.
      currentGridY: 3,
      hp: 100,
      maxHp: 100,
    };
    const system = new TurretAI(target);
    const sprite = createMockSprite(3, 3, "turret_nailgun");
    system.registerTurret({
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      sprite,
    });

    // 1. Tick: Target is out of range, should not fire.
    system.tick(1000);
    expect(target.hp).toBe(100);

    // 2. Alert the turret by triggering tripwire at (6, 3) with alertRadius 4
    // distance from turret (3, 3) to tripwire (6, 3) is 3 <= 4, so it wakes up
    EventBus.emit("trap-triggered", {
      gridX: 6,
      gridY: 3,
      alertRadius: 4,
    });

    // 3. Tick: Now alerted, effective range is 3 + 1 = 4. Target at distance 4 should get shot!
    const emitSpy = vi.spyOn(EventBus, "emit");
    system.tick(2000);

    expect(target.hp).toBe(92);
    expect(emitSpy).toHaveBeenCalledWith("turret-fired", expect.objectContaining({
      alerted: true,
    }));

    system.destroy();
  });

  it("should apply turretAmmoMult and turretRangeBonus upgrades from player store", () => {
    usePlayerStore.setState({
      activeEffects: {
        ...DEFAULT_ACTIVE_EFFECTS,
        turretAmmoMult: 2.0,
        turretRangeBonus: 2,
      },
    });

    const target = {
      entityId: "squad-1",
      currentGridX: 8, // distance is 5. Default nailgun range is 3. With +2 bonus, effective range is 5.
      currentGridY: 3,
      hp: 100,
      maxHp: 100,
    };
    const system = new TurretAI(target);
    const sprite = createMockSprite(3, 3, "turret_nailgun");
    system.registerTurret({
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      sprite,
    });

    const turret = system.getTurret(3, 3);
    expect(turret.ammoRemaining).toBe(30); // 15 * 2.0 = 30 ammo

    // Target at distance 5 should be shot
    system.tick(1000);
    expect(target.hp).toBe(92);

    system.destroy();
  });

  it("should apply sector_blackout event penalty", () => {
    // Inject blackout event
    useRaidStore.setState({
      activeEvent: {
        eventType: "sector_blackout",
      },
    });

    const target = {
      entityId: "squad-1",
      currentGridX: 6, // distance is 3. Normal range is 3. With blackout (-1), effective range is 2. Target out of range.
      currentGridY: 3,
      hp: 100,
      maxHp: 100,
    };
    const system = new TurretAI(target);
    const sprite = createMockSprite(3, 3, "turret_nailgun");
    system.registerTurret({
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      sprite,
    });

    system.tick(1000);
    expect(target.hp).toBe(100); // Blackout prevented shot

    // Move target closer (distance 2)
    target.currentGridX = 5;
    system.tick(2000);
    expect(target.hp).toBe(92); // Fires within reduced range

    system.destroy();
  });

  it("should apply turret_malfunction jam events", () => {
    // Inject malfunction event
    useRaidStore.setState({
      activeEvent: {
        eventType: "turret_malfunction",
        parameters: { turret_jam_chance: 1.0 }, // Force jam 100%
      },
    });

    const target = {
      entityId: "squad-1",
      currentGridX: 5,
      currentGridY: 3,
      hp: 100,
      maxHp: 100,
    };
    const system = new TurretAI(target);
    const sprite = createMockSprite(3, 3, "turret_nailgun");
    system.registerTurret({
      gridX: 3,
      gridY: 3,
      spriteKey: "turret_nailgun",
      sprite,
    });

    const emitSpy = vi.spyOn(EventBus, "emit");

    // Force random jam check
    system.tick(1000);

    expect(target.hp).toBe(100); // Target not damaged due to jam
    expect(emitSpy).toHaveBeenCalledWith("turret-jammed", {
      gridX: 3,
      gridY: 3,
    });

    system.destroy();
  });
});
