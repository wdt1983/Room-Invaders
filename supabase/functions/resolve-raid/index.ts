// supabase/functions/resolve-raid/index.ts
//
// Phase 3 task 3.0.16 — server-authoritative raid resolution.
//
// Receives the raid's `action_log` + outcome claim from the client after
// `RaidScene.finishRaid`, validates it against the NPC fixture, computes
// authoritative rewards, and commits them to `inventories` + `profiles.xp`.
// The response carries the validated numbers back so the results screen
// can display server-truth instead of the client's scaffold math.
//
// MVP validation is coarse — we check the outcome is structurally possible
// given the action log (victory requires a `stash_secured` event, damage
// taken bounded by squad max HP, elapsed time bounded by max duration).
// A full replay harness (re-simulate the action_log tick-by-tick against
// the fixture to detect impossible damage totals, impossible tile
// traversals, etc.) is post-MVP work — flagged as the main hardening
// target when PvP lands in Phase 5 and the stakes become real.
//
// Runtime: Deno. Deploy with `supabase functions deploy resolve-raid`.
// Excluded from Next.js typecheck via `supabase/**` in tsconfig.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FIXTURES, MAX_RAID_SECONDS } from "./fixtures.ts";
import { rollLoot } from "./lootSystem.ts";
import { levelForXp } from "./progression.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RaidResolveRequest {
  fixtureId: string;
  outcome: "victory" | "defeat";
  reason: string;
  secondsElapsed: number;
  squadHp: number;
  squadMaxHp: number;
  actionLog: Array<{
    t: number;
    type: string;
    // deno-lint-ignore no-explicit-any
    data?: Record<string, any>;
  }>;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

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

function resolveSpawnForEntryPoint(ep: EntryPoint, gridSize: number): { x: number; y: number } {
  if (!ep) return { x: 1, y: 1 };
  const max = gridSize - 1;
  switch (ep.wall) {
    case 'north': return { x: ep.position, y: 1 };
    case 'south': return { x: ep.position, y: max - 1 };
    case 'east':  return { x: max - 1,     y: ep.position };
    case 'west':  return { x: 1,           y: ep.position };
    default: return { x: 1, y: 1 };
  }
}

function slotCategoryFor(type: string | null | undefined): "defense" | "furniture" | "none" {
  if (!type) return "none";
  if (["trap", "turret", "barricade", "guard"].includes(type)) return "defense";
  if (type === "furniture") return "furniture";
  return "none";
}

function defenseValueFor(type: string | null | undefined, stats: any): number {
  if (!type) return 0;
  const damage = Number(stats?.damage) || 0;
  const range = Number(stats?.range) || 0;
  const hp = Number(stats?.hp) || 0;
  const stun = Number(stats?.stun_duration) || 0;
  const immobilize = Number(stats?.immobilize_duration) || 0;
  const alert = Number(stats?.alert_radius) || 0;
  const uses = Number(stats?.uses) || 1;
  const emp = Number(stats?.emp_duration) || 0;
  const fireRate = Number(stats?.fire_rate) || 1.0;
  const chainTargets = Number(stats?.chain_targets) || 1;
  const decoyRadius = Number(stats?.decoy_radius) || 0;

  switch (type) {
    case "trap":
      return (damage * Math.min(3, uses)) + 
             Math.round(stun * 6) + 
             Math.round(immobilize * 4) + 
             Math.round(emp * 3) + 
             Math.round(alert * 2.5);
    case "turret":
      const fireRateFactor = fireRate > 0 ? (1.0 / fireRate) : 1.0;
      return Math.round(damage * fireRateFactor * Math.max(1, range) * chainTargets);
    case "barricade":
      return Math.floor(hp / 8);
    case "guard":
      return Math.floor(hp / 5) + 
             Math.round(damage * 2.5) + 
             (range * 2) + 
             (decoyRadius * 10);
    default:
      return 0;
  }
}

