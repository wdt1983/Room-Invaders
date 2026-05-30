// tests/game/ReplayValidator.test.ts

import { describe, it, expect } from "vitest";
import { validateReplay } from "../../supabase/functions/resolve-raid/replay/replayValidator";

// Legitimate mock action log for a walkthrough in Abandoned Apartment
// North entry point at pos 5 spawns at (5, 1). Stash at (8, 8).
// Trap pressure plate at (5,2) is triggered. Trap tripwire at (4, 4) is skipped by walking:
// (5,1) -> (5,2) -> (5,3) -> (5,4) -> (6,4) -> (7,4) -> (8,4) -> (8,5) -> (8,6) -> (8,7) -> (8,8)
const LEGITIMATE_WALKTHROUGH = [
  { t: 0.0, type: "spawn", data: { gridX: 5, gridY: 1 } },
  { t: 1.0, type: "move", data: { gridX: 5, gridY: 2 } }, // steps on pressure plate (5,2) -> deals 15 damage
  { t: 2.0, type: "move", data: { gridX: 5, gridY: 3 } },
  { t: 3.0, type: "move", data: { gridX: 5, gridY: 4 } },
  { t: 4.0, type: "move", data: { gridX: 6, gridY: 4 } },
  { t: 5.0, type: "move", data: { gridX: 7, gridY: 4 } },
  { t: 6.0, type: "move", data: { gridX: 8, gridY: 4 } },
  { t: 7.0, type: "move", data: { gridX: 8, gridY: 5 } },
  { t: 8.0, type: "move", data: { gridX: 8, gridY: 6 } },
  { t: 9.0, type: "move", data: { gridX: 8, gridY: 7 } },
  { t: 10.0, type: "move", data: { gridX: 8, gridY: 8 } }, // reaches stash!
  { t: 13.0, type: "stash_entered", data: { gridX: 8, gridY: 8 } },
  { t: 16.0, type: "stash_secured", data: { gridX: 8, gridY: 8 } },
];

describe("Authoritative Replay Validator Suite", () => {
  it("should validate a legitimate walkthrough successfully and record damage", async () => {
    const result = await validateReplay({
      fixtureId: "tier1-abandoned-apartment",
      outcome: "victory",
      secondsElapsed: 16,
      squadHp: 85, // 100 max - 15 plate trap dmg = 85
      squadMaxHp: 100,
      actionLog: LEGITIMATE_WALKTHROUGH,
      isPvP: true, // Use PvP to inject custom mock items
      gridSize: 10,
      entryPoints: [{ wall: 'north', type: 'door', position: 5 }],
      placedItems: [
        { spriteKey: 'trap_pressure_plate', gridX: 5, gridY: 2, type: 'trap' }
      ],
      unlockedTechs: [],
    });

    expect(result.success).toBe(true);
    expect(result.simulatedSquadHp).toBe(85);
  });

  it("should catch and reject teleportation exploits", async () => {
    // Teleports from (5,2) to (8,8) instantly
    const teleportLog = [
      { t: 0.0, type: "spawn", data: { gridX: 5, gridY: 1 } },
      { t: 1.0, type: "move", data: { gridX: 5, gridY: 2 } },
      { t: 2.0, type: "move", data: { gridX: 8, gridY: 8 } },
      { t: 5.0, type: "stash_secured" },
    ];

    const result = await validateReplay({
      fixtureId: "tier1-abandoned-apartment",
      outcome: "victory",
      secondsElapsed: 5,
      squadHp: 100,
      squadMaxHp: 100,
      actionLog: teleportLog,
      isPvP: true,
      gridSize: 10,
      entryPoints: [{ wall: 'north', type: 'door', position: 5 }],
      placedItems: [],
      unlockedTechs: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Teleportation hack detected");
  });

  it("should catch and reject walking through physical obstacles (furniture/barricades)", async () => {
    // Try to step on (8,1) which contains "furniture_shelf_metal"
    const wallHackLog = [
      { t: 0.0, type: "spawn", data: { gridX: 5, gridY: 1 } },
      { t: 1.0, type: "move", data: { gridX: 6, gridY: 1 } },
      { t: 2.0, type: "move", data: { gridX: 7, gridY: 1 } },
      { t: 3.0, type: "move", data: { gridX: 8, gridY: 1 } }, // shelf!
    ];

    const result = await validateReplay({
      fixtureId: "tier1-abandoned-apartment",
      outcome: "victory",
      secondsElapsed: 4,
      squadHp: 100,
      squadMaxHp: 100,
      actionLog: wallHackLog,
      isPvP: true,
      gridSize: 10,
      entryPoints: [{ wall: 'north', type: 'door', position: 5 }],
      placedItems: [
        { spriteKey: 'furniture_shelf_metal', gridX: 8, gridY: 1, type: 'furniture' }
      ],
      unlockedTechs: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("occupied by physical obstacle");
  });

  it("should catch and reject HP-modification exploits", async () => {
    // Steps on pressure plate (5,2) but client claims they survived with 100 HP
    const result = await validateReplay({
      fixtureId: "tier1-abandoned-apartment",
      outcome: "victory",
      secondsElapsed: 16,
      squadHp: 100, // Claimed 100 instead of simulated 85!
      squadMaxHp: 100,
      actionLog: LEGITIMATE_WALKTHROUGH,
      isPvP: true,
      gridSize: 10,
      entryPoints: [{ wall: 'north', type: 'door', position: 5 }],
      placedItems: [
        { spriteKey: 'trap_pressure_plate', gridX: 5, gridY: 2, type: 'trap' }
      ],
      unlockedTechs: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("HP modification exploit detected");
  });

  it("should catch and reject boss victory claims where the boss is still alive", async () => {
    // Squad spawns at (5,1) but secures stash without defeating the boss
    const skipBossLog = [
      { t: 0.0, type: "spawn", data: { gridX: 5, gridY: 1 } },
      { t: 1.0, type: "move", data: { gridX: 5, gridY: 2 } },
      { t: 2.0, type: "move", data: { gridX: 5, gridY: 3 } },
      { t: 3.0, type: "move", data: { gridX: 5, gridY: 4 } },
      { t: 4.0, type: "move", data: { gridX: 5, gridY: 5 } },
      { t: 5.0, type: "move", data: { gridX: 5, gridY: 6 } },
      { t: 6.0, type: "move", data: { gridX: 6, gridY: 6 } },
      { t: 7.0, type: "move", data: { gridX: 7, gridY: 6 } },
      { t: 8.0, type: "move", data: { gridX: 8, gridY: 6 } },
      { t: 9.0, type: "move", data: { gridX: 8, gridY: 7 } },
      { t: 10.0, type: "move", data: { gridX: 8, gridY: 8 } },
      { t: 13.0, type: "stash_secured" },
    ];

    const result = await validateReplay({
      fixtureId: "boss-ironjaw",
      outcome: "victory",
      secondsElapsed: 13,
      squadHp: 9773, // Set to match simulated HP to bypass HP-exploit check
      squadMaxHp: 10000,
      actionLog: skipBossLog,
      isPvP: false, // Standard boss fixture
      unlockedTechs: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("boss was never fully defeated");
  });
});
