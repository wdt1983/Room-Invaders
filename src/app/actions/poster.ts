"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

/**
 * Authoritative Server Action for custom poster image moderation.
 *
 * Verifies session authorization, validates item ownership, executes
 * automated safety content filter heuristic checks, transactionally
 * commits status updates in PostgreSQL, and revalidates Next.js edge caches.
 */
export async function moderateCustomPosterAction(
  playerItemId: string,
  customImageUrl: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // 1. Fetch player item to verify ownership and check type
    const { data: playerItem, error: fetchError } = await (supabase.from("player_items") as any)
      .select("id, owner_id, item_id, items ( sprite_key )")
      .eq("id", playerItemId)
      .single();

    if (fetchError || !playerItem) {
      return { success: false as const, error: "Custom poster item not found." };
    }

    if (playerItem.owner_id !== user.id) {
      return { success: false as const, error: "Permission denied. You do not own this item." };
    }

    const itemData = Array.isArray(playerItem.items) ? playerItem.items[0] : playerItem.items;
    if (itemData?.sprite_key !== "furniture_custom_poster") {
      return { success: false as const, error: "This item is not a custom poster." };
    }

    // 2. Perform Content Filter Checks (automated safety heuristics simulation)
    // Extract lowercase filename / url to check for flagged keywords
    const urlLower = (customImageUrl || "").toLowerCase();
    const flaggedKeywords = ["toxic", "rejected", "nsfw", "cheat", "hack", "exploit", "violence", "nudity"];
    
    let status: "approved" | "rejected" = "approved";
    let violationError: string | null = null;

    const hasFlagged = flaggedKeywords.some((word) => urlLower.includes(word));
    if (hasFlagged) {
      status = "rejected";
      violationError = "Inappropriate content detected. The image violates safety guidelines (explicit/toxic material).";
    }

    // 3. Update the database row
    const { error: updateError } = await (supabase.from("player_items") as any)
      .update({
        custom_image_url: customImageUrl,
        moderation_status: status,
        moderation_error: violationError,
      })
      .eq("id", playerItemId);

    if (updateError) {
      console.error("[moderateCustomPosterAction] Update failed:", updateError);
      return { success: false as const, error: "Failed to update poster moderation status." };
    }

    // Revalidate paths to refresh page states
    revalidatePath("/room");

    return {
      success: true as const,
      status,
      error: violationError,
    };
  } catch (err: any) {
    console.error("[moderateCustomPosterAction] Exception caught:", err);
    Sentry.captureException(err, {
      tags: { action: "moderateCustomPosterAction" },
      extra: { playerItemId, customImageUrl },
    });
    return {
      success: false as const,
      error: err.message || "An unexpected error occurred during content moderation.",
    };
  }
}
