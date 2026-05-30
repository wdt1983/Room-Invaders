// supabase/functions/resolve-raid/replay/replayValidator.test.ts

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { validateReplay } from "./replayValidator.ts";

// Legitimate mock action log for a walkthrough in Abandoned Apartment
// North entry point at pos 5 spawns at (5, 1). Stash at (8, 8).
// Trap tripwire at (4, 4) is skipped by walking:
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

Deno.test("validateReplay - legitimate easy-raid walkthrough validates successfully", async () => {
  const result = await validateReplay({
    fixtureId: "tier1-abandoned-apartment",
    outcome: "victory",
    secondsElapsed: 16,
    squadHp: 85, // 100 max - 15 plate trap dmg = 85
    squadMaxHp: 100,
    actionLog: LEGITIMATE_WALKTHROUGH,
    isPvP: false,
    unlockedTechs: [],
  });

  assertEquals(result.success, true);
  assertEquals(result.simulatedSquadHp, 85);
});

Deno.test("validateReplay - catches and rejects teleportation hacks", async () => {
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
    squadHp: 85,
    squadMaxHp: 100,
    actionLog: teleportLog,
    isPvP: false,
    unlockedTechs: [],
  });

  assertEquals(result.success, false);
  assertEquals(result.error?.includes("Teleportation hack detected"), true);
});

Deno.test("validateReplay - catches and rejects walking through physical obstacles", async () => {
  // Try to step on (8,1) which contains "furniture_shelf_metal"
  const wallHackLog = [
    { t: 0.0, type: "spawn", data: { gridX: 5, gridY: 1 } },
    { t: 1.0, type: "move", data: { gridX: 6, gridY: 1 } },
    { t: 2.0, type: "move", data: { gridX: 7, gridY: 1 } },
    { t: 3.0, type: "move", data: { gridX: 8, gridY: 1 } }, // furniture!
  ];

  const result = await validateReplay({
    fixtureId: "tier1-abandoned-apartment",
    outcome: "victory",
    secondsElapsed: 4,
    squadHp: 100,
    squadMaxHp: 100,
    actionLog: wallHackLog,
    isPvP: false,
    unlockedTechs: [],
  });

  assertEquals(result.success, false);
  assertEquals(result.error?.includes("occupied by physical obstacle"), true);
});

Deno.test("validateReplay - catches and rejects squad HP-modification/invulnerability exploits", async () => {
  // Steps on pressure plate (5,2) which does 15 damage, but client claims they survived with 100 HP!
  const result = await validateReplay({
    fixtureId: "tier1-abandoned-apartment",
    outcome: "victory",
    secondsElapsed: 16,
    squadHp: 100, // Claimed full HP instead of simulated 85 HP!
    squadMaxHp: 100,
    actionLog: LEGITIMATE_WALKTHROUGH,
    isPvP: false,
    unlockedTechs: [],
  });

  assertEquals(result.success, false);
  assertEquals(result.error?.includes("HP modification exploit detected"), true);
});

Deno.test("validateReplay - catches and rejects boss victory claims where the boss is still alive", async () => {
  // Squad spawns at (5,1). Boss Ironjaw is at (8,7). Stash is at (8,8).
  // Squad walks to stash and secures without ever logging attacks on the boss!
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
    { t: 10.0, type: "move", data: { gridX: 8, gridY: 8 } }, // reaches stash!
    { t: 13.0, type: "stash_secured" },
  ];

  const result = await validateReplay({
    fixtureId: "boss-ironjaw",
    outcome: "victory",
    secondsElapsed: 13,
    squadHp: 10,
    squadMaxHp: 100,
    actionLog: skipBossLog,
    isPvP: false,
    unlockedTechs: [],
  });

  assertEquals(result.success, false);
  assertEquals(result.error?.includes("boss was never fully defeated"), true);
});
