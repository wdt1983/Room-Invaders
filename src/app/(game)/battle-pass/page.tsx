/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BattlePassDashboard from "./BattlePassDashboard";

export const metadata = {
  title: "Room Invaders — Seasonal Battle Pass",
};

export default async function BattlePassPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Fetch player Battle Pass progress (with auto-healing)
  const { data: progressData, error: progressErr } = await (supabase
    .from("player_battle_pass_progress") as any)
    .select("*")
    .eq("user_id", user.id)
    .eq("season_id", "season_1")
    .maybeSingle();

  if (progressErr) {
    console.error("[BattlePassPage] Progress fetch error:", progressErr);
  }

  let progress = progressData;
  if (!progress) {
    console.warn("[BattlePassPage] Progress row missing for user", user.id, "— auto-creating...");
    const { data: newProgress, error: createErr } = await (supabase
      .from("player_battle_pass_progress") as any)
      .insert({
        user_id: user.id,
        season_id: "season_1",
        current_tier: 1,
        current_xp: 0,
        is_premium_unlocked: false,
        claimed_free_rewards: [],
        claimed_premium_rewards: [],
      })
      .select()
      .maybeSingle();

    if (createErr || !newProgress) {
      console.error("[BattlePassPage] Progress auto-creation failed:", createErr);
      // Fallback in-memory progress to prevent crash
      progress = {
        user_id: user.id,
        season_id: "season_1",
        current_tier: 1,
        current_xp: 0,
        is_premium_unlocked: false,
        claimed_free_rewards: [],
        claimed_premium_rewards: [],
      };
    } else {
      progress = newProgress;
    }
  }

  // 2. Fetch all Tiers + Rewards + joined Catalog Items details
  const { data: rawTiers, error: tiersErr } = await (supabase
    .from("battle_pass_tiers") as any)
    .select(`
      season_id,
      tier_number,
      required_xp,
      battle_pass_rewards (
        id,
        season_id,
        tier_number,
        is_premium,
        reward_type,
        reward_amount,
        item_id,
        items (
          name,
          description,
          type,
          sprite_key
        )
      )
    `)
    .eq("season_id", "season_1")
    .order("tier_number", { ascending: true });

  if (tiersErr || !rawTiers) {
    console.error("[BattlePassPage] Tiers fetch error:", tiersErr);
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground p-4">
        <h2 className="text-lg font-bold">Failed to load seasonal data</h2>
        <p className="text-xs text-muted-foreground mt-1">Please ensure database migrations are fully applied.</p>
      </div>
    );
  }

  // Map rewards formatting for single-item vs list object anomalies
  const formattedTiers = (rawTiers as any[]).map((tier) => {
    const rewards = (tier.battle_pass_rewards || []).map((reward: any) => {
      let itemsData = reward.items;
      if (Array.isArray(itemsData)) {
        itemsData = itemsData[0];
      }
      return {
        ...reward,
        items: itemsData || null,
      };
    });

    return {
      ...tier,
      battle_pass_rewards: rewards,
    };
  });

  return (
    <BattlePassDashboard
      initialProgress={progress}
      tiers={formattedTiers}
    />
  );
}
