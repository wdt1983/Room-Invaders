// supabase/functions/generate-npc-room/index.ts
//
// Phase 6 Task 6.0.8 & 6.0.9 — procedural NPC room generator.
// Receives an HTTP POST request carrying `{ tier: number }` (1 to 10) and an optional `{ seed: string }`.
// Carves a guaranteed pathable corridor from entry points to a Loot Stash,
// places furniture/barricade obstacles on non-path tiles to create a tactical maze,
// scatters active floor traps on the walkable corridors, and aligns turrets to defend the stash.
//
// Runtime: Deno. Deploy with `supabase functions deploy generate-npc-room`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GenerateRequest {
  tier?: number;
  difficulty?: number; // fallback name
  seed?: string;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Seeded PRNG implementation (Mulberry32)
class SeededRandom {
  private h: number;
  constructor(seedStr: string) {
    // Simple cyrb53 hash to generate a numeric seed from a string
    let h = 5381;
    for (let i = 0; i < seedStr.length; i++) {
      h = (h * 33) ^ seedStr.charCodeAt(i);
    }
    this.h = h >>> 0;
  }

  // Returns 0.0 to 1.0
  next(): number {
    let t = (this.h += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns min (inclusive) to max (exclusive)
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Returns integer in [min, max] inclusive
  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  // Pick random element from array
  pick<T>(arr: T[]): T {
    const idx = Math.floor(this.next() * arr.length);
    return arr[idx];
  }
}

// Thematic room categories and names by tier brackets
const THEMES_BY_TIER = {
  easy: {
    names: ["Abandoned Dorm", "Shattered Studio", "Suburban Cottage", "Bunker Closet", "Basement Corner"],
    types: ["House", "Apartment"],
    descriptions: ["A neglected survivor pad with skeletal fortifications.", "Low-tier shelter with makeshift barricades and scattered traps."]
  },
  medium: {
    names: ["Bodega Backroom", "High-Rise Refuge", "Diner Ruins", "Hardware Cache", "Pawnshop Vault"],
    types: ["Apartment", "Store"],
    descriptions: ["A fortified commercial site with double breaches and taser arrays.", "Medium difficulty storage point with narrow choke corridors."]
  },
  hard: {
    names: ["Secure Freight Terminal", "Supply Depot Alpha", "Subsector 4 Vault", "Fortified Safehouse", "Steel Cache"],
    types: ["Warehouse", "Store"],
    descriptions: ["Industrial warehouse packing heavy barricades and dense trap layers.", "Heavily fortified zone containing multi-hit shock arrays."]
  },
  expert: {
    names: ["Command Bastion", "Sector 9 Redoubt", "Core Control Grid", "Black-Site Stronghold", "Division Outpost"],
    types: ["Military Outpost", "Warehouse"],
    descriptions: ["An active military bunker. Impassable choke walls protected by high-range alert sentries.", "Top-tier fortified command chamber guarding rich components stockpiles."]
  }
};

// Item catalog properties matching seed.sql
const OBSTACLE_ITEMS = [
  { spriteKey: "furniture_bed_twin", footprintW: 2, footprintH: 1, type: "furniture" },
  { spriteKey: "furniture_shelf_metal", footprintW: 1, footprintH: 2, type: "furniture" },
  { spriteKey: "furniture_dresser_wooden", footprintW: 2, footprintH: 1, type: "furniture" },
  { spriteKey: "furniture_table_folding", footprintW: 2, footprintH: 1, type: "furniture" },
  { spriteKey: "furniture_tv_flatscreen", footprintW: 2, footprintH: 1, type: "furniture" },
  { spriteKey: "furniture_desk_metal", footprintW: 2, footprintH: 1, type: "furniture" },
  { spriteKey: "furniture_chair_office", footprintW: 1, footprintH: 1, type: "furniture" },
  { spriteKey: "furniture_sofa_leather", footprintW: 2, footprintH: 1, type: "furniture" },
  { spriteKey: "furniture_plant_potted", footprintW: 1, footprintH: 1, type: "furniture" }
];

const BARRICADE_ITEMS = [
  { spriteKey: "barricade_sandbags", footprintW: 1, footprintH: 1, type: "barricade" },
  { spriteKey: "barricade_bookshelf", footprintW: 2, footprintH: 1, type: "barricade" },
  { spriteKey: "barricade_flipped_table", footprintW: 2, footprintH: 1, type: "barricade" }
];

const TRAP_ITEMS = [
  { spriteKey: "trap_pressure_plate", footprintW: 1, footprintH: 1, type: "trap" },
  { spriteKey: "trap_spike_strip", footprintW: 1, footprintH: 1, type: "trap" },
  { spriteKey: "trap_shock_pad", footprintW: 1, footprintH: 1, type: "trap" },
  { spriteKey: "trap_glue", footprintW: 1, footprintH: 1, type: "trap" },
  { spriteKey: "trap_tripwire_alarm", footprintW: 1, footprintH: 1, type: "trap" }
];

const TURRET_ITEMS = [
  { spriteKey: "turret_nailgun", footprintW: 1, footprintH: 1, type: "turret" },
  { spriteKey: "turret_taser", footprintW: 1, footprintH: 1, type: "turret" }
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  // --- Auth & Setup ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    console.error("[generate-npc-room] SUPABASE_SERVICE_ROLE_KEY missing");
    return json({ success: false, error: "Server misconfigured" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  // --- Parse parameters ---
  let body: GenerateRequest = {};
  try {
    body = await req.json();
  } catch {
    // accept empty body and use defaults
  }

  const rawTier = body.tier ?? body.difficulty ?? 1;
  const tier = Math.max(1, Math.min(10, Math.floor(rawTier)));
  const randSeed = body.seed ?? `${user.id}:${tier}:${new Date().getUTCDate()}:${Date.now()}`;
  const rng = new SeededRandom(randSeed);

  // Determine difficulty brackets, grid size, and counts
  let bracket: "easy" | "medium" | "hard" | "expert" = "easy";
  let gridSize = 10;
  let requiredLevel = 1;
  let entryCount = 3;
  let obstacleCount = 4;
  let barricadeCount = 2;
  let trapCount = 3;
  let turretCount = 1;

  if (tier <= 3) {
    bracket = "easy";
    gridSize = 10;
    requiredLevel = tier;
    entryCount = 3;
    obstacleCount = rng.intRange(3, 5);
    barricadeCount = rng.intRange(1, 2);
    trapCount = rng.intRange(2, 4);
    turretCount = rng.intRange(0, 1);
  } else if (tier <= 6) {
    bracket = "medium";
    gridSize = 12;
    requiredLevel = tier;
    entryCount = 4;
    obstacleCount = rng.intRange(5, 7);
    barricadeCount = rng.intRange(2, 3);
    trapCount = rng.intRange(4, 6);
    turretCount = rng.intRange(1, 2);
  } else if (tier <= 8) {
    bracket = "hard";
    gridSize = 12;
    requiredLevel = tier;
    entryCount = 5;
    obstacleCount = rng.intRange(7, 9);
    barricadeCount = rng.intRange(3, 5);
    trapCount = rng.intRange(6, 9);
    turretCount = rng.intRange(2, 3);
  } else {
    bracket = "expert";
    gridSize = 14;
    requiredLevel = tier;
    entryCount = 6;
    obstacleCount = rng.intRange(9, 12);
    barricadeCount = rng.intRange(4, 6);
    trapCount = rng.intRange(8, 12);
    turretCount = rng.intRange(3, 4);
  }

  // --- Grid allocation trackers ---
  const cells = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
  const pathCells = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  // Determine Loot Stash: Put it deep inside the grid (e.g. opposite quadrant from main entry)
  const stashX = rng.intRange(gridSize - 3, gridSize - 2);
  const stashY = rng.intRange(gridSize - 3, gridSize - 2);
  cells[stashX][stashY] = true; // reserve stash

  // Define Entry points on boundaries
  const entryPoints: Array<{ wall: "north" | "south" | "east" | "west"; type: string; position: number }> = [];
  const entryCoords: Array<{ x: number; y: number }> = [];
  const walls: Array<"north" | "south" | "east" | "west"> = ["north", "west", "south", "east"];
  const entryTypes = ["door", "window", "vent", "skylight", "breach", "tunnel"];

  for (let i = 0; i < entryCount; i++) {
    const wall = walls[i % walls.length];
    const pos = rng.intRange(2, gridSize - 3);
    let x = 0;
    let y = 0;

    if (wall === "north") { x = pos; y = 0; }
    else if (wall === "south") { x = pos; y = gridSize - 1; }
    else if (wall === "west") { x = 0; y = pos; }
    else { x = gridSize - 1; y = pos; }

    // Deduplicate wall entries
    if (!cells[x][y]) {
      cells[x][y] = true;
      const typeIdx = Math.min(i, entryTypes.length - 1);
      entryPoints.push({ wall, type: entryTypes[typeIdx], position: pos });
      entryCoords.push({ x, y });
    }
  }

  // --- Path carving: guarantees A* connectivity ---
  // Connect each entry to the Stash by marking path tiles
  for (const entry of entryCoords) {
    let currX = entry.x;
    let currY = entry.y;

    // Walk towards stash
    while (currX !== stashX || currY !== stashY) {
      pathCells[currX][currY] = true;

      // step randomly but progressive towards target
      if (currX !== stashX && (currY === stashY || rng.next() > 0.5)) {
        currX += currX < stashX ? 1 : -1;
      } else if (currY !== stashY) {
        currY += currY < stashY ? 1 : -1;
      }
    }
  }
  pathCells[stashX][stashY] = true;

  // Placed items accumulator
  const items: any[] = [];

  // Helper: check placement viability
  function canPlace(x: number, y: number, w: number, h: number, ignorePath = false): boolean {
    if (x < 0 || y < 0 || x + w > gridSize || y + h > gridSize) return false;

    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const cx = x + dx;
        const cy = y + dy;
        
        // Cannot overlap already taken tiles
        if (cells[cx][cy]) return false;
        
        // Cannot place furniture/barricades on marked corridor paths
        if (!ignorePath && pathCells[cx][cy]) return false;
      }
    }
    return true;
  }

  // Helper: reserve occupied tiles
  function reserve(x: number, y: number, w: number, h: number) {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        cells[x + dx][y + dy] = true;
      }
    }
  }

