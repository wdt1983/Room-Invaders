// supabase/functions/resolve-raid/fixtures.ts
//
// Server-side copy of the canonical NPC raid fixtures. Minimal shape —
// the Edge Function only needs enough to validate the client's claim.
// Reward math has moved to `lootSystem.ts` (task 3.0.17) — per-NPC
// tables + seeded RNG replace the deterministic REWARDS_BY_DIFFICULTY
// introduced in 3.0.16.
//
// The richer client fixture (`src/game/fixtures/npc-rooms/index.ts`)
// carries the layout used to render the raid scene; we don't need any
// of that here.
//
// MVP duplication is deliberate. Fixtures retire with task 6.0.8
// (`generate-npc-room` Edge Function) when NPC rooms become
// DB-generated per profile.

export type Difficulty = "easy" | "medium" | "hard";

export interface FixtureSummary {
  name: string;
  difficulty: Difficulty;
  stash: { x: number; y: number };
  requiredLevel: number;
}

export const FIXTURES: Record<string, FixtureSummary> = {
  "tier1-abandoned-apartment": {
    name: "Abandoned Apartment",
    difficulty: "easy",
    stash: { x: 8, y: 8 },
    requiredLevel: 1,
  },
  "tier1-storage-unit": {
    name: "Storage Unit",
    difficulty: "easy",
    stash: { x: 8, y: 7 },
    requiredLevel: 1,
  },
  "tier1-corner-store": {
    name: "Corner Store",
    difficulty: "medium",
    stash: { x: 1, y: 1 },
    requiredLevel: 3,
  },
  "boss-ironjaw": {
    name: "Ironjaw",
    difficulty: "easy",
    stash: { x: 8, y: 8 },
    requiredLevel: 3,
  },
  "boss-whisper": {
    name: "Whisper",
    difficulty: "easy",
    stash: { x: 1, y: 1 },
    requiredLevel: 5,
  },
  "boss-volkov": {
    name: "Volkov",
    difficulty: "medium",
    stash: { x: 10, y: 10 },
    requiredLevel: 7,
  },
  "boss-circuit": {
    name: "Circuit",
    difficulty: "medium",
    stash: { x: 6, y: 6 },
    requiredLevel: 10,
  },
  "boss-warden": {
    name: "The Warden",
    difficulty: "hard",
    stash: { x: 7, y: 7 },
    requiredLevel: 15,
  },
};

/** Ceiling used as a sanity bound for `secondsElapsed`. Hard-difficulty
 *  raids run for 150s; allow a small buffer for clock skew. */
export const MAX_RAID_SECONDS = 200;
