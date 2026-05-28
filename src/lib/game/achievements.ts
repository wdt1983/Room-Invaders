/* eslint-disable @typescript-eslint/no-explicit-any */
import type { createClient } from "@/lib/supabase/server";

/**
 * Monitors scrap expenditures and records progress toward the "Double Spender" achievement.
 * If the user spends scrap within 30 seconds of a successful raid victory, we increment
 * `spend_count_after_victory`. Once it hits 2, we authoritatively unlock the achievement.
 */
export async function recordScrapSpend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<void> {
  try {
    // 1. Fetch inventories to check last_victory_at and spend_count_after_victory
    const { data: inventory, error: invError } = await (supabase.from("inventories") as any)
      .select("last_victory_at, spend_count_after_victory")
      .eq("owner_id", userId)
      .single();

    if (invError || !inventory) {
      console.warn("[achievements] Failed to find inventory for user spend check:", invError);
      return;
    }

    if (!inventory.last_victory_at) return;

    const lastVictory = new Date(inventory.last_victory_at);
    const now = new Date();
    const diffMs = now.getTime() - lastVictory.getTime();
    
    // Within 30 seconds of a successful raid
    if (diffMs >= 0 && diffMs <= 30000) {
      const nextCount = inventory.spend_count_after_victory + 1;
      
      // Update spend count in inventories
      await (supabase.from("inventories") as any)
        .update({ spend_count_after_victory: nextCount })
        .eq("owner_id", userId);

      console.log(`[achievements] Scrap spend recorded within 30s of raid. Count: ${nextCount}/2 for user ${userId}`);

      if (nextCount >= 2) {
        // Unlock the 'double_spent_scrap' achievement in player_achievements!
        const { error: unlockErr } = await (supabase.from("player_achievements") as any)
          .update({
            progress: 1,
            is_unlocked: true,
            unlocked_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq("user_id", userId)
          .eq("achievement_id", "double_spent_scrap")
          .eq("is_unlocked", false); // Only update if not already unlocked

        if (unlockErr) {
          console.error("[achievements] Failed to unlock double_spent_scrap achievement:", unlockErr);
        } else {
          console.log(`[achievements] CONGRATULATIONS! User ${userId} unlocked 'Double Spender'!`);
        }
      }
    }
  } catch (err) {
    console.error("[achievements] Error recording scrap spend progress:", err);
  }
}