async function recomputeDefenderDefenseState(
  supabase: any,
  defenderId: string,
): Promise<void> {
  const { data: placedRows } = await supabase
    .from("player_items")
    .select("is_damaged, items ( type, stats )")
    .eq("owner_id", defenderId)
    .eq("placed_in_room", true);

  let defenseRating = 0;

  for (const row of placedRows ?? []) {
    const itemData = Array.isArray(row.items) ? row.items[0] : row.items;
    const type = itemData?.type as string | undefined;
    const stats = itemData?.stats;
    if (!row.is_damaged) {
      defenseRating += defenseValueFor(type, stats);
    }
  }

  await supabase
    .from("rooms")
    .update({ defense_rating: defenseRating })
    .eq("owner_id", defenderId);
}


// deno-lint-ignore no-explicit-any
async function trackRaidQuestProgress(supabase: any, userId: string): Promise<void> {
  try {
    const { data: activeQuests, error } = await supabase
      .from("player_quests")
      .select("id, quest_id, progress, target_value")
      .eq("player_id", userId)
      .eq("status", "active");

    if (error || !activeQuests || activeQuests.length === 0) return;

    // Hardcoded categories matching 'raid_fixture'
    const RAID_QUEST_IDS = new Set(["tut-05", "daily-01", "daily-05", "weekly-02"]);

    for (const quest of activeQuests) {
      if (!RAID_QUEST_IDS.has(quest.quest_id)) continue;

      const newProgress = Math.min(quest.target_value, quest.progress + 1);
      const isCompleted = newProgress >= quest.target_value;

      const updatePayload: any = {
        progress: newProgress,
        updated_at: new Date().toISOString()
      };

      if (isCompleted) {
        updatePayload.status = "completed";
        updatePayload.completed_at = new Date().toISOString();
      }

      await supabase
        .from("player_quests")
        .update(updatePayload)
        .eq("id", quest.id);

      console.log(`[QuestSystem] Updated raid quest ${quest.quest_id}: ${newProgress}/${quest.target_value}`);

      // Sequential unlock for tut-05 -> tut-06
      if (isCompleted && quest.quest_id === "tut-05") {
        await supabase.from("player_quests").insert({
          player_id: userId,
          quest_id: "tut-06",
          status: "active",
          progress: 0,
          target_value: 1
        });
        console.log("[QuestSystem] Unlocked sequential tutorial quest: tut-06");
      }
    }
  } catch (err) {
    console.error("[QuestSystem] Error tracking raid quest progress:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  // --- Auth ---
  // Two-client pattern (the recommended Supabase Edge Function shape for
  // trusted server logic):
  //   1. `userClient` — anon key + the request's Authorization header.
  //      Sole purpose is `auth.getUser()` to identify the caller. We
  //      DON'T use it for DB ops because RLS evaluation depends on
  //      PostgREST being able to verify the JWT, and projects on the
  //      new ES256 signing keys can fail that check silently (rows
  //      appear "not found" instead of erroring). Disabling
  //      verify_jwt at the function gateway gets us past the platform
  //      verifier; this client side-steps the RLS edge case too.
  //   2. `dbClient` — service role key. Bypasses RLS. Used only AFTER
  //      `getUser()` has confirmed who the caller is, and queries are
  //      always scoped to `user.id` so we can't accidentally leak
  //      across accounts.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    console.error("[resolve-raid] SUPABASE_SERVICE_ROLE_KEY missing from env");
    return json({ success: false, error: "Server misconfigured" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    console.warn("[resolve-raid] getUser failed:", userErr);
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Parse body ---
  let body: RaidResolveRequest;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  // Fetch profile early for level requirement, XP, and reputation updates
  // deno-lint-ignore no-explicit-any
  const { data: profile, error: profileErr } = await (supabase.from("profiles") as any)
    .select("xp, player_level, username, reputation")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    console.warn("[resolve-raid] Profile lookup failed:", profileErr);
    return json({ success: false, error: "Player profile not found" }, 404);
  }

  const previousPlayerLevel = Math.max(1, profile.player_level ?? 1);

  // Check if target is a player UUID (PvP raid)
  const isPvP = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(body.fixtureId);

  let loot: {
    scrap: number;
    components: number;
    credits: number;
    intel: number;
    contraband: number;
    xpGained: number;
    seed: number;
  };

  let gridSize = 10;
  let entryPoints: any[] = [];

  if (isPvP) {
    const defenderId = body.fixtureId;
    if (defenderId === user.id) {
      return json({ success: false, error: "Cannot raid yourself" }, 400);
    }

    // Query defender profile details
    const { data: dProfile, error: dpErr } = await (supabase.from("profiles") as any)
      .select("xp, player_level, username, reputation")
      .eq("id", defenderId)
      .single();

    if (dpErr || !dProfile) {
      console.warn("[resolve-raid] Defender profile not found:", dpErr);
      return json({ success: false, error: "Defender profile not found" }, 404);
    }

    // Query defender room details (including entry_points for stash and path validations)
    const { data: dRoom, error: drErr } = await (supabase.from("rooms") as any)
      .select("room_level, grid_size, shield_until, defense_rating, times_raided, entry_points")
      .eq("owner_id", defenderId)
      .single();

    if (drErr || !dRoom) {
      console.warn("[resolve-raid] Defender room not found:", drErr);
      return json({ success: false, error: "Defender room not found" }, 404);
    }

    gridSize = dRoom.grid_size ?? 10;
    entryPoints = dRoom.entry_points ?? [];

    // Fetch attacker room details to enforce Matchmaking Level Brackets
    const { data: aRoom } = await (supabase.from("rooms") as any)
      .select("room_level")
      .eq("owner_id", user.id)
      .single();
    const attackerRoomLevel = aRoom?.room_level ?? 1;

    // Enforce Matchmaking Bracket validation (±5 room levels) or revenge raid bypass
    const roomLevelDiff = Math.abs(attackerRoomLevel - dRoom.room_level);
    if (roomLevelDiff > 5) {
      // Check if a valid revenge raid exists (user has been raided by defender in the past 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: pastRaids } = await (supabase.from("raid_history") as any)
        .select("id")
        .eq("player_id", defenderId)
        .eq("defender_id", user.id)
        .gt("created_at", sevenDaysAgo)
        .limit(1);

      const isRevenge = pastRaids && pastRaids.length > 0;
      if (!isRevenge) {
        return json({ success: false, error: "Target is outside your matchmaking bracket and no revenge matches exist" }, 400);
      }
    }

    // Enforce active shield check
    const now = new Date();
    if (dRoom.shield_until && new Date(dRoom.shield_until) > now) {
      return json({ success: false, error: "Target is currently protected by an active shield" }, 400);
    }

    // Enforce 24-hour daily PvP raid cap (max 3 received per defender in last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: incomingRaidCount, error: countErr } = await (supabase.from("raid_history") as any)
      .select("id", { count: "exact", head: true })
      .eq("defender_id", defenderId)
      .gt("created_at", oneDayAgo);

    if (!countErr && incomingRaidCount && incomingRaidCount >= 3) {
      return json({ success: false, error: "Target has reached the daily limit of incoming raids" }, 400);
    }

    // Query defender inventory to calculate overflow resources
    const { data: dInventory, error: diErr } = await (supabase.from("inventories") as any)
      .select("scrap, components, storage_capacity")
      .eq("owner_id", defenderId)
      .single();

    if (diErr || !dInventory) {
      console.warn("[resolve-raid] Defender inventory not found:", diErr);
      return json({ success: false, error: "Defender inventory not found" }, 500);
    }

    const dScrap = dInventory.scrap ?? 0;
    const dComponents = dInventory.components ?? 0;
    const dStorageCapacity = dInventory.storage_capacity ?? 500;

    const scrapOverflow = Math.max(0, dScrap - dStorageCapacity);
    const componentsOverflow = Math.max(0, dComponents - Math.floor(dStorageCapacity * 0.25));

    // Calculate plundered assets (50% of overflows) if victory
    const plunderedScrap = body.outcome === "victory" ? Math.floor(scrapOverflow * 0.5) : 0;
    const plunderedComponents = body.outcome === "victory" ? Math.floor(componentsOverflow * 0.5) : 0;

    // Deduct stolen assets from defender inventory if victory
    if (body.outcome === "victory" && (plunderedScrap > 0 || plunderedComponents > 0)) {
      const { error: deductErr } = await (supabase.from("inventories") as any)
        .update({
          scrap: Math.max(0, dScrap - plunderedScrap),
          components: Math.max(0, dComponents - plunderedComponents),
          updated_at: new Date().toISOString()
        })
        .eq("owner_id", defenderId);

      if (deductErr) {
        console.error("[resolve-raid] Failed to deduct loot from defender:", deductErr);
      }
    }

    // Update defender shield (8h shield granted to defender upon victory raid)
    if (body.outcome === "victory") {
      const shieldUntil = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      const { error: shieldErr } = await (supabase.from("rooms") as any)
        .update({
          shield_until: shieldUntil,
          times_raided: (dRoom.times_raided ?? 0) + 1,
          last_raided_at: new Date().toISOString()
        })
        .eq("owner_id", defenderId);

      if (shieldErr) {
        console.error("[resolve-raid] Failed to update defender shield:", shieldErr);
      }
    }

    // Parse actionLog to identify which of the defender's defenses were damaged
    if (body.actionLog && body.actionLog.length > 0) {
      const damagedCoords = new Set<string>();
      for (const event of body.actionLog) {
        if (
          ["trap_triggered", "turret_fired", "barricade_attacked", "defense_destroyed"].includes(
            event.type
          )
        ) {
          const x = event.data?.gridX;
          const y = event.data?.gridY;
          if (typeof x === "number" && typeof y === "number") {
            damagedCoords.add(`${x},${y}`);
          }
        }
      }

      if (damagedCoords.size > 0) {
        console.log(`[resolve-raid] Flagging ${damagedCoords.size} defenses as damaged for defender ${defenderId}`);
        for (const coord of damagedCoords) {
          const [x, y] = coord.split(",").map(Number);
          const { error: damageErr } = await (supabase.from("player_items") as any)
            .update({ is_damaged: true })
            .eq("owner_id", defenderId)
            .eq("placed_in_room", true)
            .contains("grid_position", { x, y });

          if (damageErr) {
            console.error(`[resolve-raid] Failed to mark defense at ${x},${y} as damaged:`, damageErr);
          }
        }
        
        // Recompute the defender's defense rating after their defenses are damaged
        await recomputeDefenderDefenseState(supabase, defenderId);
      }
    }

    // Award reputation (Attacker victory: Attacker +15 RP, Defender -10 RP; Defeat: Attacker -10 RP, Defender +15 RP)
    const attRepDelta = body.outcome === "victory" ? 15 : -10;
    const defRepDelta = body.outcome === "victory" ? -10 : 15;

    // Update defender profile reputation (clamp at 0)
    const { error: defRepErr } = await (supabase.from("profiles") as any)
      .update({
        reputation: Math.max(0, (dProfile.reputation ?? 0) + defRepDelta),
        updated_at: new Date().toISOString()
      })
      .eq("id", defenderId);

    if (defRepErr) {
      console.error("[resolve-raid] Failed to update defender reputation:", defRepErr);
    }

    // Create database notification for defender
    const notificationTitle = body.outcome === "victory" ? "Stronghold Breached!" : "Raid Defended Successfully";
    const notificationContent = body.outcome === "victory"
      ? `Your stronghold was breached by ${profile.username || "an attacker"}! They plundered ${plunderedScrap} Scrap and ${plunderedComponents} Components.`
      : `Your defensive layout successfully repelled ${profile.username || "an attacker"}! You earned +15 RP.`;

    const { error: notifErr } = await (supabase.from("notifications") as any)
      .insert({
        user_id: defenderId,
        type: "raid",
        title: notificationTitle,
        content: notificationContent,
        metadata: {
          attacker_id: user.id,
          attacker_username: profile.username,
          outcome: body.outcome,
          scrap_stolen: plunderedScrap,
          components_stolen: plunderedComponents,
          rep_delta: defRepDelta
        }
      });

    if (notifErr) {
      console.error("[resolve-raid] Failed to insert notification:", notifErr);
    }

    // Update attacker profile reputation (cap at 0)
    const { error: attRepErr } = await (supabase.from("profiles") as any)
      .update({
        reputation: Math.max(0, (profile.reputation ?? 0) + attRepDelta),
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (attRepErr) {
      console.error("[resolve-raid] Failed to update attacker reputation:", attRepErr);
    }

    // Assign loot details for attacker response
    loot = {
      scrap: plunderedScrap,
      components: plunderedComponents,
      credits: 0,
      intel: body.outcome === "victory" ? 3 : 0, // award a small amount of intel for player victories
      contraband: 0,
      xpGained: body.outcome === "victory" ? 80 : 20, // fixed XP for PvP
      seed: Math.floor(Math.random() * 1000000)
    };

  } else {
    // --- NPC Fixture Path (Standard or Procedural) ---
    let requiredLevel = 1;
    const isProcedural = body.fixtureId.startsWith("procedural-tier-");

    if (isProcedural) {
      const tierMatch = body.fixtureId.match(/procedural-tier-(\d+)/);
      const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
      requiredLevel = tier;
    } else {
      const fixture = FIXTURES[body.fixtureId];
      if (!fixture) return json({ success: false, error: `Unknown fixture: ${body.fixtureId}` }, 400);
      requiredLevel = fixture.requiredLevel;
    }

    // Enforce level lock
    if (previousPlayerLevel < requiredLevel) {
      return json({ success: false, error: "Player level too low for this target" }, 400);
    }

    // Enforce 4-hour cooldown
    const COOLDOWN_MS = 4 * 60 * 60 * 1000;
    const fourHoursAgo = new Date(Date.now() - COOLDOWN_MS).toISOString();
    // deno-lint-ignore no-explicit-any
    const { data: recentRaids, error: cooldownError } = await (supabase.from("raid_history") as any)
      .select("id")
      .eq("player_id", user.id)
      .eq("target_id", body.fixtureId)
      .gt("created_at", fourHoursAgo)
      .limit(1);

    if (cooldownError) {
      console.warn("[resolve-raid] Cooldown check failed:", cooldownError);
      return json({ success: false, error: "Failed to verify target cooldown status" }, 500);
    }

    if (recentRaids && recentRaids.length > 0) {
      return json({ success: false, error: "Target is currently on cooldown" }, 400);
    }

    // Reward computation (NPC-specific)
    loot = rollLoot(body.fixtureId, body.outcome, user.id);
  }

  // --- Tech Tree Loot Multipliers (Task 7.0.4) ---
  const { data: techUnlocks, error: techError } = await supabase
    .from("player_tech")
    .select("node_id")
    .eq("owner_id", user.id);

  if (techError) {
    console.error("[resolve-raid] Failed to fetch player tech tree:", techError);
  }

  const unlockedNodes = new Set((techUnlocks || []).map((t: any) => t.node_id));
  const hasScrapMult = unlockedNodes.has("util_econ_scrap_mult_1");
  const hasContrabandMult = unlockedNodes.has("util_econ_contraband_mult_1");

  const scrapMultiplier = hasScrapMult ? 1.15 : 1.0;
  const contrabandMultiplier = hasContrabandMult ? 1.25 : 1.0;

  loot.scrap = Math.round(loot.scrap * scrapMultiplier);
  loot.contraband = Math.round(loot.contraband * contrabandMultiplier);

  // --- Base validations for both modes ---
  if (body.outcome !== "victory" && body.outcome !== "defeat") {
    return json({ success: false, error: "Invalid outcome" }, 400);
  }

  if (!Array.isArray(body.actionLog)) {
    return json({ success: false, error: "Invalid actionLog" }, 400);
  }

  if (!Number.isFinite(body.squadMaxHp) || body.squadMaxHp <= 0) {
    return json({ success: false, error: "Invalid squadMaxHp" }, 400);
  }
  if (!Number.isFinite(body.squadHp) || body.squadHp < 0 || body.squadHp > body.squadMaxHp) {
    return json({ success: false, error: "Invalid squadHp" }, 400);
  }

  if (
    !Number.isFinite(body.secondsElapsed) ||
    body.secondsElapsed < 0 ||
    body.secondsElapsed > MAX_RAID_SECONDS
  ) {
    return json({ success: false, error: "Invalid secondsElapsed" }, 400);
  }

  // Victory validation check
  if (body.outcome === "victory") {
    const secured = body.actionLog.some((e) => e?.type === "stash_secured");
    if (!secured) {
      return json({ success: false, error: "Victory claim missing stash_secured event" }, 400);
    }

    // Hardened PvP & Static NPC coordinate path + speed verifications
    if (isPvP) {
      // 1. Calculate spawn point
      const eps = coerceEntryPoints(entryPoints, gridSize);
      const firstEp = eps[0];
      let spawn = { x: 1, y: 1 };
      if (firstEp) {
        const max = gridSize - 1;
        switch (firstEp.wall) {
          case 'north': spawn = { x: firstEp.position, y: 1 }; break;
          case 'south': spawn = { x: firstEp.position, y: max - 1 }; break;
          case 'east':  spawn = { x: max - 1,     y: firstEp.position }; break;
          case 'west':  spawn = { x: 1,           y: firstEp.position }; break;
        }
      }

      // 2. Project target stash coordinates
      const stash = {
        x: spawn.x < gridSize / 2 ? gridSize - 3 : 2,
        y: spawn.y < gridSize / 2 ? gridSize - 3 : 2
      };

      // 3. Verify squad reached the computed stash tile in their action log
      const reachedStash = body.actionLog.some((e) => 
        (e?.type === "move" && e?.data?.gridX === stash.x && e?.data?.gridY === stash.y) ||
        (e?.type === "stash_entered")
      );
      if (!reachedStash) {
        return json({ success: false, error: "Illegal victory claim: squad never reached the loot stash tile" }, 400);
      }

      // 4. Check for speed hacks: require realistic time delta per step (at least 100ms per tile step)
      const moveEvents = body.actionLog.filter((e) => e?.type === "move");
      const minDuration = moveEvents.length * 0.1;
      if (body.secondsElapsed < minDuration) {
        return json({ success: false, error: "Movement speed violation detected" }, 400);
      }
    } else if (FIXTURES[body.fixtureId]) {
      // Static NPC fixture validation
      const stash = FIXTURES[body.fixtureId].stash;
      const reachedStash = body.actionLog.some((e) => 
        (e?.type === "move" && e?.data?.gridX === stash.x && e?.data?.gridY === stash.y) ||
        (e?.type === "stash_entered")
      );
      if (!reachedStash) {
        return json({ success: false, error: "Illegal victory claim: squad never reached the loot stash tile" }, 400);
      }

      // Speed check for NPC
      const moveEvents = body.actionLog.filter((e) => e?.type === "move");
      const minDuration = moveEvents.length * 0.1;
      if (body.secondsElapsed < minDuration) {
        return json({ success: false, error: "Movement speed violation detected" }, 400);
      }
    } else {
      // Procedural NPC target: check for speed hacks only (no exact stash coordinates without re-running generator)
      const moveEvents = body.actionLog.filter((e) => e?.type === "move");
      const minDuration = moveEvents.length * 0.1;
      if (body.secondsElapsed < minDuration) {
        return json({ success: false, error: "Movement speed violation detected" }, 400);
      }
    }
  }

  // Damage taken from HP delta — server-computed, not taken from the client.
  const damageTaken = Math.max(0, body.squadMaxHp - body.squadHp);

  // --- Commit loot + XP ---
  // Fetch inventory; auto-create with defaults if missing. Older
  // accounts that predate the 00003 `on_profile_created_inventory`
  // trigger have a profile row but no inventory row, and there's no
  // point bailing on them here — the raid's already happened and
  // crediting zero-start loot is the correct outcome. The insert
  // matches the column defaults from 00003_items_inventory.sql
  // (scrap=200, components=50, credits=100, intel=10, contraband=0).
  // Uses `maybeSingle` so "no row" isn't an error — it's expected.
  // deno-lint-ignore no-explicit-any
  let { data: inventory, error: invSelectErr } = await (supabase.from("inventories") as any)
    .select("scrap, components, credits, intel, contraband")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (invSelectErr) {
    console.warn(
      "[resolve-raid] Inventory select errored for user",
      user.id,
      "— err:",
      invSelectErr,
    );
    return json({ success: false, error: "Inventory lookup failed" }, 500);
  }

  if (!inventory) {
    console.warn(
      "[resolve-raid] No inventory row for user",
      user.id,
      "— auto-creating with defaults.",
    );
    // deno-lint-ignore no-explicit-any
    const { data: created, error: createErr } = await (supabase.from("inventories") as any)
      .insert({ owner_id: user.id })
      .select("scrap, components, credits, intel, contraband")
      .single();
    if (createErr || !created) {
      console.warn("[resolve-raid] Failed to auto-create inventory:", createErr);
      return json({ success: false, error: "Inventory not found" }, 500);
    }
    inventory = created;
  }

  const newScrap      = (inventory.scrap      ?? 0) + loot.scrap;
  const newComponents = (inventory.components ?? 0) + loot.components;
  const newCredits    = (inventory.credits    ?? 0) + loot.credits;
  const newIntel      = (inventory.intel      ?? 0) + loot.intel;
  const newContraband = (inventory.contraband ?? 0) + loot.contraband;

  const anyLoot =
    loot.scrap > 0 || loot.components > 0 || loot.credits > 0 ||
    loot.intel > 0 || loot.contraband > 0;

  if (anyLoot) {
    // deno-lint-ignore no-explicit-any
    const { error: invError } = await (supabase.from("inventories") as any)
      .update({
        scrap: newScrap,
        components: newComponents,
        credits: newCredits,
        intel: newIntel,
        contraband: newContraband,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_id", user.id);
    if (invError) return json({ success: false, error: "Failed to credit loot" }, 500);
  }

  const currentXp = profile.xp ?? 0;
  const newXp = currentXp + loot.xpGained;

  // Task 3.0.19: derive the post-raid level from the total XP. If the
  // XP gain crossed one (or several) thresholds, bump `player_level`
  // along with the XP write. The client treats the returned
  // `newPlayerLevel` as authoritative and fires a level-up toast on
  // the delta. `levelForXp` clamps to [1, MAX_PLAYER_LEVEL] and never
  // demotes — a player who somehow has `player_level > levelForXp(xp)`
  // (e.g. they used the scrap-based `upgradePlayerLevel` path from
  // task 4.0.13 before earning the XP for that level) keeps their
  // existing level.
  const derivedLevel = levelForXp(newXp);
  const newPlayerLevel = Math.max(previousPlayerLevel, derivedLevel);
  const leveledUp = newPlayerLevel > previousPlayerLevel;

  if (loot.xpGained > 0 || leveledUp) {
    const profileUpdate: Record<string, unknown> = {
      xp: newXp,
      updated_at: new Date().toISOString(),
    };
    if (leveledUp) profileUpdate.player_level = newPlayerLevel;

    // deno-lint-ignore no-explicit-any
    const { error: profError } = await (supabase.from("profiles") as any)
      .update(profileUpdate)
      .eq("id", user.id);
    if (profError) return json({ success: false, error: "Failed to grant XP" }, 500);
  }

  // --- Record raid history ---
  // deno-lint-ignore no-explicit-any
  const historyInsert: Record<string, unknown> = {
    player_id: user.id,
    target_id: body.fixtureId,
    outcome: body.outcome,
    action_log: body.actionLog,
    squad_hp: body.squadHp,
    seconds_elapsed: body.secondsElapsed,
    scrap_looted: loot.scrap,
    components_looted: loot.components,
    credits_looted: loot.credits,
  };
  
  if (isPvP) {
    historyInsert.defender_id = body.fixtureId;
  }

  // deno-lint-ignore no-explicit-any
  const { error: historyError } = await (supabase.from("raid_history") as any)
    .insert(historyInsert);
  
  if (historyError) {
    console.warn("[resolve-raid] Failed to record raid history:", historyError);
    // Non-fatal error, continue to return success for the raid itself
  }

  // --- Track quest progress ---
  if (body.outcome === "victory") {
    await trackRaidQuestProgress(supabase, user.id);
  }

  return json({
    success: true,
    validated: true,
    fixtureId: body.fixtureId,
    outcome: body.outcome,
    xpGained: loot.xpGained,
    lootScrap:      loot.scrap,
    lootComponents: loot.components,
    lootCredits:    loot.credits,
    lootIntel:      loot.intel,
    lootContraband: loot.contraband,
    lootSeed:       loot.seed,
    damageTaken,
    newScrap,
    newComponents,
    newCredits,
    newIntel,
    newContraband,
    newXp,
    previousPlayerLevel,
    newPlayerLevel,
    leveledUp,
  });
});
