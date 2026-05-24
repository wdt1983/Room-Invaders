// supabase/functions/validate-defense/index.ts
//
// Task 2.0.9 — server-side defense layout verification.
//
// Identifies the authenticated caller via userClient, queries their room layout,
// placed items, and tech tree unlocks using a service-role dbClient, verifies
// layout legality against all structural and tech regulations, recomputes their
// defense rating, and updates the database authoritatively.
//
// Runtime: Deno. Deploy with `supabase functions deploy validate-defense`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EntryPoint {
  type: "door" | "window" | "vent";
  wall: "north" | "south" | "east" | "west";
  position: number;
}

const VALID_WALLS = new Set(["north", "south", "east", "west"]);
const VALID_TYPES = new Set(["door", "window", "vent"]);

function coerceEntryPoints(raw: unknown, gridSize: number): EntryPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((ep: any) =>
    ep &&
    typeof ep === "object" &&
    VALID_WALLS.has(ep.wall) &&
    VALID_TYPES.has(ep.type) &&
    Number.isInteger(ep.position) &&
    ep.position >= 0 &&
    ep.position < gridSize
  ) as EntryPoint[];
}

function entryTileFor(ep: EntryPoint, gridSize: number): { x: number; y: number } | null {
  const max = gridSize - 1;
  if (ep.position < 0 || ep.position > max) return null;
  switch (ep.wall) {
    case "north": return { x: ep.position, y: 0 };
    case "south": return { x: ep.position, y: max };
    case "east":  return { x: max,         y: ep.position };
    case "west":  return { x: 0,           y: ep.position };
    default:      return null;
  }
}

function slotsForLevel(roomLevel: number): { defense: number; furniture: number; grid: number } {
  const level = Number.isFinite(roomLevel) ? roomLevel : 1;
  if (level >= 20) return { defense: 55, furniture: 75, grid: 14 };
  if (level >= 15) return { defense: 40, furniture: 55, grid: 12 };
  if (level >= 10) return { defense: 28, furniture: 40, grid: 12 };
  if (level >= 5)  return { defense: 16, furniture: 25, grid: 10 };
  return                  { defense: 8,  furniture: 15, grid: 10 };
}

function defenseValueFor(type: string | null | undefined, stats: any): number {
  if (!type) return 0;
  const damage = Number(stats?.damage) || 0;
  const range = Number(stats?.range) || 0;
  const hp = Number(stats?.hp) || 0;
  const stun = Number(stats?.stun_duration) || 0;
  const immobilize = Number(stats?.immobilize_duration) || 0;
  const alert = Number(stats?.alert_radius) || 0;

  switch (type) {
    case "trap":
      return damage + Math.round(stun * 5) + Math.round(immobilize * 3) + alert * 2;
    case "turret":
      return damage * Math.max(1, range);
    case "barricade":
      return Math.floor(hp / 10);
    case "guard":
      return damage * 2;
    default:
      return 0;
  }
}

