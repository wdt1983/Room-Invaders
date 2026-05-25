/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolveFixture } from "@/game/fixtures/npc-rooms";
import { RaidPrepContainer } from "@/components/game/RaidPrepContainer";

export const metadata = {
  title: "Room Invaders — Raid",
};

export default async function RaidRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch player profile for level verification
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("player_level")
    .eq("id", user.id)
    .single();

  const playerLevel = (profile as any)?.player_level ?? 1;

  const { id } = await params;
  
  // Check if target is a player UUID (PvP raid)
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

  if (isUuid) {
    const defenderId = id;
    
    // Prevent self-raiding
    if (defenderId === user.id) {
      redirect("/map");
    }

    // Fetch defender details
    const { data: defenderProfile, error: profileErr } = await (supabase.from("profiles") as any)
      .select("username, player_level, safe_mode_until")
      .eq("id", defenderId)
      .single();

    if (profileErr || !defenderProfile) {
      console.error("[RaidRoutePage] Defender profile not found:", profileErr);
      redirect("/map");
    }

    const { data: defenderRoom, error: roomErr } = await (supabase.from("rooms") as any)
      .select("grid_size, room_level, defense_rating, shield_until, entry_points")
      .eq("owner_id", defenderId)
      .single();

    if (roomErr || !defenderRoom) {
      console.error("[RaidRoutePage] Defender room not found:", roomErr);
      redirect("/map");
    }

    // Enforce Active Shield or Ceasefire (Safe Mode)
    const now = new Date();
    const isSafeMode = defenderProfile.safe_mode_until && new Date(defenderProfile.safe_mode_until) > now && defenderProfile.player_level < 5;
    const isShielded = defenderRoom.shield_until && new Date(defenderRoom.shield_until) > now;
    
    if (isSafeMode || isShielded) {
      console.warn("[RaidRoutePage] Target is protected by shield or ceasefire");
      redirect("/map");
    }

    // Enforce Daily PvP Raid Cap (max 3 received per defender in last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: incomingRaidCount, error: countErr } = await (supabase.from("raid_history") as any)
      .select("id", { count: "exact", head: true })
      .eq("defender_id", defenderId)
      .gt("created_at", oneDayAgo);

    if (countErr) {
      console.error("[RaidRoutePage] Failed to count incoming raids:", countErr);
    } else if (incomingRaidCount && incomingRaidCount >= 3) {
      console.warn("[RaidRoutePage] Target has already been raided 3 times today");
      redirect("/map");
    }

    // Create server-side service role client to securely bypass RLS and fetch traps/turrets
    const supabaseService = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch defender placed items (bypass RLS using service role)
    const { data: placedItemsData, error: itemsErr } = await supabaseService
      .from("player_items")
      .select(`
          id,
          grid_position,
          rotation,
          items ( sprite_key, footprint, type )
      `)
      .eq("owner_id", defenderId)
      .eq("placed_in_room", true);

    if (itemsErr) {
      console.error("[RaidRoutePage] Failed to fetch defender items:", itemsErr);
    }

    // Parse placed item data
    const mappedItems = (placedItemsData || []).map((dbItem: any) => {
      const itemData = Array.isArray(dbItem.items) ? dbItem.items[0] : dbItem.items;
      const storedRotation = Number.isInteger(dbItem.rotation) ? dbItem.rotation : 0;
      return {
        id: dbItem.id,
        spriteKey: itemData?.sprite_key || "bed_basic",
        gridX: dbItem.grid_position?.x ?? 0,
        gridY: dbItem.grid_position?.y ?? 0,
        footprintW: itemData?.footprint?.w ?? 1,
        footprintH: itemData?.footprint?.h ?? 1,
        rotation: ((storedRotation % 4) + 4) % 4,
        type: itemData?.type || "furniture",
      };
    });

    const gridSize = defenderRoom.grid_size ?? 10;
    const roomLevel = defenderRoom.room_level ?? 1;

    // Parse entry points
    const rawEntryPoints = defenderRoom.entry_points ?? [];
    const entryPoints = (Array.isArray(rawEntryPoints) ? rawEntryPoints : [])
      .filter((ep: any) =>
        ep &&
        typeof ep === "object" &&
        ["north", "south", "east", "west"].includes(ep.wall) &&
        ["door", "window", "vent"].includes(ep.type) &&
        Number.isInteger(ep.position) &&
        ep.position >= 0 &&
        ep.position < gridSize,
      )
      .map((ep: any) => ({ wall: ep.wall, type: ep.type, position: ep.position }));

    // Calculate PvP difficulty based on room level
    const derivedDifficulty = roomLevel < 5 ? "easy" : roomLevel < 12 ? "medium" : "hard";

    return (
      <RaidPrepContainer
        playerLevel={playerLevel}
        target={{
          id: defenderId,
          name: defenderProfile.username || "Survivor",
          difficulty: derivedDifficulty,
          isPvP: true,
          gridSize,
          entryPoints,
          placedItems: mappedItems as any,
        }}
      />
    );
  }

  // --- NPC Fixture Path (Standard or Procedural) ---
  const isProcedural = id.startsWith("procedural-");
  let fixture: any = null;
  let isProceduralLoaded = false;



  if (isProcedural) {
    const tierMatch = id.match(/procedural-tier-(\d+)/);
    const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;

    // Enforce level lock based on procedural tier
    if (playerLevel < tier) {
      redirect("/map");
    }

    // Call dynamic procedural Deno Edge Function
    const { data: genData, error: genError } = await supabase.functions.invoke("generate-npc-room", {
      body: { tier, seed: id },
    });

    if (!genError && genData && genData.success && genData.fixture) {
      fixture = genData.fixture;
      isProceduralLoaded = true;
    } else {
      console.warn("[RaidRoutePage] Procedural generator Edge Function failed or offline, falling back to static fixture:", genError || genData?.error);
      // Fallback based on tier
      const fallbackId = tier <= 3 ? "tier1-abandoned-apartment" : tier <= 7 ? "tier1-corner-store" : "tier1-corner-store";
      fixture = resolveFixture(fallbackId);
      if (tier >= 8) {
        // Construct a hard fallback variation
        fixture = {
          ...fixture,
          difficulty: "hard",
        };
      }
    }
  } else {
    fixture = resolveFixture(id);

    // Enforce level lock for static NPC fixture
    if (playerLevel < fixture.requiredLevel) {
      redirect("/raid");
    }
  }

  // Enforce 4-hour cooldown
  const { data: history } = await (supabase.from("raid_history") as any)
    .select("created_at")
    .eq("player_id", user.id)
    .eq("target_id", isProceduralLoaded ? id : fixture.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (history && history.length > 0) {
    const latestRaidAt = history[0].created_at;
    const COOLDOWN_MS = 4 * 60 * 60 * 1000;
    const availableAtMs = new Date(latestRaidAt).getTime() + COOLDOWN_MS;
    if (Date.now() < availableAtMs) {
      redirect(isProcedural ? "/map" : "/raid");
    }
  }

  return (
    <RaidPrepContainer
      playerLevel={playerLevel}
      target={{
        id: isProceduralLoaded ? id : fixture.id,
        name: fixture.name,
        difficulty: fixture.difficulty,
        gridSize: fixture.gridSize,
        entryPoints: fixture.entryPoints,
        placedItems: fixture.items || fixture.placedItems,
        stash: fixture.stash,
      }}
    />
  );
}
