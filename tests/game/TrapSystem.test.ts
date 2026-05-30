import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrapSystem } from "@/game/systems/TrapSystem";
import { EventBus } from "@/game/EventBus";
import { usePlayerStore, DEFAULT_ACTIVE_EFFECTS } from "@/lib/store/usePlayerStore";

describe("TrapSystem", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePlayerStore.setState({ activeEffects: { ...DEFAULT_ACTIVE_EFFECTS } });
  });

  const createMockSprite = (x: number, y: number, key: string) => ({
    hp: null,
    maxHp: null,
    gridX: x,
    gridY: y,
    texture: { key },
  });

  it("should register traps successfully with default stats", () => {
    const target = { entityId: "squad-1", hp: 100, maxHp: 100 };
    const system = new TrapSystem(target);
    
    const sprite = createMockSprite(2, 3, "trap_spike_strip");
    const registered = system.registerTrap({
      gridX: 2,
      gridY: 3,
      spriteKey: "trap_spike_strip",
      sprite,
    });

    expect(registered).toBe(true);
    expect(system.hasTrapAt(2, 3)).toBe(true);
    expect(system.registeredCount()).toBe(1);
    
    system.destroy();
  });

  it("should warn and fail to register trap with unknown sprite key", () => {
    const target = { entityId: "squad-1", hp: 100, maxHp: 100 };
    const system = new TrapSystem(target);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    const sprite = createMockSprite(2, 3, "unknown_trap");
    const registered = system.registerTrap({
      gridX: 2,
      gridY: 3,
      spriteKey: "unknown_trap",
      sprite,
    });

    expect(registered).toBe(false);
    expect(system.hasTrapAt(2, 3)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    
    system.destroy();
  });

  it("should trigger step-on trap, apply damage, and emit events", () => {
    const target = { entityId: "squad-1", hp: 100, maxHp: 100 };
    const system = new TrapSystem(target);
    const emitSpy = vi.spyOn(EventBus, "emit");
    
    const sprite = createMockSprite(2, 3, "trap_pressure_plate");
    system.registerTrap({
      gridX: 2,
      gridY: 3,
      spriteKey: "trap_pressure_plate",
      sprite,
    });

    // Step onto trap tile
    EventBus.emit("entity-entered-tile", {
      entityId: "squad-1",
      x: 2,
      y: 3,
    });

    // Pressure plate does 15 damage, 1 use by default
    expect(target.hp).toBe(85);
    expect(emitSpy).toHaveBeenCalledWith("entity-damaged", {
      entityId: "squad-1",
      hp: 85,
      maxHp: 100,
      amount: 15,
    });

    expect(emitSpy).toHaveBeenCalledWith("trap-triggered", {
      gridX: 2,
      gridY: 3,
      spriteKey: "trap_pressure_plate",
      entityId: "squad-1",
      damageDealt: 15,
      stunSeconds: 0,
      immobilizeSeconds: 0,
      alertRadius: 0,
      slow: 0,
      usesRemaining: 0,
      exhausted: true,
    });

    // Should also trigger defense-destroyed because it has 1 use by default
    expect(emitSpy).toHaveBeenCalledWith("defense-destroyed", {
      gridX: 2,
      gridY: 3,
      spriteKey: "trap_pressure_plate",
      maxHp: null,
    });

    expect(system.hasTrapAt(2, 3)).toBe(false); // Trap should be removed from registry on exhaustion
    
    system.destroy();
  });

  it("should apply trapDamageMult and trapStunBonus upgrades from player store", () => {
    // Inject player upgrades
    usePlayerStore.setState({
      activeEffects: {
        ...DEFAULT_ACTIVE_EFFECTS,
        trapDamageMult: 1.5,
        trapStunBonus: 2.0,
      },
    });

    const target = { entityId: "squad-1", hp: 100, maxHp: 100 };
    const system = new TrapSystem(target);
    const emitSpy = vi.spyOn(EventBus, "emit");
    
    const sprite = createMockSprite(4, 5, "trap_shock_pad");
    system.registerTrap({
      gridX: 4,
      gridY: 5,
      spriteKey: "trap_shock_pad",
      sprite,
    });

    EventBus.emit("entity-entered-tile", {
      entityId: "squad-1",
      x: 4,
      y: 5,
    });

    // Default shock pad: damage = 12, stun = 1.8. With upgrades: damage = 12 * 1.5 = 18, stun = 1.8 + 2.0 = 3.8
    expect(target.hp).toBe(82);
    expect(emitSpy).toHaveBeenCalledWith("trap-triggered", {
      gridX: 4,
      gridY: 5,
      spriteKey: "trap_shock_pad",
      entityId: "squad-1",
      damageDealt: 18,
      stunSeconds: 3.8,
      immobilizeSeconds: 0,
      alertRadius: 0,
      slow: 0,
      usesRemaining: 0,
      exhausted: true,
    });
    
    system.destroy();
  });

  it("should apply trapUsesBonus upgrades from player store", () => {
    usePlayerStore.setState({
      activeEffects: {
        ...DEFAULT_ACTIVE_EFFECTS,
        trapUsesBonus: 2,
      },
    });

    const target = { entityId: "squad-1", hp: 100, maxHp: 100 };
    const system = new TrapSystem(target);
    const emitSpy = vi.spyOn(EventBus, "emit");
    
    const sprite = createMockSprite(1, 1, "trap_pressure_plate");
    system.registerTrap({
      gridX: 1,
      gridY: 1,
      spriteKey: "trap_pressure_plate",
      sprite,
    });

    // Trigger 1
    EventBus.emit("entity-entered-tile", { entityId: "squad-1", x: 1, y: 1 });
    expect(target.hp).toBe(85);
    expect(system.hasTrapAt(1, 1)).toBe(true); // Should still be active because uses = 1 + 2 = 3

    // Trigger 2
    EventBus.emit("entity-entered-tile", { entityId: "squad-1", x: 1, y: 1 });
    expect(target.hp).toBe(70);
    expect(system.hasTrapAt(1, 1)).toBe(true);

    // Trigger 3
    EventBus.emit("entity-entered-tile", { entityId: "squad-1", x: 1, y: 1 });
    expect(target.hp).toBe(55);
    expect(system.hasTrapAt(1, 1)).toBe(false); // Cleaned up now
    expect(emitSpy).toHaveBeenCalledWith("defense-destroyed", {
      gridX: 1,
      gridY: 1,
      spriteKey: "trap_pressure_plate",
      maxHp: null,
    });
    
    system.destroy();
  });

  it("should trigger alert radius on tripwire-style traps", () => {
    const target = { entityId: "squad-1", hp: 100, maxHp: 100 };
    const system = new TrapSystem(target);
    const emitSpy = vi.spyOn(EventBus, "emit");
    
    const sprite = createMockSprite(5, 5, "trap_tripwire_alarm");
    system.registerTrap({
      gridX: 5,
      gridY: 5,
      spriteKey: "trap_tripwire_alarm",
      sprite,
    });

    EventBus.emit("entity-entered-tile", { entityId: "squad-1", x: 5, y: 5 });

    expect(target.hp).toBe(100); // 0 damage by default
    expect(emitSpy).toHaveBeenCalledWith("trap-triggered", {
      gridX: 5,
      gridY: 5,
      spriteKey: "trap_tripwire_alarm",
      entityId: "squad-1",
      damageDealt: 0,
      stunSeconds: 0,
      immobilizeSeconds: 0,
      alertRadius: 4,
      slow: 0,
      usesRemaining: 0,
      exhausted: true,
    });
    
    system.destroy();
  });

  it("should stop listening and registering after being destroyed", () => {
    const target = { entityId: "squad-1", hp: 100, maxHp: 100 };
    const system = new TrapSystem(target);
    const emitSpy = vi.spyOn(EventBus, "emit");
    
    const sprite = createMockSprite(2, 2, "trap_pressure_plate");
    system.registerTrap({
      gridX: 2,
      gridY: 2,
      spriteKey: "trap_pressure_plate",
      sprite,
    });

    system.destroy();

    // Stepping on tile shouldn't trigger anything after destruction
    EventBus.emit("entity-entered-tile", { entityId: "squad-1", x: 2, y: 2 });
    expect(target.hp).toBe(100);
    expect(emitSpy).not.toHaveBeenCalledWith("trap-triggered", expect.any(Object));
  });
});
