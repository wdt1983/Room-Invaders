"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

/**
 * Authoritative Server Action for boss pedestal hologram setting updates.
 *
 * Verifies session authorization, validates item ownership, authoritatively
 * verifies the player has cleared the requested boss, commits settings in
 * PostgreSQL, and revalidates Next.js cache.
 */
export async function updateBossPedestalSettingsAction(
  playerItemId: string,
  settings: { color: string; flicker: number; scanlines: number; noise: number; boss: string }
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
      return { success: false as const, error: "Boss pedestal item not found." };
    }

    if (playerItem.owner_id !== user.id) {
      return { success: false as const, error: "Permission denied. You do not own this item." };
    }

    const itemData = Array.isArray(playerItem.items) ? playerItem.items[0] : playerItem.items;
    if (itemData?.sprite_key !== "furniture_boss_pedestal") {
      return { success: false as const, error: "This item is not a boss pedestal." };
    }

    // 2. Authoritative check: Verify the user has cleared the requested boss
    const allowedBosses = ["boss-ironjaw", "boss-whisper", "boss-volkov", "boss-circuit", "boss-warden"];
    if (!allowedBosses.includes(settings.boss)) {
      return { success: false as const, error: "Invalid boss selected." };
    }

    const { data: clearData, error: clearError } = await supabase
      .from("boss_clears")
      .select("id")
      .eq("player_id", user.id)
      .eq("boss_id", settings.boss)
      .limit(1);

    if (clearError || !clearData || clearData.length === 0) {
      return {
        success: false as const,
        error: "Raid authorization failed! You must defeat this boss first to unlock their holographic trophy."
      };
    }

    // 3. Validate hologram settings structure
    const color = typeof settings.color === "string" && settings.color.startsWith("#") ? settings.color : "#06b6d4";
    const flicker = typeof settings.flicker === "number" && settings.flicker >= 0 && settings.flicker <= 1 ? settings.flicker : 0.15;
    const scanlines = typeof settings.scanlines === "number" && settings.scanlines >= 0 && settings.scanlines <= 1 ? settings.scanlines : 0.40;
    const noise = typeof settings.noise === "number" && settings.noise >= 0 && settings.noise <= 1 ? settings.noise : 0.10;

    const validatedSettings = { color, flicker, scanlines, noise, boss: settings.boss };

    // 4. Update database row
    const { error: updateError } = await (supabase.from("player_items") as any)
      .update({
        hologram_settings: validatedSettings,
      })
      .eq("id", playerItemId);

    if (updateError) {
      console.error("[updateBossPedestalSettingsAction] Update failed:", updateError);
      return { success: false as const, error: "Failed to update hologram settings." };
    }

    // Revalidate paths to refresh page states
    revalidatePath("/room");

    return {
      success: true as const,
      settings: validatedSettings,
    };
  } catch (err: any) {
    console.error("[updateBossPedestalSettingsAction] Exception caught:", err);
    Sentry.captureException(err, {
      tags: { action: "updateBossPedestalSettingsAction" },
      extra: { playerItemId, settings },
    });
    return {
      success: false as const,
      error: err.message || "An unexpected error occurred during hologram update.",
    };
  }
}
