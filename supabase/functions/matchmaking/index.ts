// supabase/functions/matchmaking/index.ts
//
// Phase 5 Task 5.0.4 — server-authoritative PvP matchmaking.
// Receives an HTTP POST request, fetches the player's own room level, and
// executes a dynamically expanding select query (±1 to ±5 room levels) to
// find suitable targets whose ceasefire has expired and who have no active PvP shield.
//
// Runtime: Deno. Deploy with `supabase functions deploy matchmaking`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    console.error("[matchmaking] SUPABASE_SERVICE_ROLE_KEY missing from env");
    return json({ success: false, error: "Server misconfigured" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    console.warn("[matchmaking] getUser failed:", userErr);
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Fetch player's own room level ---
  // deno-lint-ignore no-explicit-any
  const { data: room, error: roomError } = await (supabase.from("rooms") as any)
    .select("room_level")
    .eq("owner_id", user.id)
    .maybeSingle();

  // If no room exists for this user (which shouldn't happen due to trigger, but to be safe)
  const playerRoomLevel = room?.room_level ?? 1;

  if (roomError) {
    console.error("[matchmaking] Failed to query user room:", roomError);
  }

  // --- Dynamic Bracket Expansion Loop ---
  let targetRange = 1;
  let matched: any[] = [];
  const now = new Date();

  while (targetRange <= 5) {
    // If targetRange reaches 5, we search all levels by ignoring the bounds
    const delta = targetRange >= 5 ? 20 : targetRange;
    const minLvl = Math.max(1, playerRoomLevel - delta);
    const maxLvl = playerRoomLevel + delta;

    // deno-lint-ignore no-explicit-any
    const { data: opponents, error: matchError } = await (supabase.from("rooms") as any)
      .select(`
        id,
        owner_id,
        room_level,
        grid_size,
        defense_rating,
        shield_until,
        profiles:owner_id (
          id,
          username,
          player_level,
          safe_mode_until,
          inventories (
            scrap,
            components,
            storage_capacity
          )
        )
      `)
      .neq("owner_id", user.id)
      .gte("room_level", minLvl)
      .lte("room_level", maxLvl)
      .order("defense_rating", { ascending: false });

    if (matchError) {
      console.error("[matchmaking] Opponent query error:", matchError);
      return json({ success: false, error: "Database error querying opponents" }, 500);
    }

    // Filter in JS against active ceasefire + PvP shields
    const filtered = (opponents || []).filter((opp: any) => {
      const profile = Array.isArray(opp.profiles) ? opp.profiles[0] : opp.profiles;
      if (!profile) return false;

      // Safe Mode (Ceasefire active if safe_mode_until > now AND player_level < 5)
      const isSafeMode = profile.safe_mode_until && new Date(profile.safe_mode_until) > now && profile.player_level < 5;

      // PvP Shield
      const isShielded = opp.shield_until && new Date(opp.shield_until) > now;

      return !isSafeMode && !isShielded;
    });

    // If we found at least 3 opponents, or we reached max scope (matching everyone)
    if (filtered.length >= 3 || targetRange >= 5) {
      matched = filtered;
      break;
    }

    targetRange++;
  }

  // Format targets response
  const targets = matched.map((opp: any) => {
    const profile = Array.isArray(opp.profiles) ? opp.profiles[0] : opp.profiles;
    const inventories = Array.isArray(profile?.inventories) ? profile.inventories[0] : profile?.inventories;
    
    const scrap = inventories?.scrap ?? 200;
    const components = inventories?.components ?? 50;
    const storage_capacity = inventories?.storage_capacity ?? 500;

    const scrapOverflow = Math.max(0, scrap - storage_capacity);
    const componentsOverflow = Math.max(0, components - Math.floor(storage_capacity * 0.25));

    // Attacker's loot pool is 50% of overflow
    const scrapLootPool = Math.floor(scrapOverflow * 0.5);
    const componentsLootPool = Math.floor(componentsOverflow * 0.5);

    return {
      id: profile.id,
      username: profile.username || "Survivor",
      player_level: profile.player_level || 1,
      room_level: opp.room_level || 1,
      grid_size: opp.grid_size || 10,
      defense_rating: opp.defense_rating || 0,
      scrap_overflow: scrapLootPool,
      components_overflow: componentsLootPool,
    };
  });

  console.log(`[matchmaking] Matched ${targets.length} targets for user ${user.id} inside range ${targetRange}`);

  return json({
    success: true,
    targets,
    bracketRange: targetRange >= 5 ? "all" : `±${targetRange}`,
  });
});
