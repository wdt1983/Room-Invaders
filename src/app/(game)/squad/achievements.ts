/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Fetches all achievements for the logged-in user, combined with their catalog specifications.
 */
export async function getAchievementsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  const { data, error } = await (supabase.from("player_achievements") as any)
    .select(`
      progress, 
      is_unlocked, 
      unlocked_at, 
      achievement_catalog ( 
        id, 
        name, 
        description, 
        target_metric, 
        target_value, 
        reward_type, 
        reward_code 
      )
    `)
    .eq("user_id", user.id);

  if (error) {
    console.error("[achievements] Failed to fetch achievements:", error);
    return { success: false as const, error: "Failed to load achievements" };
  }

  // Flatten the response for easier component ingestion
  const achievements = (data || []).map((row: any) => {
    const catalog = Array.isArray(row.achievement_catalog) ? row.achievement_catalog[0] : row.achievement_catalog;
    return {
      id: catalog?.id,
      name: catalog?.name,
      description: catalog?.description,
      targetMetric: catalog?.target_metric,
      targetValue: catalog?.target_value,
      rewardType: catalog?.reward_type,
      rewardCode: catalog?.reward_code,
      progress: row.progress,
      isUnlocked: row.is_unlocked,
      unlockedAt: row.unlocked_at,
    };
  });

  return { success: true as const, achievements };
}

/**
 * Equips a visual cosmetic reward (badge, frame border, or room skin) to the player's profile.
 * Rigidly validates that the corresponding achievement has actually been unlocked by the caller.
 */
export async function equipCosmeticAction(
  type: "badge" | "border" | "room_skin",
  code: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  // 1. Authorization: Verify that the player has unlocked the achievement rewarding this code
  if (code !== null) {
    const { data: unlockedCheck, error: checkError } = await (supabase.from("player_achievements") as any)
      .select(`
        is_unlocked, 
        achievement_catalog!inner(reward_type, reward_code)
      `)
      .eq("user_id", user.id)
      .eq("is_unlocked", true)
      .eq("achievement_catalog.reward_type", type)
      .eq("achievement_catalog.reward_code", code)
      .limit(1);

    if (checkError || !unlockedCheck || unlockedCheck.length === 0) {
      return { 
        success: false as const, 
        error: "This cosmetic is currently locked. Complete the required milestone targets to unlock it!" 
      };
    }
  }

  // 2. Perform the profile customize write
  const updatePayload: any = {};
  if (type === "badge") updatePayload.active_badge = code;
  else if (type === "border") updatePayload.active_border = code;
  else if (type === "room_skin") updatePayload.active_room_skin = code;
  updatePayload.updated_at = new Date().toISOString();

  const { error: updateError } = await (supabase.from("profiles") as any)
    .update(updatePayload)
    .eq("id", user.id);

  if (updateError) {
    console.error("[achievements] Failed to update active cosmetic:", updateError);
    return { success: false as const, error: "Failed to equip cosmetic reward" };
  }

  // Force Next.js router cache reload
  revalidatePath("/squad");
  revalidatePath("/room");

  return { 
    success: true as const, 
    activeBadge: type === "badge" ? code : undefined,
    activeBorder: type === "border" ? code : undefined,
    activeRoomSkin: type === "room_skin" ? code : undefined
  };
}
