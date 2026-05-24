"use client";
import { useEffect } from 'react';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { useSquadStore } from '@/lib/store/useSquadStore';

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
}) {
  useEffect(() => {
    // 1. Hydrate inventory details
    usePlayerStore.getState().setInventory({
      scrap: inventory.scrap,
      components: inventory.components,
      credits: inventory.credits,
      intel: inventory.intel,
      contraband: inventory.contraband,
      storageCapacity: inventory.storage_capacity,
      safeModeUntil,
    });
    
    // 2. Hydrate player level & XP details
    usePlayerStore.getState().setPlayerState({ playerLevel });
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
  ]);

  return null;
}

