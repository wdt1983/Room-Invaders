"use client";

import { useEffect } from 'react';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { syncInventoryState } from '@/app/(game)/room/actions';

export function TickManager() {
  const generateTick = usePlayerStore((state) => state.generateTick);

  useEffect(() => {
    // Loop 1: Visual Tick
    const visualInterval = setInterval(() => {
      generateTick();
    }, 5000);

    // Loop 2: Database Sync
    const syncInterval = setInterval(() => {
      // Use getState to fetch the most recent values without putting them in the dependency array
      const state = usePlayerStore.getState();
      syncInventoryState({
        scrap: state.scrap,
        components: state.components,
        credits: state.credits,
        intel: state.intel,
        contraband: state.contraband
      });
    }, 30000);

    return () => {
      clearInterval(visualInterval);
      clearInterval(syncInterval);
    };
  }, [generateTick]);

  return null;
}
