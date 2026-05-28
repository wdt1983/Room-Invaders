/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CommunityEvent {
  id: string;
  eventType: 'sector_blackout' | 'turret_malfunction' | 'double_scrap' | 'scrap_frenzy';
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'active' | 'ended';
  parameters: Record<string, any>;
  rewards: Record<string, any>;
}

/**
 * Fetch the currently active community event, if any.
 * Checks for status = 'active' or time-validity as fallback.
 */
export async function getActiveEvent(): Promise<CommunityEvent | null> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data: event, error } = await (supabase.from("community_events") as any)
      .select("*")
      .or(`status.eq.active,and(starts_at.lte.${now},ends_at.gt.${now})`)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[getActiveEvent] DB fetch error:", error);
      return null;
    }

    if (!event) return null;

    return {
      id: event.id,
      eventType: event.event_type,
      title: event.title,
      description: event.description,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      status: event.status,
      parameters: event.parameters || {},
      rewards: event.rewards || {},
    };
  } catch (err) {
    console.error("[getActiveEvent] Exception caught:", err);
    return null;
  }
}

/**
 * Log player contribution progress toward an active event (e.g. raids completed).
 */
export async function contributeToEvent(eventId: string, progressDelta: { raidsCompleted?: number; contribution?: number }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // 1. Get current contribution row, or insert default
    const { data: existing, error: fetchErr } = await (supabase.from("player_event_contributions") as any)
      .select("*")
      .eq("event_id", eventId)
      .eq("profile_id", user.id)
      .maybeSingle();

    const currentProgress = existing?.progress || { raids_completed: 0, contribution: 0 };
    
    const newProgress = {
      raids_completed: (currentProgress.raids_completed || 0) + (progressDelta.raidsCompleted || 0),
      contribution: (currentProgress.contribution || 0) + (progressDelta.contribution || 0),
    };

    const { error: upsertErr } = await (supabase.from("player_event_contributions") as any)
      .upsert({
        event_id: eventId,
        profile_id: user.id,
        progress: newProgress,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "event_id,profile_id"
      });

    if (upsertErr) {
      console.error("[contributeToEvent] Upsert failed:", upsertErr);
      return { success: false, error: "Failed to submit event contribution" };
    }

    revalidatePath("/map");
    return { success: true, progress: newProgress };
  } catch (err: any) {
    console.error("[contributeToEvent] Exception caught:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