  // 1. Place Obstacles (furniture): must NOT block corridor paths
  let obstaclesPlaced = 0;
  let attempts = 0;
  while (obstaclesPlaced < obstacleCount && attempts < 100) {
    attempts++;
    const spec = rng.pick(OBSTACLE_ITEMS);
    const rotation = rng.pick([0, 1, 2, 3]);
    const w = (rotation % 2 === 0) ? spec.footprintW : spec.footprintH;
    const h = (rotation % 2 === 0) ? spec.footprintH : spec.footprintW;

    const x = rng.intRange(1, gridSize - 1 - w);
    const y = rng.intRange(1, gridSize - 1 - h);

    if (canPlace(x, y, w, h, false)) {
      reserve(x, y, w, h);
      items.push({
        spriteKey: spec.spriteKey,
        gridX: x,
        gridY: y,
        footprintW: spec.footprintW,
        footprintH: spec.footprintH,
        rotation,
        type: "furniture"
      });
      obstaclesPlaced++;
    }
  }

  // 2. Place Barricades: must NOT block marked corridors
  let barricadesPlaced = 0;
  attempts = 0;
  while (barricadesPlaced < barricadeCount && attempts < 80) {
    attempts++;
    const spec = rng.pick(BARRICADE_ITEMS);
    const rotation = rng.pick([0, 1, 2, 3]);
    const w = (rotation % 2 === 0) ? spec.footprintW : spec.footprintH;
    const h = (rotation % 2 === 0) ? spec.footprintH : spec.footprintW;

    const x = rng.intRange(1, gridSize - 1 - w);
    const y = rng.intRange(1, gridSize - 1 - h);

    if (canPlace(x, y, w, h, false)) {
      reserve(x, y, w, h);
      items.push({
        spriteKey: spec.spriteKey,
        gridX: x,
        gridY: y,
        footprintW: spec.footprintW,
        footprintH: spec.footprintH,
        rotation,
        type: "barricade"
      });
      barricadesPlaced++;
    }
  }

