"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useRaidStore } from "@/lib/store/useRaidStore";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { resolveRaid } from "@/lib/game/resolveRaid";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/game/analytics";


/**
 * RaidResolver — fires the `resolve-raid` Edge Function once per raid
 * (task 3.0.16) and threads the server's authoritative rewards back into
 * the UI.
 *
 * Decoupled from RaidScene on purpose: the scene commits scaffold
 * results to `useRaidStore` via {@link RaidScene.finishRaid} so the
 * results screen renders immediately on victory/defeat; this component
 * runs a background round-trip that upgrades the scaffold numbers with
 * server-validated values (scrap / components / xp), plus credits the
 * player's inventory through {@link usePlayerStore}.
 *
 * Fire-once contract: the effect keys on `phase` + `resultsValidation`.
 * On phase → `'results'` with validation still `'idle'`, it flips
 * validation to `'validating'` and issues the call. Subsequent effect
 * runs short-circuit because validation is no longer `'idle'`. The
 * state resets when {@link RaidInitializer} unmounts and calls
 * `resetRaid()`.
 */
export function RaidResolver() {
  const phase = useRaidStore((s) => s.phase);
  const resultsValidation = useRaidStore((s) => s.resultsValidation);

  useEffect(() => {
    if (phase !== "results") return;

    const state = useRaidStore.getState();
    if (!state.results || !state.target) return;
    if (state.resultsValidation !== "idle") return;

    state.beginValidation();

    resolveRaid({
      fixtureId: state.target.id,
      outcome: state.results.outcome,
      reason: state.results.reason,
      secondsElapsed: state.results.secondsElapsed,
      squadHp: state.squadHp,
      squadMaxHp: state.squadMaxHp,
      actionLog: state.actionLog,
    })
      .then((res) => {
        if (!res) {
          useRaidStore
            .getState()
            .failValidation("Server unreachable — showing local estimate.");
          return;
        }
        if (res.success === false) {
          useRaidStore
            .getState()
            .failValidation(res.error || "Server rejected raid result.");
          return;
        }
        useRaidStore.getState().completeValidation({
          xpGained: res.xpGained,
          lootScrap: res.lootScrap,
          lootComponents: res.lootComponents,
          lootCredits: res.lootCredits,
          lootIntel: res.lootIntel,
          lootContraband: res.lootContraband,
          damageTaken: res.damageTaken,
        });
        usePlayerStore.getState().setInventory({
          scrap: res.newScrap,
          components: res.newComponents,
          credits: res.newCredits,
          intel: res.newIntel,
          contraband: res.newContraband,
        });

        // Track first completed raid telemetry
        const clientSupabase = createClient();
        clientSupabase
          .from("raid_history")
          .select("id", { count: "exact", head: true })
          .then(
            ({ count }) => {
              if (count !== null && count <= 1) {
                trackEvent("first_raid", {
                  fixtureId: res.fixtureId,
                  outcome: res.outcome,
                  xpGained: res.xpGained,
                });
              }
            },
            (err: any) => {
              console.error("[RaidResolver] Failed to fetch raid_history count:", err);
            }
          );

        // Task 3.0.19: apply server-authoritative XP + level, then
        // fire a level-up toast if the threshold was crossed. The
        // server has already persisted `player_level` when
        // `leveledUp` is true; we're just syncing the client store.
        const { leveledUp, newLevel, previousLevel } = usePlayerStore
          .getState()
          .applyXpAndLevel(res.newXp, res.newPlayerLevel);
        if (leveledUp) {
          const gained = newLevel - previousLevel;
          toast.success(
            gained > 1 ? `Level up! Lvl ${previousLevel} → ${newLevel}` : `Level up! Lvl ${newLevel}`,
            {
              description: "Storage cap increased. New items may be unlocked.",
              duration: 5000,
            },
          );
        }
      })
      .catch((err) => {
        console.warn("[RaidResolver] resolve-raid threw:", err);
        useRaidStore
          .getState()
          .failValidation("Server error — showing local estimate.");
      });
  }, [phase, resultsValidation]);

  return null;
}
