// src/app/(game)/raid/replay/[historyId]/page.tsx
//
// Phase 5 Task 5.0.10 — Raid Replay playback harness route.
// Loads a historical raid from the database and initializes read-only Phaser playback.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameWrapper } from "@/components/game/GameWrapper";
import { RaidInitializer } from "@/components/game/RaidInitializer";
import { resolveFixture } from "@/game/fixtures/npc-rooms";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, ShieldAlert } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Room Invaders — Replay Viewer",
};

export default async function ReplayRoutePage({
  params,
}: {
  params: Promise<{ historyId: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { historyId } = await params;

  // Fetch the historical raid record (viewable by attacker or defender)
  const { data: history, error: histErr } = await (supabase.from("raid_history") as any)
    .select(`
      id,
      player_id,
      defender_id,
      target_id,
      outcome,
      action_log,
      seconds_elapsed,
      squad_hp,
      scrap_looted,
      components_looted
    `)
    .eq("id", historyId)
    .single();

  if (histErr || !history) {
    console.error("[ReplayRoutePage] Raid history record not found:", histErr);
    redirect("/room");
  }

  const isPvP = !!history.defender_id;
  let gridSize = 10;
  let entryPoints: any[] = [];
  let placedItems: any[] = [];
  let name = "NPC Room";
  let difficulty: "easy" | "medium" | "hard" = "easy";

  if (isPvP) {
    // PvP Replay: Load the defender's layout
    const defenderId = history.defender_id;

    // Fetch defender details
    const { data: defenderProfile } = await (supabase.from("profiles") as any)
      .select("username, player_level")
      .eq("id", defenderId)
      .single();

    name = defenderProfile?.username || "Survivor";

    const { data: defenderRoom } = await (supabase.from("rooms") as any)
      .select("grid_size, room_level, entry_points")
      .eq("owner_id", defenderId)
      .single();

    if (defenderRoom) {
      gridSize = defenderRoom.grid_size ?? 10;
      const roomLevel = defenderRoom.room_level ?? 1;
      difficulty = roomLevel < 5 ? "easy" : roomLevel < 12 ? "medium" : "hard";

      // Parse entry points
      const rawEntryPoints = defenderRoom.entry_points ?? [];
      entryPoints = (Array.isArray(rawEntryPoints) ? rawEntryPoints : [])
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
    }

    // Fetch defender placed items (at the time, we load their current layout to recreate the room)
    const { data: placedItemsData } = await supabase
      .from("player_items")
      .select(`
          id,
          grid_position,
          rotation,
          items ( sprite_key, footprint, type )
      `)
      .eq("owner_id", defenderId)
      .eq("placed_in_room", true);

    placedItems = (placedItemsData || []).map((dbItem: any) => {
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

  } else {
    // NPC Replay: Load the NPC fixture layout
    const fixture = resolveFixture(history.target_id);
    name = fixture.name;
    difficulty = fixture.difficulty;
    gridSize = fixture.gridSize;
    entryPoints = fixture.entryPoints;
    placedItems = fixture.items.map((item: any, index: number) => ({
      id: `npc-item-${index}`,
      spriteKey: item.spriteKey,
      gridX: item.gridX,
      gridY: item.gridY,
      footprintW: item.footprintW,
      footprintH: item.footprintH,
      rotation: item.rotation,
      type: item.type,
    }));
  }

  return (
    <div className="relative h-full w-full">
      {/* Hydrate Store in Replay Mode */}
      <RaidInitializer
        target={{
          id: history.target_id || history.defender_id,
          name,
          difficulty,
          isPvP,
          gridSize,
          entryPoints,
          placedItems,
          isReplay: true,
          replayActionLog: history.action_log as any[],
        }}
      />
      <GameWrapper />

      {/* Premium Glassmorphic Replay HUD Overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-between p-4 font-sans select-none">
        <div className="pointer-events-auto flex items-center gap-3 bg-card/60 backdrop-blur border border-primary/20 px-4 py-2 rounded-2xl shadow-xl">
          <Link href="/room">
            <Button variant="ghost" size="icon-sm" className="size-8 rounded-full text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 leading-tight">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Security Feed: {name}
            </h3>
            <p className="text-[10px] text-muted-foreground leading-normal">
              Async Playback Mode • {isPvP ? "PvP Stronghold" : "NPC Target"}
            </p>
          </div>
        </div>

        <div className="bg-card/60 backdrop-blur border border-primary/20 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2">
          <Play className="size-4 text-cyan-400 animate-pulse" />
          <span className="text-[10px] font-bold text-foreground tracking-wider uppercase">
            Intrusion Playback
          </span>
        </div>
      </div>

      {/* Floating Replay Watermark */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center select-none opacity-[0.03]">
        <div className="text-9xl font-black tracking-widest text-foreground uppercase border-8 border-foreground p-10 transform -rotate-12">
          REPLAY
        </div>
      </div>
    </div>
  );
}
