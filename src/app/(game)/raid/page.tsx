/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Crosshair, Skull } from "lucide-react";
import { NPC_ROOM_LIST, BOSS_ROOM_LIST } from "@/game/fixtures/npc-rooms";
import { RaidTargetCard } from "./RaidTargetCard";

export const metadata = {
  title: "Room Invaders — Raid Targets",
};

// Cooldown configurations
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours for standard runs
const BOSS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours for boss strongholds

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

  // Fetch standard raid history for standard target cooldowns
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

  // Fetch boss clears for stronghold cooldowns
  const { data: bossClears } = await supabase
    .from("boss_clears")
    .select("boss_id, cleared_at")
    .eq("player_id", user.id);

  const latestBossClears: Record<string, string> = {};
  if (bossClears) {
    for (const row of bossClears as any[]) {
      if (!latestBossClears[row.boss_id] || new Date(row.cleared_at) > new Date(latestBossClears[row.boss_id])) {
        latestBossClears[row.boss_id] = row.cleared_at;
      }
    }
  }

  return (
    <div className="container mx-auto h-full max-w-6xl overflow-y-auto p-6 pb-12">
      {/* Page Title */}
      <div className="mb-6 flex items-center gap-3">
        <Crosshair className="size-8 text-primary animate-pulse" />
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
          Tactical War Room
        </h1>
      </div>

      {/* Immersive Copy */}
      <p className="mb-10 max-w-3xl text-sm leading-relaxed text-muted-foreground/80 border-l-2 border-primary/30 pl-4 bg-primary/5 py-3 rounded-r-md">
        Breach hostile sectors, bypass coordinate defenses, and secure vital raw materials.
        Stronghold Warlords control high-value manufacturing hubs—defeat them to earn guaranteed legendary blueprints, scrap bounties, and massive experience multipliers.
      </p>

      {/* 1. Tactical Sectors Section */}
      <div className="mb-12">
        <div className="mb-6 flex items-center gap-2 border-b border-border/40 pb-2">
          <Crosshair className="size-5 text-emerald-400" />
          <h2 className="text-lg font-bold tracking-tight text-emerald-400">Tactical Sectors</h2>
          <span className="ml-2 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Standard Runs
          </span>
        </div>
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

      {/* 2. Stronghold Warlords Section */}
      <div>
        <div className="mb-6 flex items-center gap-2 border-b border-border/40 pb-2">
          <Skull className="size-5 text-rose-500 animate-pulse" />
          <h2 className="text-lg font-bold tracking-tight text-rose-500">Stronghold Warlords</h2>
          <span className="ml-2 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
            Act Bosses
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {BOSS_ROOM_LIST.map((fixture) => {
            const latestRaidAt = latestBossClears[fixture.id];
            let availableAtMs: number | null = null;
            
            if (latestRaidAt) {
              const raidTimeMs = new Date(latestRaidAt).getTime();
              availableAtMs = raidTimeMs + BOSS_COOLDOWN_MS;
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
    </div>
  );
}
