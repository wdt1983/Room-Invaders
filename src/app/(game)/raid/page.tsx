/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Crosshair } from "lucide-react";
import { NPC_ROOM_LIST } from "@/game/fixtures/npc-rooms";
import { RaidTargetCard } from "./RaidTargetCard";

export const metadata = {
  title: "Room Invaders — Raid Targets",
};

// 4 hours in milliseconds
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

export default async function RaidListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch player level
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("player_level")
    .eq("id", user.id)
    .single();
  
  const playerLevel = (profile as any)?.player_level ?? 1;

  // Fetch raid history for cooldowns
  const { data: history } = await (supabase.from("raid_history") as any)
    .select("target_id, created_at")
    .eq("player_id", user.id)
    .order("created_at", { ascending: false });

  const latestRaids: Record<string, string> = {};
  if (history) {
    for (const row of history) {
      if (!latestRaids[row.target_id]) {
        latestRaids[row.target_id] = row.created_at;
      }
    }
  }

  return (
    <div className="container mx-auto h-full max-w-6xl overflow-y-auto p-6">
      <div className="mb-8 flex items-center gap-3">
        <Crosshair className="size-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Raid Targets</h1>
      </div>

      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Hand-authored NPC fixtures for Phase 3 scaffolding. Full procedural
        generation lands with task 6.0.8; PvP targets with Phase 5.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {NPC_ROOM_LIST.map((fixture) => {
          const latestRaidAt = latestRaids[fixture.id];
          let availableAtMs: number | null = null;
          
          if (latestRaidAt) {
            const raidTimeMs = new Date(latestRaidAt).getTime();
            availableAtMs = raidTimeMs + COOLDOWN_MS;
          }

          return (
            <RaidTargetCard 
              key={fixture.id} 
              fixture={fixture} 
              playerLevel={playerLevel}
              availableAtMs={availableAtMs}
            />
          );
        })}
      </div>
    </div>
  );
}
