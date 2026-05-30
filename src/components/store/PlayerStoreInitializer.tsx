"use client";
import { useEffect } from 'react';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { useSquadStore } from '@/lib/store/useSquadStore';
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/game/analytics";

/**
 * PlayerStoreInitializer — Hydrates core player, inventory, tech tree,
 * and squad loadout data from Server Components on mount and whenever
 * server values change. Mounted globally in the game layout to cover all routes.
 */
export default function PlayerStoreInitializer({
  inventory,
  playerLevel,
  xp,
  safeModeUntil,
  techPoints,
  unlockedTechs,
  squad,
  activeQuestId,
  createdAt,
  activeBadge,
  activeBorder,
  activeRoomSkin,
  clearedBosses,
}: {
  inventory: {
    scrap: number;
    components: number;
    credits: number;
    intel: number;
    contraband: number;
    storage_capacity: number;
  };
  playerLevel: number;
  xp: number;
  safeModeUntil: string | null;
  techPoints: number;
  unlockedTechs: string[];
  squad: any[];
  activeQuestId: string | null;
  createdAt: string;
  activeBadge: string | null;
  activeBorder: string | null;
  activeRoomSkin: string | null;
  clearedBosses: string[];
}) {
  useEffect(() => {
    // 0. Hydrate active cosmetic states
    usePlayerStore.getState().setCosmeticsState({
      activeBadge,
      activeBorder,
      activeRoomSkin,
    });

    // 1. Hydrate inventory details
    usePlayerStore.getState().setInventory({
      scrap: inventory.scrap,
      components: inventory.components,
      credits: inventory.credits,
      intel: inventory.intel,
      contraband: inventory.contraband,
      storageCapacity: inventory.storage_capacity,
      safeModeUntil,
      activeQuestId,
    });
    
    // 2. Hydrate player level, XP, and boss clears
    usePlayerStore.getState().setPlayerState({ playerLevel, clearedBosses });
    usePlayerStore.getState().applyXpAndLevel(xp, playerLevel);
    
    // 3. Hydrate tech tree details
    usePlayerStore.getState().hydrateTech(techPoints, unlockedTechs);
    
    // 4. Hydrate squad loadouts
    useSquadStore.getState().setMembers(
      squad.map((m: any) => ({
         id: m.id,
         slotNumber: m.slot_number,
         name: m.name,
         activeAbility: m.active_ability,
         passiveGear: m.passive_gear,
         weapon: m.weapon || null,
         armor: m.armor || null,
         selectedEntryPoint: null,
      }))
    );

    // 5. Track retention D1 and D7 metrics
    if (createdAt) {
      const createdTime = new Date(createdAt).getTime();
      const nowTime = Date.now();
      const diffHours = (nowTime - createdTime) / (1000 * 60 * 60);

      const checkAndTrackRetention = async () => {
        const supabaseClient = createClient();
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const userId = user.id;
        
        let cohort: "d1" | "d7" | null = null;
        if (diffHours >= 24 && diffHours <= 48) {
          cohort = "d1";
        } else if (diffHours >= 168 && diffHours <= 192) {
          cohort = "d7";
        }

        if (cohort) {
          const storageKey = `ri_retention_tracked_${userId}_${cohort}`;
          const alreadyTracked = localStorage.getItem(storageKey);
          if (!alreadyTracked) {
            localStorage.setItem(storageKey, "true");
            trackEvent(`retention_${cohort}`, {
              userId,
              diffHours,
              createdAt,
            });
          }
        }
      };

      checkAndTrackRetention().catch((e) => console.error("[Retention] Tracking error:", e));
    }
  }, [
    inventory.scrap,
    inventory.components,
    inventory.credits,
    inventory.intel,
    inventory.contraband,
    inventory.storage_capacity,
    playerLevel,
    xp,
    safeModeUntil,
    techPoints,
    JSON.stringify(unlockedTechs),
    JSON.stringify(squad),
    activeQuestId,
    createdAt,
    activeBadge,
    activeBorder,
    activeRoomSkin,
    JSON.stringify(clearedBosses),
  ]);

  return null;
}

