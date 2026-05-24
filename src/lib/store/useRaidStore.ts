import { create } from 'zustand';

/**
 * Phase 3 raid state — kept separate from `useRoomStore` because the raid is a
 * transient gameplay session against an NPC (or later, PvP) target rather than
 * the player's persistent home room. The store holds only in-memory state for
 * the duration of a single raid; nothing here is SSR-hydrated.
 *
 * Tasks 3.0.13 (timer) + 3.0.15 (results scaffold) established this store.
 * Tasks 3.0.14 (action_log) and 3.0.17 (loot) populate the stubs below.
 */

export type RaidDifficulty = 'easy' | 'medium' | 'hard';
export type RaidPhase = 'prep' | 'active' | 'results';
export type RaidOutcome = 'victory' | 'defeat';

/**
 * Status of the `resolve-raid` Edge Function round-trip (task 3.0.16).
 *
 *   'idle'       — raid hasn't finished, or the call hasn't been made.
 *   'validating' — POSTed to the Edge Function, awaiting response.
 *   'validated'  — server returned authoritative rewards; results now
 *                  reflect the server's numbers, not the scaffold.
 *   'error'      — Edge Function unreachable or returned an error. The
 *                  results screen falls back to the scaffold rewards
 *                  RaidScene committed locally and surfaces a notice.
 */
export type RaidValidation = 'idle' | 'validating' | 'validated' | 'error';

/** Per-difficulty raid-timer budget, GDD §3.2. */
export const RAID_DURATION_SECONDS: Record<RaidDifficulty, number> = {
  easy: 90,
  medium: 120,
  hard: 150,
};

/**
 * Single entry in the raid action log. Broad shape on purpose — task 3.0.14
 * will enumerate canonical event types (move / trap_trigger / damage / etc.).
 * Included here so 3.0.13 can append without a second schema migration.
 */
export interface RaidActionLogEntry {
  /** Seconds elapsed since raid start (monotonic). */
  t: number;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
}

/**
 * Reward/penalty summary persisted at the end of a raid. `RaidScene.finishRaid`
 * writes scaffold numbers (zero for rolled currencies) so the results modal
 * renders instantly; `RaidResolver` then fires the `resolve-raid` Edge
 * Function and overwrites the loot + damage + XP fields with the
 * server-authoritative values (tasks 3.0.16 + 3.0.17).
 */
export interface RaidResults {
  outcome: RaidOutcome;
  /** Seconds between raid start and termination. */
  secondsElapsed: number;
  xpGained: number;
  damageTaken: number;
  /** Rolled loot per currency. Scaffold writes zero for everything except
   *  `lootScrap` / `lootComponents` (easy-tier approximation); the server
   *  response fills in the full set. */
  lootScrap: number;
  lootComponents: number;
  lootCredits: number;
  lootIntel: number;
  lootContraband: number;
  /** Human-readable sentence describing why the raid ended (timer expiry,
   *  player abandonment, stash secured, squad wiped). */
  reason: string;
}

export interface RaidTarget {
  /** Fixture key or, later, NPC room id from the DB. */
  id: string;
  name: string;
  difficulty: RaidDifficulty;
}

interface RaidState {
  target: RaidTarget | null;
  phase: RaidPhase;
  /** Seconds remaining on the countdown. Decrements to 0, at which point the
   *  raid auto-transitions to `'results'` with a timeout defeat. */
  timeRemainingSeconds: number;
  /** Initial duration for the current raid — pinned so the results screen can
   *  report "used X of Y seconds" without re-deriving from difficulty. */
  durationSeconds: number;
  /** Live squad HP mirrored from the EntitySprite via RaidScene's
   *  `entity-damaged` listener. Store-side value is what the HUD binds to;
   *  the sprite's HP is the authoritative source for CombatSystem math. */
  squadHp: number;
  squadMaxHp: number;
  /** 0 when not holding, 0→1 during stash capture. Drives the HUD
   *  progress bar. Updated from RaidScene's hold-timer tick. */
  stashHoldProgress: number;
  actionLog: RaidActionLogEntry[];
  results: RaidResults | null;
  /** Status of the server-side validation round-trip. See
   *  {@link RaidValidation} for the state machine. Starts `'idle'`,
   *  RaidResolver flips it to `'validating'` on phase → `'results'`,
   *  then lands on `'validated'` or `'error'`. */
  resultsValidation: RaidValidation;
  /** Human-readable error from the Edge Function when
   *  `resultsValidation === 'error'`. Surfaced in the results screen as
   *  a subtle notice so the scaffold-fallback is visible. */
  resultsValidationError: string | null;

