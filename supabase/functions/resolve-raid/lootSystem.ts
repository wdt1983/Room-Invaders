// supabase/functions/resolve-raid/lootSystem.ts
//
// Phase 3 task 3.0.17 — per-NPC loot tables + seeded RNG on top of the
// deterministic reward tier introduced in 3.0.16.
//
// Why server-side: the client must never see the loot table or the roll
// logic — it would be trivial to reroll locally for max rewards. The
// function owns both the table and the RNG; the client receives only
// the final numbers.
//
// PRNG is seeded (mulberry32 + cyrb53 string hash) rather than
// Math.random so future replay storage (Phase 5, task 5.0.10) can
// reproduce the same rolls from the same seed. The seed is also
// returned in the response for audit/debug purposes.
//
// Loot tables are keyed by fixture id for MVP — 3 NPC rooms, each with
// their own table. When 6.0.8 (procedural NPC rooms) lands, tables
// shift to per-NPC-archetype (apartment/storage/store/warehouse/outpost)
// keyed by a `npc_type` column on the NPC rooms table.

export type LootOutcome = "victory" | "defeat";

export type LootResource =
  | "scrap"
  | "components"
  | "credits"
  | "intel"
  | "contraband";

/**
 * A single entry in a loot table. `min`/`max` are inclusive ranges rolled
 * uniformly; `chance` gates whether the entry drops at all (1.0 = always).
 */
export interface LootTableEntry {
  resource: LootResource;
  min: number;
  max: number;
  chance: number;
}

/**
 * Per-NPC loot definition. Victory and defeat get separate drop lists so
 * defeats can grant a small consolation (or nothing). XP is flat — no
 * RNG — so players have a predictable progression curve to plan against.
 */
export interface NpcLootTable {
  victory: LootTableEntry[];
  defeat: LootTableEntry[];
  xpVictory: number;
  xpDefeat: number;
}

/**
 * Final reward roll — the full set of resources credited + XP granted.
 * Every currency field is present (zero when the table didn't roll it)
 * so the downstream inventory commit is a simple field-for-field update.
 */
export interface LootRoll {
  scrap: number;
  components: number;
  credits: number;
  intel: number;
  contraband: number;
  xpGained: number;
  /** Seed used for the roll — echoed back to the client for audit and
   *  future replay reproducibility. */
  seed: number;
}

// ── Loot tables ──────────────────────────────────────────────────────
//
// Balance notes (tune in task 4.0.2):
//   - Easy victory averages ~25 scrap / 5 components + ~30% credits
//   - Medium victory averages ~42 scrap / 10 components + ~40% credits + 15% intel
//   - Defeat grants only the flat consolation XP (no loot)
//
// Per-currency drop probability is independent (each entry rolls its
// own d100), so a medium raid can drop all three of scrap + components
// + credits + intel + contraband in the same run.

const APARTMENT_LOOT: NpcLootTable = {
  xpVictory: 50,
  xpDefeat: 10,
  victory: [
    { resource: "scrap",      min: 20, max: 30, chance: 1.0 },
    { resource: "components", min: 3,  max: 7,  chance: 1.0 },
    { resource: "credits",    min: 5,  max: 15, chance: 0.30 },
  ],
  defeat: [],
};

const STORAGE_LOOT: NpcLootTable = {
  xpVictory: 55,
  xpDefeat: 10,
  victory: [
    { resource: "scrap",      min: 25, max: 35, chance: 1.0 },
    { resource: "components", min: 3,  max: 7,  chance: 1.0 },
    { resource: "credits",    min: 5,  max: 15, chance: 0.20 },
    { resource: "intel",      min: 1,  max: 2,  chance: 0.10 },
  ],
  defeat: [],
};

const CORNER_STORE_LOOT: NpcLootTable = {
  xpVictory: 85,
  xpDefeat: 15,
  victory: [
    { resource: "scrap",      min: 35, max: 50, chance: 1.0 },
    { resource: "components", min: 8,  max: 12, chance: 1.0 },
    { resource: "credits",    min: 10, max: 25, chance: 0.40 },
    { resource: "intel",      min: 1,  max: 3,  chance: 0.15 },
    { resource: "contraband", min: 1,  max: 1,  chance: 0.05 },
  ],
  defeat: [],
};

export const NPC_LOOT_TABLES: Record<string, NpcLootTable> = {
  "tier1-abandoned-apartment": APARTMENT_LOOT,
  "tier1-storage-unit":        STORAGE_LOOT,
  "tier1-corner-store":        CORNER_STORE_LOOT,
};