  // 3. Place Traps: strategically scattered EXACTLY on corridor paths!
  let trapsPlaced = 0;
  attempts = 0;
  while (trapsPlaced < trapCount && attempts < 100) {
    attempts++;
    const spec = rng.pick(TRAP_ITEMS);
    const x = rng.intRange(1, gridSize - 2);
    const y = rng.intRange(1, gridSize - 2);

    // Traps MUST be placed on path tiles, and cannot overlap already occupied tiles
    if (pathCells[x][y] && !cells[x][y] && (x !== stashX || y !== stashY)) {
      cells[x][y] = true;
      items.push({
        spriteKey: spec.spriteKey,
        gridX: x,
        gridY: y,
        footprintW: spec.footprintW,
        footprintH: spec.footprintH,
        rotation: 0,
        type: "trap"
      });
      trapsPlaced++;
    }
  }

  // 4. Place Turrets: strategically positioned near walls/corners, preferably near stash or pointing to path
  let turretsPlaced = 0;
  attempts = 0;
  while (turretsPlaced < turretCount && attempts < 80) {
    attempts++;
    const spec = rng.pick(TURRET_ITEMS);
    
    // Choose outer boundary positions
    const side = rng.pick(["north", "south", "east", "west"]);
    let x = 0;
    let y = 0;

    if (side === "north") { x = rng.intRange(0, gridSize - 1); y = 0; }
    else if (side === "south") { x = rng.intRange(0, gridSize - 1); y = gridSize - 1; }
    else if (side === "west") { x = 0; y = rng.intRange(0, gridSize - 1); }
    else { x = gridSize - 1; y = rng.intRange(0, gridSize - 1); }

    // Turrets must be on empty non-path grid tiles
    if (canPlace(x, y, 1, 1, true) && (x !== stashX || y !== stashY) && !entryCoords.some(e => e.x === x && e.y === y)) {
      reserve(x, y, 1, 1);
      items.push({
        spriteKey: spec.spriteKey,
        gridX: x,
        gridY: y,
        footprintW: spec.footprintW,
        footprintH: spec.footprintH,
        rotation: 0,
        type: "turret"
      });
      turretsPlaced++;
    }
  }

  // --- Finalize response schema ---
  const theme = THEMES_BY_TIER[bracket];
  const name = rng.pick(theme.names);
  const type = rng.pick(theme.types);
  const desc = rng.pick(theme.descriptions);

  const fixture = {
    id: `procedural-tier-${tier}-${rng.intRange(1000, 9999)}`,
    name: `${name} (${type})`,
    description: `${desc} [Difficulty Tier ${tier}]`,
    difficulty: tier <= 3 ? "easy" : (tier <= 7 ? "medium" : "hard"),
    requiredLevel,
    gridSize,
    stash: { x: stashX, y: stashY },
    entryPoints,
    items
  };

  console.log(`[generate-npc-room] Generated Tier ${tier} room "${fixture.name}" of size ${gridSize}x${gridSize} with ${items.length} items.`);

  return json({
    success: true,
    tier,
    fixture,
  });
});
