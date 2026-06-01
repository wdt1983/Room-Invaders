/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { trackQuestProgress } from "@/lib/game/quests";

/**
 * Server Action to spend Intel to scout a raid target.
 * Verifies inventory balances and deducts the appropriate Intel.
 */
export async function scoutTargetAction(cost: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  // 1. Fetch inventory
  const { data: inventory, error: invError } = await (supabase.from("inventories") as any)
    .select("intel")
    .eq("owner_id", user.id)
    .single();

  if (invError || !inventory) {
    return { success: false as const, error: "Inventory not found" };
  }

  if (inventory.intel < cost) {
    return { success: false as const, error: "Insufficient Intel" };
  }

  // 2. Deduct Intel
  const newIntel = inventory.intel - cost;

  const { error: updateError } = await (supabase.from("inventories") as any)
    .update({ intel: newIntel })
    .eq("owner_id", user.id);

  if (updateError) {
    console.error("Failed to deduct Intel:", updateError);
    return { success: false as const, error: "Failed to deduct Intel" };
  }

  // 3. Track quest progress for "scout_room"
  await trackQuestProgress(supabase, user.id, "scout_room", 1);

  revalidatePath("/raid");
  return { success: true as const, newIntel };
}
