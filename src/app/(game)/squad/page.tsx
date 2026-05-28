import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SquadDashboard from "./SquadDashboard";

export const metadata = {
  title: "Room Invaders — Tactical Command",
};

export default async function SquadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch player profile level & active cosmetics
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("player_level, active_badge, active_border, active_room_skin")
    .eq("id", user.id)
    .single();

  const playerLevel = profile?.player_level ?? 1;

  return (
    <SquadDashboard 
      initialPlayerLevel={playerLevel} 
      initialActiveBadge={profile?.active_badge ?? null}
      initialActiveBorder={profile?.active_border ?? null}
      initialActiveRoomSkin={profile?.active_room_skin ?? null}
    />
  );
}
