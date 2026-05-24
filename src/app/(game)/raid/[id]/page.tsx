/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameWrapper } from "@/components/game/GameWrapper";
import { RaidInitializer } from "@/components/game/RaidInitializer";
import { RaidHUD } from "@/components/game/RaidHUD";
import { RaidResults } from "@/components/game/RaidResults";
import { RaidResolver } from "@/components/game/RaidResolver";
import { resolveFixture } from "@/game/fixtures/npc-rooms";

export const metadata = {
  title: "Room Invaders — Raid",
};

/**
 * Raid route shell (tasks 3.0.13 + 3.0.15). SSR resolves the fixture by id,
 * then hands off to the client: {@link RaidInitializer} flips
 * {@link useRaidStore} into `'prep'` phase, {@link GameWrapper} boots
 * RaidScene (BootScene picks by URL pathname), and the two overlays render
 * the timer + results UI on top.
 *
 * Unknown `id` values fall back to the default fixture so the map's "Scout
 * Base" button (profile UUID → no fixture match) still lands in a playable
 * raid. Real NPC-room-per-profile association is task 6.0.8.
 */
export default async function RaidRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const fixture = resolveFixture(id);

  // Fetch player profile for level verification
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("player_level")
    .eq("id", user.id)
    .single();

  const playerLevel = (profile as any)?.player_level ?? 1;

  // Enforce level lock
  if (playerLevel < fixture.requiredLevel) {
    redirect("/raid");
  }

  // Enforce 4-hour cooldown
  const { data: history } = await (supabase.from("raid_history") as any)
    .select("created_at")
    .eq("player_id", user.id)
    .eq("target_id", fixture.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (history && history.length > 0) {
    const latestRaidAt = history[0].created_at;
    const COOLDOWN_MS = 4 * 60 * 60 * 1000;
    const availableAtMs = new Date(latestRaidAt).getTime() + COOLDOWN_MS;
    // eslint-disable-next-line react-hooks/purity
    if (Date.now() < availableAtMs) {
      redirect("/raid");
    }
  }

  return (
    <div className="relative h-full w-full">
      <RaidInitializer
        target={{
          id: fixture.id,
          name: fixture.name,
          difficulty: fixture.difficulty,
        }}
      />
      <GameWrapper />
      <RaidHUD />
      <RaidResults />
      <RaidResolver />
    </div>
  );
}
