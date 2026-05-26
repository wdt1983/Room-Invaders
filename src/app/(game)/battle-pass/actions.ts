/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Action to claim a Battle Pass reward.
 * Invokes the atomic `claim_battle_pass_reward` DB procedure.
 */
export async function claimRewardAction(tierNumber: number, isPremium: boolean) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  try {
    const { data, error } = await supabase.rpc("claim_battle_pass_reward", {
      p_user_id: user.id,
      p_tier_number: tierNumber,
      p_is_premium: isPremium,
    });

    if (error) {
      console.error("[claimRewardAction] Database error:", error);
      return { success: false as const, error: error.message };
    }

    const result = data as any;
    if (!result || !result.success) {
      return { success: false as const, error: result?.error || "Failed to claim reward" };
    }

    revalidatePath("/squad");
    revalidatePath("/battle-pass");
    revalidatePath("/room");

    return {
      success: true as const,
      claimedFreeRewards: result.claimed_free_rewards,
      claimedPremiumRewards: result.claimed_premium_rewards,
      newInventory: result.new_inventory,
    };
  } catch (err: any) {
    console.error("[claimRewardAction] Connection error:", err);
    return { success: false as const, error: "Connection error claiming reward" };
  }
}

/**
 * Server Action to unlock the Premium Battle Pass (costs 500 Credits).
 * Invokes the atomic `unlock_premium_battle_pass` DB procedure.
 */
export async function unlockPremiumPassAction() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  try {
    const { data, error } = await supabase.rpc("unlock_premium_battle_pass", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("[unlockPremiumPassAction] Database error:", error);
      return { success: false as const, error: error.message };
    }

    const result = data as any;
    if (!result || !result.success) {
      return { success: false as const, error: result?.error || "Failed to unlock Premium Pass" };
    }

    revalidatePath("/squad");
    revalidatePath("/battle-pass");
    revalidatePath("/room");

    return {
      success: true as const,
      isPremiumUnlocked: result.is_premium_unlocked,
      newCredits: result.new_credits,
    };
  } catch (err: any) {
    console.error("[unlockPremiumPassAction] Connection error:", err);
    return { success: false as const, error: "Connection error unlocking Premium Pass" };
  }
}

/**
 * Server Action to skip a Battle Pass tier (costs 100 Credits).
 * Invokes the atomic `buy_battle_pass_tier` DB procedure.
 */
export async function buyTierAction() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  try {
    const { data, error } = await supabase.rpc("buy_battle_pass_tier", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("[buyTierAction] Database error:", error);
      return { success: false as const, error: error.message };
    }

    const result = data as any;
    if (!result || !result.success) {
      return { success: false as const, error: result?.error || "Failed to skip tier" };
    }

    revalidatePath("/squad");
    revalidatePath("/battle-pass");
    revalidatePath("/room");

    return {
      success: true as const,
      newTier: result.new_tier,
      newCredits: result.new_credits,
    };
  } catch (err: any) {
    console.error("[buyTierAction] Connection error:", err);
    return { success: false as const, error: "Connection error skipping tier" };
  }
}