function slotCategoryFor(type: string | null | undefined): "defense" | "furniture" | "none" {
  if (!type) return "none";
  if (["trap", "turret", "barricade", "guard"].includes(type)) return "defense";
  if (type === "furniture") return "furniture";
  return "none";
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  // --- Auth & Client Config ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    console.error("[validate-defense] SUPABASE_SERVICE_ROLE_KEY missing from env");
    return json({ success: false, error: "Server misconfigured" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    console.warn("[validate-defense] getUser failed:", userErr);
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Fetch Room & Placed Items & Tech Unlocks ---
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("grid_size, room_level, entry_points")
    .eq("owner_id", user.id)
    .single();

  if (roomErr || !room) {
    console.warn("[validate-defense] Room select failed:", roomErr);
    return json({ success: false, error: "Room not found" }, 404);
  }

  const { data: placedItems, error: itemsErr } = await supabase
    .from("player_items")
    .select(`
      id,
      grid_position,
      rotation,
      items ( id, type, name, footprint, stats, tech_tree_node )
    `)
    .eq("owner_id", user.id)
    .eq("placed_in_room", true);

  if (itemsErr) {
    console.error("[validate-defense] Placed items fetch failed:", itemsErr);
    return json({ success: false, error: "Failed to fetch room layout" }, 500);
  }

  const { data: techUnlocks, error: techErr } = await supabase
    .from("player_tech")
    .select("node_id")
    .eq("owner_id", user.id);

  if (techErr) {
    console.error("[validate-defense] Tech unlocks fetch failed:", techErr);
  }

  const unlockedNodes = new Set((techUnlocks || []).map((t: any) => t.node_id));
  const gridSize = room.grid_size ?? 10;
  const roomLevel = room.room_level ?? 1;

  // Derive Entry Points Coordinates
  const entryPoints = coerceEntryPoints(room.entry_points, gridSize);
  const entryTiles = new Map<string, EntryPoint>();
  for (const ep of entryPoints) {
    const tile = entryTileFor(ep, gridSize);
    if (tile) {
      entryTiles.set(`${tile.x},${tile.y}`, ep);
    }
  }

  // --- Validation Routine ---
  const errors: string[] = [];
  const occupiedTiles = new Map<string, string>(); // coordinate -> item name/id
  let defenseSlotsUsed = 0;
  let computedDefenseRating = 0;

  for (const placed of placedItems || []) {
    const item = Array.isArray(placed.items) ? placed.items[0] : placed.items;
    if (!item) continue;

    const gridX = placed.grid_position?.x;
    const gridY = placed.grid_position?.y;
    const name = item.name ?? "Placed Item";

    // 1. Basic coordinate validation
    if (gridX === undefined || gridY === undefined || !Number.isInteger(gridX) || !Number.isInteger(gridY)) {
      errors.push(`"${name}" has invalid or missing grid coordinates.`);
      continue;
    }

    // 2. Footprint calculations and bounds validation
    const footprint = item.footprint ?? { w: 1, h: 1 };
    const rotation = placed.rotation ?? 0;
    let w = Number(footprint.w) || 1;
    let h = Number(footprint.h) || 1;

    // Swap dimensions on odd rotations (90 or 270 degrees)
    if (rotation === 1 || rotation === 3) {
      const temp = w;
      w = h;
      h = temp;
    }

    // Bounds checking
    if (gridX < 0 || gridX + w > gridSize || gridY < 0 || gridY + h > gridSize) {
      errors.push(`"${name}" placed at (${gridX}, ${gridY}) is out of grid bounds.`);
      continue;
    }

    // Accumulate defense slots and rating
    const slotCategory = slotCategoryFor(item.type);
    if (slotCategory === "defense") {
      defenseSlotsUsed++;
    }
    computedDefenseRating += defenseValueFor(item.type, item.stats);

    // 3. Occupied tile scans, double placement checks, and entry point violations
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = gridX + dx;
        const ty = gridY + dy;
        const coordKey = `${tx},${ty}`;

        // Double placement check
        if (occupiedTiles.has(coordKey)) {
          const matchingItem = occupiedTiles.get(coordKey)!;
          errors.push(`Overlap detected at tile (${tx}, ${ty}) between "${name}" and "${matchingItem}".`);
        } else {
          occupiedTiles.set(coordKey, name);
        }

        // Entry point check
        if (entryTiles.has(coordKey)) {
          const ep = entryTiles.get(coordKey)!;
          errors.push(`Illegal placement: "${name}" overlaps with the Room ${ep.wall} ${ep.type} entry point at (${tx}, ${ty}).`);
        }
      }
    }

    // 4. Perimeter check for turrets
    if (item.type === "turret") {
      const max = gridSize - 1;
      const onPerimeter = gridX === 0 || gridX === max || gridY === 0 || gridY === max;
      if (!onPerimeter) {
        errors.push(`Illegal turret placement: "${name}" at (${gridX}, ${gridY}) must be placed against an outer wall.`);
      }
    }

    // 5. Tech tree requirements validation
    if (item.tech_tree_node && !unlockedNodes.has(item.tech_tree_node)) {
      errors.push(`Locked technology: "${name}" placed at (${gridX}, ${gridY}) requires researching "${item.tech_tree_node}" node.`);
    }
  }

  // 6. Slot limit validation
  const defenseSlotsCap = slotsForLevel(roomLevel).defense;
  if (defenseSlotsUsed > defenseSlotsCap) {
    errors.push(`Exceeded defense slots capacity: Placing ${defenseSlotsUsed} defenses exceeds the level ${roomLevel} maximum of ${defenseSlotsCap}.`);
  }

  const valid = errors.length === 0;

  // --- Database Update Side-Effect ---
  // If the layout is valid, authoritatively sync the defense rating.
  // This self-heals any client desyncs and protects PvP rankings.
  if (valid) {
    const { error: updateErr } = await supabase
      .from("rooms")
      .update({
        defense_rating: computedDefenseRating,
        updated_at: new Date().toISOString()
      })
      .eq("owner_id", user.id);

    if (updateErr) {
      console.error("[validate-defense] Failed to sync verified defense rating:", updateErr);
    }
  }

  console.log(`[validate-defense] User ${user.id} layout checked: ${valid ? "VALID" : "INVALID"} with ${errors.length} errors. Defense Rating: ${computedDefenseRating}`);

  return json({
    success: true,
    valid,
    defenseRating: computedDefenseRating,
    defenseSlotsUsed,
    defenseSlotsCap,
    errors
  });
});
