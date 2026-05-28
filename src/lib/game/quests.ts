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
  bossId?: string; // Optional field linking to boss encounters
}

const allQuests: {
  tutorial: QuestDefinition[];
  daily: QuestDefinition[];
  weekly: QuestDefinition[];
  story: QuestDefinition[];
} = questsData as any;

// Helper to find a quest definition by ID across all categories
export function findQuestDefinition(questId: string): QuestDefinition | null {
  const categories = [allQuests.tutorial, allQuests.daily, allQuests.weekly, allQuests.story];
  for (const list of categories) {
    const found = list.find((q) => q.id === questId);
    if (found) return found;
  }
  return null;
}

/**
 * Seed the first tutorial quest ("tut-01" - "Wake Up") and first story quest ("story-01") for a player.
 * Safe to call repeatedly (idempotent due to unique index).
 */
export async function seedInitialQuests(supabase: any, userId: string): Promise<void> {
  // 1. Seed tutorial quest
  const tut01 = allQuests.tutorial.find((q) => q.id === 'tut-01');
  if (tut01) {
    try {
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
      console.error('[QuestSystem] Failed to seed initial tutorial quests:', err);
    }
  }

  // 2. Seed story quest if user is level >= 3 and has no story quests active or completed
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('player_level')
      .eq('id', userId)
      .maybeSingle();

    const playerLevel = profile?.player_level ?? 1;

    if (playerLevel >= 3) {
      const story01 = allQuests.story.find((q) => q.id === 'story-01');
      if (story01) {
        const { data: storyExists } = await supabase
          .from('player_quests')
          .select('id')
          .eq('player_id', userId)
          .like('quest_id', 'story-%')
          .limit(1);

        if (!storyExists || storyExists.length === 0) {
          await supabase.from('player_quests').insert({
            player_id: userId,
            quest_id: 'story-01',
            status: 'active',
            progress: 0,
            target_value: story01.targetValue,
          });
          console.log(`[QuestSystem] Seeded story-01 for user: ${userId}`);
        }
      }
    }
  } catch (err) {
    console.error('[QuestSystem] Failed to seed story quests:', err);
  }
}

/**
 * Fetch the active or completed story quest for the player.
 */
export async function getActiveStoryQuest(supabase: any, userId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('player_quests')
    .select('*')
    .eq('player_id', userId)
    .like('quest_id', 'story-%')
    .in('status', ['active', 'completed'])
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Authoritative utility to update progress on a player's active quests.
 * Triggered by key gameplay milestones (buying items, winning raids, etc.).
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

      // Handle unlocking of the next quest in the sequence (Tutorial or Story)
      if (isCompleted && questDef.unlockSequence) {
        const nextQuestDef = allQuests.tutorial.find((q) => q.id === questDef.unlockSequence) ||
                             allQuests.story.find((q) => q.id === questDef.unlockSequence);
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
            console.log(`[QuestSystem] Unlocked sequential quest: ${nextQuestDef.id}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[QuestSystem] Error in trackQuestProgress:', err);
  }
}
