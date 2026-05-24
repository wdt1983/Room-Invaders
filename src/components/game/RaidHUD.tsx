"use client";

import { Button } from "@/components/ui/button";
import { useRaidStore } from "@/lib/store/useRaidStore";
import { EventBus } from "@/game/EventBus";
import { Crosshair, Heart, LogOut, Package, Timer } from "lucide-react";

/** Format seconds as `mm:ss` with zero-padding so the timer reads steady. */
function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * RaidHUD — in-raid React overlay (task 3.0.13).
 *
 * Shows the countdown, target name + difficulty, squad HP bar, and
 * the Abandon button. When the squad is holding the loot stash, a
 * capture progress bar appears (task 3.0.12).
 */
export function RaidHUD() {
  const target = useRaidStore((s) => s.target);
  const phase = useRaidStore((s) => s.phase);
  const timeRemainingSeconds = useRaidStore((s) => s.timeRemainingSeconds);
  const durationSeconds = useRaidStore((s) => s.durationSeconds);
  const squadHp = useRaidStore((s) => s.squadHp);
  const squadMaxHp = useRaidStore((s) => s.squadMaxHp);
  const stashHoldProgress = useRaidStore((s) => s.stashHoldProgress);

  if (!target || phase === 'results') return null;

  const lowTime = timeRemainingSeconds <= 15 && phase === 'active';
  const progress = durationSeconds > 0 ? (timeRemainingSeconds / durationSeconds) : 1;
  const hpProgress = squadMaxHp > 0 ? (squadHp / squadMaxHp) : 0;
  const lowHp = squadMaxHp > 0 && squadHp / squadMaxHp <= 0.3;

  const emitOutcome = (outcome: 'victory' | 'defeat', reason: string) => {
    EventBus.emit('raid-complete', { outcome, reason });
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-center gap-2 p-3">
      <div className="pointer-events-auto flex w-full max-w-lg flex-col gap-2 rounded-md border border-primary/30 bg-background/90 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crosshair className="size-4 text-primary" />
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {target.difficulty} raid
              </span>
              <span className="text-sm font-bold">{target.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-2xl tabular-nums">
            <Timer className={`size-5 ${lowTime ? 'text-destructive' : 'text-primary'}`} />
            <span className={lowTime ? 'text-destructive' : 'text-foreground'}>
              {formatTime(timeRemainingSeconds)}
            </span>
          </div>
        </div>

        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${lowTime ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
          />
        </div>

        {squadMaxHp > 0 ? (
          <div className="flex items-center gap-2">
            <Heart className={`size-4 shrink-0 ${lowHp ? 'text-destructive' : 'text-rose-400'}`} />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-[width] duration-200 ease-out ${lowHp ? 'bg-destructive' : 'bg-rose-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, hpProgress * 100))}%` }}
              />
            </div>
            <span className="w-16 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {squadHp} / {squadMaxHp}
            </span>
          </div>
        ) : null}

        {stashHoldProgress > 0 ? (
          <div className="flex items-center gap-2 pt-1">
            <Package className="size-4 shrink-0 text-amber-400" />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-amber-400 transition-[width] duration-100 ease-linear"
                style={{ width: `${Math.max(0, Math.min(100, stashHoldProgress * 100))}%` }}
              />
            </div>
            <span className="w-20 text-right font-mono text-xs tabular-nums text-amber-400">
              Capturing...
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            Phase: <span className="font-mono uppercase text-foreground">{phase}</span>
          </span>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 px-2 text-xs"
            onClick={() => emitOutcome('defeat', 'Abandoned')}
          >
            <LogOut className="mr-1.5 size-3.5" />
            Abandon
          </Button>
        </div>
      </div>
    </div>
  );
}
