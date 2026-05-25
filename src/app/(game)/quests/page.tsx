/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/(game)/quests/page.tsx
//
// Phase 4 Task 4.0.7 — Quest Board page.
// Next.js Server Component that fetches player quest progress, seeds available quests
// defensively, and mounts the premium Client Component QuestDashboard.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seedInitialQuests } from "@/lib/game/quests";
import QuestDashboard from "./QuestDashboard";
import questsData from "@/game/fixtures/quests.json";

export const metadata = {
  title: "Room Invaders — Quest Board",
};

export default async function QuestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 1. Fetch player level from profiles table
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("player_level")
    .eq("id", user.id)
    .single();

  const playerLevel = profile?.player_level ?? 1;

  // 2. Fetch existing quests for the player
  const { data: existingQuests, error: fetchErr } = await (supabase.from("player_quests") as any)
    .select("quest_id")
    .eq("player_id", user.id);

  if (fetchErr) {
    console.error("[QuestsPage] Failed to fetch player quests:", fetchErr);
  }

  const existingIds = new Set((existingQuests ?? []).map((q: any) => q.quest_id));

  // 3. Defensive Quest Seeding on load
  // A. Seed onboarding tut-01 if missing
  if (!existingIds.has("tut-01")) {
    await seedInitialQuests(supabase, user.id);
  }

  // B. Seed daily quests matching player level (only if user has 0 daily quests in history)
  const hasDailies = (existingQuests ?? []).some((q: any) => q.quest_id.startsWith("daily-"));
  if (!hasDailies) {
    const dailyQuestsToSeed = questsData.daily
      .filter((q) => playerLevel >= q.requiredLevel)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
      
    if (dailyQuestsToSeed.length > 0) {
      const dailyInserts = dailyQuestsToSeed.map((q: any) => ({
        player_id: user.id,
        quest_id: q.id,
        status: "active",
        progress: 0,
        target_value: q.targetValue,
      }));
      await (supabase.from("player_quests") as any).insert(dailyInserts);
    }
  }

  // C. Seed weekly quests matching player level (only if user has 0 weekly quests in history)
  const hasWeeklies = (existingQuests ?? []).some((q: any) => q.quest_id.startsWith("weekly-"));
  if (!hasWeeklies) {
    const weeklyQuestsToSeed = questsData.weekly.filter(
      (q) => playerLevel >= q.requiredLevel
    );
    if (weeklyQuestsToSeed.length > 0) {
      const weeklyInserts = weeklyQuestsToSeed.map((q: any) => ({
        player_id: user.id,
        quest_id: q.id,
        status: "active",
        progress: 0,
        target_value: q.targetValue,
      }));
      await (supabase.from("player_quests") as any).insert(weeklyInserts);
    }
  }

  // 4. Refetch full dynamic quest data to pass to Client Dashboard
  const { data: finalQuests } = await (supabase.from("player_quests") as any)
    .select("quest_id, status, progress, target_value, completed_at, claimed_at")
    .eq("player_id", user.id);

  return (
    <QuestDashboard 
      initialQuests={finalQuests || []} 
      playerLevel={playerLevel}
    />
  );
}
