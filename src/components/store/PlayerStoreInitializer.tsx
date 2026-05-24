"use client";
import { useEffect } from 'react';
import { usePlayerStore } from '@/lib/store/usePlayerStore';

/**
 * PlayerStoreInitializer — Hydrates core player and inventory data
 * from Server Components on mount and whenever server values change.
 * Mounted globally in the game layout to cover all routes.
 */
export default function PlayerStoreInitializer({
  inventory,
  playerLevel,
  xp,
  safeModeUntil,
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
}) {
  useEffect(() => {
    usePlayerStore.getState().setInventory({
      scrap: inventory.scrap,
      components: inventory.components,
      credits: inventory.credits,
      intel: inventory.intel,
      contraband: inventory.contraband,
      storageCapacity: inventory.storage_capacity,
      safeModeUntil,
    });
    usePlayerStore.getState().setPlayerState({ playerLevel });
    usePlayerStore.getState().applyXpAndLevel(xp, playerLevel);
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
  ]);

  return null;
}
