import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyDamage, heal, applyDamageToPlaced } from "@/game/systems/CombatSystem";
import { EventBus } from "@/game/EventBus";

describe("CombatSystem", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should apply damage and update HP", () => {
    const emitSpy = vi.spyOn(EventBus, "emit");
    const target = { hp: 100, maxHp: 100 };
    const result = applyDamage(target, 20, "entity-1");
    
    expect(target.hp).toBe(80);
    expect(result.hp).toBe(80);
    expect(result.dead).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith("entity-damaged", {
      entityId: "entity-1",
      hp: 80,
      maxHp: 100,
      amount: 20,
    });
  });

  it("should ignore negative, zero, and non-finite damage", () => {
    const emitSpy = vi.spyOn(EventBus, "emit");
    const target = { hp: 100, maxHp: 100 };
    
    applyDamage(target, -10, "entity-1");
    expect(target.hp).toBe(100);
    
    applyDamage(target, 0, "entity-1");
    expect(target.hp).toBe(100);

    applyDamage(target, NaN, "entity-1");
    expect(target.hp).toBe(100);

    applyDamage(target, Infinity, "entity-1");
    expect(target.hp).toBe(100);

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("should cross death threshold exactly once and emit entity-killed", () => {
    const emitSpy = vi.spyOn(EventBus, "emit");
    const target = { hp: 30, maxHp: 100 };
    
    const result1 = applyDamage(target, 40, "entity-1");
    expect(target.hp).toBe(0);
    expect(result1.hp).toBe(0);
    expect(result1.dead).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith("entity-damaged", {
      entityId: "entity-1",
      hp: 0,
      maxHp: 100,
      amount: 40,
    });
    expect(emitSpy).toHaveBeenCalledWith("entity-killed", {
      entityId: "entity-1",
      maxHp: 100,
    });

    emitSpy.mockClear();

    const result2 = applyDamage(target, 10, "entity-1");
    expect(target.hp).toBe(0);
    expect(result2.hp).toBe(0);
    expect(result2.dead).toBe(false);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("should heal up to maxHp and emit entity-healed", () => {
    const emitSpy = vi.spyOn(EventBus, "emit");
    const target = { hp: 50, maxHp: 100 };
    
    const hp = heal(target, 30, "entity-1");
    expect(target.hp).toBe(80);
    expect(hp).toBe(80);
    expect(emitSpy).toHaveBeenCalledWith("entity-healed", {
      entityId: "entity-1",
      hp: 80,
      maxHp: 100,
      amount: 30,
    });
  });

  it("should not heal beyond maxHp", () => {
    const emitSpy = vi.spyOn(EventBus, "emit");
    const target = { hp: 90, maxHp: 100 };
    
    const hp = heal(target, 30, "entity-1");
    expect(target.hp).toBe(100);
    expect(hp).toBe(100);
    expect(emitSpy).toHaveBeenCalledWith("entity-healed", {
      entityId: "entity-1",
      hp: 100,
      maxHp: 100,
      amount: 10,
    });
  });

  it("should not revive a dead entity with heal", () => {
    const emitSpy = vi.spyOn(EventBus, "emit");
    const target = { hp: 0, maxHp: 100 };
    
    const hp = heal(target, 20, "entity-1");
    expect(target.hp).toBe(0);
    expect(hp).toBe(0);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("should apply damage to placed items", () => {
    const emitSpy = vi.spyOn(EventBus, "emit");
    const target = {
      hp: 50,
      maxHp: 50,
      gridX: 2,
      gridY: 3,
      texture: { key: "barricade_wood" },
    };
    
    const result = applyDamageToPlaced(target, 20);
    expect(target.hp).toBe(30);
    expect(result.hp).toBe(30);
    expect(result.destroyed).toBe(false);
    expect(result.ignored).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith("defense-damaged", {
      gridX: 2,
      gridY: 3,
      spriteKey: "barricade_wood",
      hp: 30,
      maxHp: 50,
      amount: 20,
    });
  });

  it("should destroy placed items when HP drops to 0", () => {
    const emitSpy = vi.spyOn(EventBus, "emit");
    const target = {
      hp: 20,
      maxHp: 50,
      gridX: 2,
      gridY: 3,
      texture: { key: "barricade_wood" },
    };
    
    const result = applyDamageToPlaced(target, 30);
    expect(target.hp).toBe(0);
    expect(result.hp).toBe(0);
    expect(result.destroyed).toBe(true);
    expect(result.ignored).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith("defense-damaged", {
      gridX: 2,
      gridY: 3,
      spriteKey: "barricade_wood",
      hp: 0,
      maxHp: 50,
      amount: 30,
    });
    expect(emitSpy).toHaveBeenCalledWith("defense-destroyed", {
      gridX: 2,
      gridY: 3,
      spriteKey: "barricade_wood",
      maxHp: 50,
    });
  });

  it("should ignore damage to indestructible placed items", () => {
    const emitSpy = vi.spyOn(EventBus, "emit");
    const target = {
      hp: null,
      maxHp: null,
      gridX: 2,
      gridY: 3,
      texture: { key: "turret_indestructible" },
    };
    
    const result = applyDamageToPlaced(target, 20);
    expect(target.hp).toBeNull();
    expect(result.hp).toBeNull();
    expect(result.destroyed).toBe(false);
    expect(result.ignored).toBe(true);
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