/**
 * Fallback table when an unknown fixture id reaches the function.
 * Mirrors the easy-difficulty tier from 3.0.16 so legacy clients still
 * get sane rewards. New fixtures should always add an entry to
 * {@link NPC_LOOT_TABLES}.
 */
const FALLBACK_LOOT: NpcLootTable = APARTMENT_LOOT;

// ── Seeded PRNG ──────────────────────────────────────────────────────
//
// cyrb53 hashes the seed string (userId + timestamp) to a 32-bit int;
// mulberry32 produces the [0, 1) stream. Both are public-domain.
// References: https://github.com/bryc/code/blob/master/jshash

/** cyrb53 string hash → 32-bit unsigned int. Fast, high-quality. */
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch: number; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) >>> 0;
}

/** mulberry32 PRNG — returns a [0, 1) draw on each call. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a reproducible seed from the user id + raid completion time.
 *  Same user + same timestamp = same seed = same rolls. Time is
 *  second-granularity so two rapid-fire POSTs don't collide on the
 *  same seed — if they land in the same second, they'd roll the same
 *  loot, which is a cheap rate-limit side-effect. */
export function deriveSeed(userId: string, nowMs: number): number {
  const bucket = Math.floor(nowMs / 1000);
  return cyrb53(`${userId}:${bucket}`);
}

// ── Rolling ──────────────────────────────────────────────────────────

/** Inclusive-integer roll in `[min, max]` using the provided PRNG. */
function rollInt(rng: () => number, min: number, max: number): number {
  if (max < min) return min;
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Resolves the loot table for a given fixture ID. If the ID is a procedural
 * NPC room, it dynamically constructs a table scaled progressively from Tier 1 to Tier 10.
 */
export function getLootTableForFixture(fixtureId: string): NpcLootTable {
  if (fixtureId.startsWith("procedural-tier-")) {
    const tierMatch = fixtureId.match(/procedural-tier-(\d+)/);
    const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;

    // Scale loot rewards progressively based on Tier 1 to 10
    const xpVictory = 45 + tier * 15; // Tier 1 = 60 XP, Tier 10 = 195 XP
    const xpDefeat = 10 + Math.floor(tier * 2); // Tier 1 = 12 XP, Tier 10 = 30 XP

    const victory: LootTableEntry[] = [
      { resource: "scrap", min: 15 + tier * 5, max: 25 + tier * 10, chance: 1.0 },
      { resource: "components", min: 2 + Math.floor(tier * 1.5), max: 5 + Math.floor(tier * 2.5), chance: 1.0 }
    ];

    // Credits unlock at Tier 2
    if (tier >= 2) {
      victory.push({ resource: "credits", min: 5 + tier * 2, max: 15 + tier * 4, chance: 0.3 + (tier * 0.03) });
    }

    // Intel unlocks at Tier 4
    if (tier >= 4) {
      victory.push({ resource: "intel", min: 1 + Math.floor(tier / 4), max: 2 + Math.floor(tier / 3), chance: 0.15 + (tier * 0.02) });
    }

    // Contraband drops with small chance at Tier 7+
    if (tier >= 7) {
      victory.push({ resource: "contraband", min: 1, max: Math.max(1, Math.floor(tier / 6)), chance: 0.05 + (tier * 0.01) });
    }

    return {
      victory,
      defeat: [],
      xpVictory,
      xpDefeat
    };
  }

  return NPC_LOOT_TABLES[fixtureId] ?? FALLBACK_LOOT;
}

/**
 * Roll the full loot payload for a raid outcome. Walks the per-NPC
 * table's `victory` or `defeat` entries; each entry rolls its own
 * `chance` gate and, if it passes, adds `rollInt(min, max)` to the
 * corresponding currency bucket. XP is flat (never rolled).
 */
export function rollLoot(
  fixtureId: string,
  outcome: LootOutcome,
  userId: string,
  nowMs = Date.now(),
): LootRoll {
  const table = getLootTableForFixture(fixtureId);
  const seed = deriveSeed(userId, nowMs);
  const rng = mulberry32(seed);

  const entries = outcome === "victory" ? table.victory : table.defeat;

  let scrap = 0, components = 0, credits = 0, intel = 0, contraband = 0;

  for (const entry of entries) {
    if (rng() > entry.chance) continue;
    const amount = rollInt(rng, entry.min, entry.max);
    switch (entry.resource) {
      case "scrap":      scrap += amount;      break;
      case "components": components += amount; break;
      case "credits":    credits += amount;    break;
      case "intel":      intel += amount;      break;
      case "contraband": contraband += amount; break;
    }
  }

  const xpGained = outcome === "victory" ? table.xpVictory : table.xpDefeat;
  return { scrap, components, credits, intel, contraband, xpGained, seed };
}

