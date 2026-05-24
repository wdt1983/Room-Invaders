/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/game/quests.ts
//
// Phase 4 task 4.0.8 — server-authoritative quest tracking.
// Coordinates real-time progress increments on player actions (placing items,
// finishing raids, leveling up) and handles sequential tutorial unlocks.

import questsData from '@/game/fixtures/quests.json';

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  targetValue: number;
  requiredLevel: number;
  xpReward: number;
  rewards: {
    scrap?: number;
    components?: number;
    credits?: number;
    intel?: number;
    contraband?: number;
  };
  unlockSequence?: string | null;
}

const allQuests: {
  tutorial: QuestDefinition[];
  daily: QuestDefinition[];
  weekly: QuestDefinition[];
} = questsData as any;

// Helper to find a quest definition by ID across all categories
export function findQuestDefinition(questId: string): QuestDefinition | null {
  const categories = [allQuests.tutorial, allQuests.daily, allQuests.weekly];
  for (const list of categories) {
    const found = list.find((q) => q.id === questId);
    if (found) return found;
  }
  return null;
}

/**
 * Seed the first tutorial quest ("tut-01" - "Wake Up") for a player.
 * Safe to call repeatedly (idempotent due to unique index).
 */
export async function seedInitialQuests(supabase: any, userId: string): Promise<void> {
  const tut01 = allQuests.tutorial.find((q) => q.id === 'tut-01');
  if (!tut01) return;

  try {
    // Check if player already has any quests to avoid double seeding
    const { data: existing } = await supabase
      .from('player_quests')
      .select('id')
      .eq('player_id', userId)
      .eq('quest_id', 'tut-01')
      .maybeSingle();

    if (!existing) {
      await supabase.from('player_quests').insert({
        player_id: userId,
        quest_id: 'tut-01',
        status: 'active',
        progress: 0,
        target_value: tut01.targetValue,
      });
      console.log(`[QuestSystem] Seeded tut-01 for user: ${userId}`);
    }
  } catch (err) {
    console.error('[QuestSystem] Failed to seed initial quests:', err);
  }
}

/**
 * Authoritative utility to update progress on a player's active quests.
 * Triggered by key gameplay milestones (buying items, winning raids, etc.).
 *
 * @param supabase Authenticated Supabase client (service role or user scoped)
 * @param userId UUID of the player
 * @param category The event category (e.g., 'place_furniture', 'raid_fixture')
 * @param amount Amount to increment progress by, or absolute value if isAbsolute is true
 * @param isAbsolute If true, overrides progress with amount instead of adding
 */
export async function trackQuestProgress(
  supabase: any,
  userId: string,
  category: string,
  amount: number,
  isAbsolute = false
): Promise<void> {
  try {
    // 1. Fetch active quests for the player
    const { data: activeQuests, error } = await supabase
      .from('player_quests')
      .select('id, quest_id, progress, target_value')
      .eq('player_id', userId)
      .eq('status', 'active');

    if (error || !activeQuests || activeQuests.length === 0) {
      return;
    }

    for (const quest of activeQuests) {
      const questDef = findQuestDefinition(quest.quest_id);
      
      // Matches categories: specific category matching (e.g. 'place_furniture') 
      // or generic 'place_any' matches both 'place_furniture' and 'place_defense'
      const isMatch = 
        questDef?.category === category || 
        (questDef?.category === 'place_any' && ['place_furniture', 'place_defense'].includes(category));

      if (!isMatch || !questDef) {
        continue;
      }

      // Calculate new progress
      const targetVal = quest.target_value;
      const currentProgress = quest.progress;
      let newProgress = isAbsolute ? amount : currentProgress + amount;
      
      // Clamp bounds
      newProgress = Math.max(0, Math.min(newProgress, targetVal));

      if (newProgress === currentProgress && !isAbsolute) {
        continue; // No progress delta
      }

      const isCompleted = newProgress >= targetVal;

      // Update the active quest row
      const updatePayload: any = {
        progress: newProgress,
        updated_at: new Date().toISOString(),
      };

      if (isCompleted) {
        updatePayload.status = 'completed';
        updatePayload.completed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('player_quests')
        .update(updatePayload)
        .eq('id', quest.id);

      if (updateError) {
        console.warn(`[QuestSystem] Failed to update progress for quest ${quest.quest_id}:`, updateError);
        continue;
      }

      console.log(`[QuestSystem] Updated quest ${quest.quest_id} progress: ${newProgress}/${targetVal}`);

      // Handle unlocking of the next tutorial quest in the sequence
      if (isCompleted && questDef.unlockSequence) {
        const nextQuestDef = allQuests.tutorial.find((q) => q.id === questDef.unlockSequence);
        if (nextQuestDef) {
          const { error: unlockError } = await supabase.from('player_quests').insert({
            player_id: userId,
            quest_id: nextQuestDef.id,
            status: 'active',
            progress: 0,
            target_value: nextQuestDef.targetValue,
          });

          if (unlockError) {
            console.warn(`[QuestSystem] Failed to unlock next quest ${nextQuestDef.id}:`, unlockError);
          } else {
            console.log(`[QuestSystem] Unlocked sequential tutorial quest: ${nextQuestDef.id}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[QuestSystem] Error in trackQuestProgress:', err);
  }
}
