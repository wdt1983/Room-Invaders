"use client";

import { useEffect } from "react";
import { useRaidStore, type RaidTarget } from "@/lib/store/useRaidStore";

/**
 * Hydration component for {@link useRaidStore}. Mirrors the
 * {@link StoreInitializer} pattern used by the home-room route: the SSR
 * page resolves a fixture, passes the target metadata as props, and this
 * client component flips the store into `'prep'` phase via useEffect.
 *
 * Both `startRaid` and `resetRaid` live inside the same useEffect so
 * React's effect-cleanup ordering guarantees the correct sequence on
 * navigation between raids: old cleanup (`resetRaid`) fires BEFORE the
 * new effect (`startRaid`). The previous render-phase `startRaid` call
 * was racy — the old page's cleanup effect ran AFTER the new page's
 * render body, overwriting `timeRemainingSeconds` back to 0 and causing
 * an immediate-defeat on the second raid.
 *
 * Effect ordering within a single commit is tree-order: RaidInitializer
 * is earlier in the JSX than GameCanvas, so `startRaid` always populates
 * the store before `initGame()` → `RaidScene.create()` reads it.
 */
export function RaidInitializer({ target }: { target: RaidTarget }) {
  useEffect(() => {
    useRaidStore.getState().startRaid(target);
    return () => {
      useRaidStore.getState().resetRaid();
    };
    // Keyed on `target.id` only — `target` is a fresh object literal on
    // every SSR render (name + difficulty derive from the fixture for a
    // given id), so including the full object would re-fire needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id]);

  return null;
}