  /** Set the raid target + reset phase/timer. Called by `RaidInitializer` once
   *  per route load from the SSR-resolved fixture. */
  startRaid: (target: RaidTarget) => void;
  /** Transition from prep → active. Called by RaidScene once the entity is
   *  spawned and the input is wired, so the timer doesn't start counting
   *  against the player before the scene is interactable. */
  beginActivePhase: () => void;
  /** Decrement by 1 second — called from the RaidScene 1Hz timer event. */
  tickTimer: () => void;
  /** Transition to results with the given payload. Called when the timer
   *  expires, the player abandons, or (later) a victory trigger fires. */
  completeRaid: (results: RaidResults) => void;
  /** Append a single event to the action log — stub for task 3.0.14. */
  appendAction: (entry: RaidActionLogEntry) => void;
  /** Mirror squad HP from the sprite. Called by RaidScene on every
   *  `entity-damaged` + `entity-killed` event for the `'player'` entityId
   *  so the HUD stays in sync without reading the sprite directly. */
  setSquadHp: (hp: number, maxHp?: number) => void;
  /** Update the stash-hold capture progress (0→1). Called from
   *  RaidScene's hold-timer tick at ~10Hz for smooth animation. */
  setStashHoldProgress: (progress: number) => void;
  /** Mark the resolve-raid round-trip as in-flight. Called by
   *  {@link RaidResolver} once when phase transitions to 'results'. */
  beginValidation: () => void;
  /** Apply the server's authoritative reward numbers on top of the
   *  scaffold results, and flip `resultsValidation` to `'validated'`.
   *  Partial so the server can omit fields it doesn't compute. */
  completeValidation: (partial: Partial<RaidResults>) => void;
  /** Transition `resultsValidation` to `'error'` with a message. The
   *  scaffold rewards stay visible so the player isn't stranded. */
  failValidation: (error: string) => void;
  /** Wipe the store. Call on route unmount so the next raid starts clean. */
  resetRaid: () => void;
}

const INITIAL_STATE = {
  target: null,
  phase: 'prep' as RaidPhase,
  timeRemainingSeconds: 0,
  durationSeconds: 0,
  squadHp: 0,
  squadMaxHp: 0,
  stashHoldProgress: 0,
  actionLog: [],
  results: null,
  resultsValidation: 'idle' as RaidValidation,
  resultsValidationError: null,
};

export const useRaidStore = create<RaidState>((set) => ({
  ...INITIAL_STATE,

  startRaid: (target) => {
    const duration = RAID_DURATION_SECONDS[target.difficulty];
    set({
      target,
      phase: 'prep',
      timeRemainingSeconds: duration,
      durationSeconds: duration,
      actionLog: [],
      results: null,
    });
  },

  beginActivePhase: () => set((state) => {
    if (state.phase !== 'prep') return state;
    return { ...state, phase: 'active' };
  }),

  tickTimer: () => set((state) => {
    if (state.phase !== 'active') return state;
    return {
      ...state,
      timeRemainingSeconds: Math.max(0, state.timeRemainingSeconds - 1),
    };
  }),

  completeRaid: (results) => set((state) => {
    if (state.phase === 'results') return state;
    return { ...state, phase: 'results', results };
  }),

  appendAction: (entry) => set((state) => ({
    ...state,
    actionLog: [...state.actionLog, entry],
  })),

  setSquadHp: (hp, maxHp) => set((state) => ({
    ...state,
    squadHp: Math.max(0, hp),
    squadMaxHp: maxHp ?? state.squadMaxHp,
  })),

  setStashHoldProgress: (progress) => set((state) => ({
    ...state,
    stashHoldProgress: Math.max(0, Math.min(1, progress)),
  })),

  beginValidation: () => set((state) => {
    if (state.resultsValidation !== 'idle') return state;
    return { ...state, resultsValidation: 'validating', resultsValidationError: null };
  }),

  completeValidation: (partial) => set((state) => {
    if (!state.results) return state;
    return {
      ...state,
      results: { ...state.results, ...partial },
      resultsValidation: 'validated',
      resultsValidationError: null,
    };
  }),

  failValidation: (error) => set((state) => ({
    ...state,
    resultsValidation: 'error',
    resultsValidationError: error,
  })),

  resetRaid: () => set({ ...INITIAL_STATE }),
}));
