// src/app/(game)/quests/actions.ts
//
// Phase 4 Task 4.0.11 — Tutorial Quest sequence completion hooks.
// Exposes Server Actions to trigger progression on interactive UI events (briefings).

"use server";

import { createClient } from "@/lib/supabase/server";
import { trackQuestProgress } from "@/lib/game/quests";

export async function completeSafeModeBriefing() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  // Trigger quest progress for safe_mode_briefing
  await trackQuestProgress(supabase, user.id, 'safe_mode_briefing', 1);

  return { success: true as const };
}

export async function deactivateSafeMode() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  const nowString = new Date().toISOString();

  // Authoritatively update safe_mode_until to current time in profiles
  const { error } = await (supabase.from('profiles') as any)
    .update({ safe_mode_until: nowString })
    .eq('id', user.id);

  if (error) {
    console.error("[Actions] Failed to deactivate safe mode:", error);
    return { success: false as const, error: error.message };
  }

  return { success: true as const, safeModeUntil: nowString };
}
