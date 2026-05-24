// Mirror of `src/lib/game/progression.ts` for the Deno Edge Function
// runtime. The two files must stay in sync — see the header comment in
// the client version for the curve design + milestone callouts.
//
// Task 3.0.19: server-side XP → level promotion. The Edge Function
// computes `levelForXp(newXp)` after a raid's XP is credited and
// updates `profiles.player_level` if the threshold was crossed.

export const MAX_PLAYER_LEVEL = 100;

export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)));
  return 50 * n * (n - 1);
}

export function levelForXp(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp < 0) return 1;
  let n = 1;
  while (n < MAX_PLAYER_LEVEL && xpForLevel(n + 1) <= totalXp) n++;
  return n;
}
