import { create } from "zustand";
import { levelForXp } from "@/lib/game/progression";

interface PlayerState {
  playerLevel: number;
  /** Total cumulative XP. Source of truth lives in `profiles.xp`; the
   *  store mirrors the last-known server total. Hydrated on SSR via
   *  {@link StoreInitializer} and overwritten by {@link applyXpAndLevel}
   *  after every `resolve-raid` round-trip (task 3.0.19). */
  xp: number;
  maxScrap: number;
  maxComponents: number;
  scrap: number;
  components: number;
  credits: number;
  intel: number;
  contraband: number;
  storageCapacity: number;
  safeModeUntil: string | null;
  addScrap: (amount: number) => void;
  setInventory: (data: Partial<PlayerState>) => void;
  setPlayerState: (data: Partial<PlayerState>) => void;
  /** Task 3.0.19: apply the server-authoritative XP total + player
   *  level after `resolve-raid` returns. Recomputes `maxScrap` /
   *  `maxComponents` from the new level. Idempotent — safe to call
   *  with the current values. Returns the level delta so callers
   *  (RaidResolver) can decide whether to fire a level-up toast. */
  applyXpAndLevel: (
    xp: number,
    level?: number,
  ) => { previousLevel: number; newLevel: number; leveledUp: boolean };
  generateTick: () => void;
}

const maxScrapFor = (level: number) => Math.max(1, level) * 1000;
const maxComponentsFor = (level: number) => Math.max(1, level) * 250;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  playerLevel: 1,
  xp: 0,
  maxScrap: 1000,
  maxComponents: 250,
  scrap: 200,
  components: 50,
  credits: 100,
  intel: 10,
  contraband: 0,
  storageCapacity: 500,
  safeModeUntil: null,
  addScrap: (amount) => set((state) => ({ scrap: Math.min(state.scrap + amount, state.maxScrap) })),
  setInventory: (data) => set((state) => ({ ...state, ...data })),
  setPlayerState: (data) => set((state) => {
    const nextLevel = data.playerLevel ?? state.playerLevel;
    return {
      ...state,
      ...data,
      maxScrap: maxScrapFor(nextLevel),
      maxComponents: maxComponentsFor(nextLevel),
    };
  }),
  applyXpAndLevel: (xp, level) => {
    const prev = get();
    const previousLevel = prev.playerLevel;
    // Server echoes `newPlayerLevel`; if a caller omits it (e.g. a future
    // offline-XP-grant path), fall back to the client-computed threshold.
    // Never demote — a scrap-purchased level (task 4.0.13) can outpace
    // the XP threshold and must survive an applyXpAndLevel call.
    const serverLevel = typeof level === "number" ? level : levelForXp(xp);
    const newLevel = Math.max(previousLevel, serverLevel);
    set({
      xp,
      playerLevel: newLevel,
      maxScrap: maxScrapFor(newLevel),
      maxComponents: maxComponentsFor(newLevel),
    });
    return { previousLevel, newLevel, leveledUp: newLevel > previousLevel };
  },
  generateTick: () => set((state) => ({
    scrap: Math.min(state.scrap + 5, state.maxScrap),
    components: Math.min(state.components + 1, state.maxComponents)
  })),
}));
