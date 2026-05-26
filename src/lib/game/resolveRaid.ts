import { createClient } from "@/lib/supabase/client";
import type { RaidActionLogEntry, RaidOutcome } from "@/lib/store/useRaidStore";

/**
 * Client wrapper around the `resolve-raid` Edge Function (task 3.0.16).
 *
 * Sends the raid's action log + outcome claim to the server, which
 * validates the claim against the NPC fixture, computes authoritative
 * rewards, commits them to `inventories` + `profiles.xp`, and returns
 * the fresh numbers.
 *
 * The call is best-effort — if the function is not deployed (dev) or
 * unreachable, `resolveRaid` returns `null` so callers can fall back to
 * the client-side scaffold rewards already written by
 * {@link RaidScene.finishRaid}.
 */

export interface ResolveRaidRequest {
  fixtureId: string;
  outcome: RaidOutcome;
  reason: string;
  secondsElapsed: number;
  squadHp: number;
  squadMaxHp: number;
  actionLog: RaidActionLogEntry[];
  jointLobbyId?: string | null;
  jointParticipantIds?: string[];
}

export interface ResolveRaidResponse {
  success: true;
  validated: true;
  fixtureId: string;
  outcome: RaidOutcome;
  xpGained: number;
  /** Rolled loot amounts by currency. Zero means the entry either
   *  didn't appear in the NPC's loot table or failed its drop chance. */
  lootScrap: number;
  lootComponents: number;
  lootCredits: number;
  lootIntel: number;
  lootContraband: number;
  /** PRNG seed used for the roll — echoed back for audit / future
   *  replay reproducibility (task 3.0.17 / Phase 5 5.0.10). */
  lootSeed: number;
  damageTaken: number;
  /** Fresh wallet balances after loot was credited. Client pipes
   *  these into `usePlayerStore` so the TopBar reflects the new totals. */
  newScrap: number;
  newComponents: number;
  newCredits: number;
  newIntel: number;
  newContraband: number;
  newXp: number;
  /** Task 3.0.19: server-computed player level from the post-raid XP
   *  total. `previousPlayerLevel` is the level before the raid; if
   *  `leveledUp` is true, the server has already persisted the new
   *  level on `profiles.player_level`. Client uses the delta to fire
   *  a level-up toast and to update `usePlayerStore.playerLevel`. */
  previousPlayerLevel: number;
  newPlayerLevel: number;
  leveledUp: boolean;
}

export interface ResolveRaidError {
  success: false;
  error: string;
}

export async function resolveRaid(
  payload: ResolveRaidRequest,
): Promise<ResolveRaidResponse | ResolveRaidError | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.functions.invoke<
      ResolveRaidResponse | ResolveRaidError
    >("resolve-raid", { body: payload });

    if (error) {
      // `FunctionsHttpError` carries a `Response` on `error.context` — the
      // function returned non-2xx and we want the body to surface the
      // real reason (auth / validation / 500). Logging just `error` can
      // hide that behind a generic "non-2xx" string.
      console.warn("[resolveRaid] Edge Function invoke error:", error);
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx: Response | undefined = (error as any)?.context;
      if (ctx && typeof ctx.text === "function") {
        try {
          const body = await ctx.clone().text();
          console.warn(
            "[resolveRaid] Server response:",
            ctx.status,
            ctx.statusText,
            body,
          );
        } catch (readErr) {
          console.warn("[resolveRaid] Failed reading error body:", readErr);
        }
      }
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.warn("[resolveRaid] Unexpected error calling edge function:", err);
    return null;
  }
}
