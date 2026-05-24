/**
 * XP → player level progression (task 3.0.19).
 *
 * Shared between client (`usePlayerStore`, `RaidResolver`, `TopBar`) and
 * the server (`resolve-raid` Edge Function). The server file is a
 * mirrored copy at `supabase/functions/resolve-raid/progression.ts` —
 * keep the two in sync until a future task unifies them via a
 * DB-hosted progression table (deferred; see handoff).
 *
 * Curve: `xpForLevel(n) = 50 * n * (n - 1)`. Picks out:
 *   L2   100 xp   (~1 easy-raid victory)
 *   L3   300
 *   L5  1000
 *   L10 4500
 *   L15 10500   (GDD §6.1: 12×12 room expansion)
 *   L20 19000   (GDD §6.1: clan creation/joining)
 *   L100 495000
 *
 * Linear-ish early pacing keeps the progression loop visible within
 * the first few raids, then bends smoothly into a long tail that
 * gives meaning to 4.0.13 (room/tech upgrades) and Phase 5 PvP
 * matchmaking thresholds.
 */

export const MAX_PLAYER_LEVEL = 100;

/** Total cumulative XP required to reach `level`. Level 1 is the
 *  starting level (`xpForLevel(1) === 0`). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)));
  return 50 * n * (n - 1);
}

/** The highest level whose XP threshold `totalXp` has met or exceeded.
 *  Clamps to [1, MAX_PLAYER_LEVEL]. */
export function levelForXp(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp < 0) return 1;
  let n = 1;
  while (n < MAX_PLAYER_LEVEL && xpForLevel(n + 1) <= totalXp) n++;
  return n;
}

/** Convenience: progress toward the next level as `{ current, nextThreshold, progress01 }`.
 *  `progress01` is clamped to `[0, 1]`; at max level it reports 1. */
export function levelProgress(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress01: number;
} {
  const level = levelForXp(totalXp);
  if (level >= MAX_PLAYER_LEVEL) {
    return { level, xpIntoLevel: 0, xpForNext: 0, progress01: 1 };
  }
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - base);
  const into = Math.max(0, totalXp - base);
  return {
    level,
    xpIntoLevel: into,
    xpForNext: next - base,
    progress01: Math.min(1, into / span),
  };
}
