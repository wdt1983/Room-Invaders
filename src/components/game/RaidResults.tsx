"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { useRaidStore } from "@/lib/store/useRaidStore";
import { resolveFixture } from "@/game/fixtures/npc-rooms";
import {
  Award,
  CheckCircle2,
  Clock,
  Coins,
  Cog,
  Cpu,
  Eye,
  Heart,
  Loader2,
  Map,
  Package,
  ShieldAlert,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";

/** Format a seconds count as `Ms` or `MmSs` for compact display. */
function formatElapsed(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

/**
 * RaidResults — post-raid modal overlay (tasks 3.0.15 + 3.0.16).
 *
 * Mounts whenever `useRaidStore.phase === 'results'` and `results` is
 * populated. Displays outcome + reward numbers from the store.
 *
 * `RaidScene.finishRaid` writes scaffold rewards synchronously so the
 * modal renders instantly; {@link RaidResolver} then fires the
 * `resolve-raid` Edge Function in the background and overwrites the
 * scaffold fields with server-authoritative values via
 * `completeValidation` (task 3.0.16). The footer
 * {@link ValidationNotice} reflects the round-trip state so the player
 * always knows whether they're looking at server-truth or a local
 * estimate.
 *
 * LootSystem (3.0.17) will expand the reward math on the server side
 * — nothing here needs to change for that task.
 */
const BOSS_UNIQUE_ITEMS: Record<string, { name: string; type: string; desc: string; icon: string }> = {
  'boss-ironjaw': {
    name: "Ironjaw's Bear Trap",
    type: "Trap (Rare Defense)",
    desc: "Deals 30 damage and stuns squad/enemies for 2 seconds.",
    icon: "🪤",
  },
  'boss-whisper': {
    name: "Whisper's Ghost Wire",
    type: "Trap (Rare Alarm)",
    desc: "Alerts defenses in a 5-tile radius on breach.",
    icon: "🕸️",
  },
  'boss-volkov': {
    name: "Volkov's Autocannon Mk2",
    type: "Turret (Epic Heavy Weapon)",
    desc: "Heavy 25 dmg defense turret with rapid 1.5s fire rate.",
    icon: "🔫",
  },
  'boss-circuit': {
    name: "Circuit's EMP Mine",
    type: "Trap (Epic Tech)",
    desc: "Discharges high-voltage pulse disabling mechanicals for 4s.",
    icon: "🔌",
  },
  'boss-warden': {
    name: "The Warden's Key",
    type: "Trophy (Legendary Cosmetic)",
    desc: "The ultimate validation of sector survival. Proof of the Fracture's defeat.",
    icon: "🔑",
  },
};

export function RaidResults() {
  const phase = useRaidStore((s) => s.phase);
  const results = useRaidStore((s) => s.results);
  const target = useRaidStore((s) => s.target);
  const validation = useRaidStore((s) => s.resultsValidation);
  const validationError = useRaidStore((s) => s.resultsValidationError);

  if (phase !== 'results' || !results) return null;

  const isVictory = results.outcome === 'victory';
  const Icon = isVictory ? Trophy : XCircle;
  const headerColor = isVictory ? 'text-emerald-400' : 'text-destructive';
  const borderColor = isVictory ? 'border-emerald-400/40' : 'border-destructive/40';

  const isBossRaid = target ? target.id.startsWith("boss-") : false;
  const fixture = target ? resolveFixture(target.id) : null;
  const bossBriefing = isBossRaid && fixture && (fixture as any).briefing 
    ? (isVictory ? (fixture as any).briefing.victory : (fixture as any).briefing.defeat)
    : null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className={`w-full max-w-md shadow-xl ${borderColor}`}>
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className={`flex items-center gap-2 text-2xl ${headerColor}`}>
            <Icon className="size-6" />
            {isVictory ? 'Victory' : 'Defeat'}
          </CardTitle>
          {target ? (
            <p className="text-sm text-muted-foreground capitalize">
              {target.name} · {target.difficulty}
            </p>
          ) : null}
          <p className="pt-1 text-xs italic text-muted-foreground">{results.reason}</p>
        </CardHeader>

        <CardContent className="grid grid-cols-2 gap-3 pt-4">
          {/* Boss Briefing Message */}
          {bossBriefing && (
            <div className="col-span-2 rounded-lg border border-red-500/20 bg-red-950/10 p-3 text-xs italic text-red-200 font-mono mb-2 leading-relaxed">
              <span className="text-[10px] text-red-400 font-bold block mb-1 font-sans not-italic uppercase tracking-wider">{"// Intercepted Boss Transmission:"}</span>
              {bossBriefing}
            </div>
          )}

          {/* First Clear Rewards Showcase */}
          {results.isFirstClear && target && BOSS_UNIQUE_ITEMS[target.id] && (
            <div className="col-span-2 flex flex-col gap-2 rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-3 shadow-[0_0_15px_rgba(234,179,8,0.15)] mb-2 border-dashed">
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                <Sparkles className="size-3.5 animate-spin" /> First Clear Unique Reward!
              </span>
              <div className="flex items-center gap-3 bg-black/40 border border-yellow-500/10 p-2 rounded">
                <span className="text-3xl filter drop-shadow-[0_2px_4px_rgba(234,179,8,0.3)]">{BOSS_UNIQUE_ITEMS[target.id].icon}</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-white truncate">{BOSS_UNIQUE_ITEMS[target.id].name}</span>
                  <span className="text-[9px] font-bold text-yellow-400/90">{BOSS_UNIQUE_ITEMS[target.id].type}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                    {BOSS_UNIQUE_ITEMS[target.id].desc}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Stat icon={Clock} label="Time used" value={formatElapsed(results.secondsElapsed)} />
          <Stat icon={Award} label="XP gained" value={`+${results.xpGained}`} />
          {results.lootScrap > 0 ? (
            <Stat icon={Cog} label="Scrap" value={`+${results.lootScrap}`} />
          ) : null}
          {results.lootComponents > 0 ? (
            <Stat icon={Cpu} label="Components" value={`+${results.lootComponents}`} />
          ) : null}
          {/* Rarer currencies — conditionally rendered so defeat screens
              (and victories that didn't roll the drop) don't clutter with
              zero-value cards. */}
          {results.lootCredits > 0 ? (
            <Stat icon={Coins} label="Credits" value={`+${results.lootCredits}`} />
          ) : null}
          {results.lootIntel > 0 ? (
            <Stat icon={Eye} label="Intel" value={`+${results.lootIntel}`} />
          ) : null}
          {results.lootContraband > 0 ? (
            <Stat icon={Package} label="Contraband" value={`+${results.lootContraband}`} />
          ) : null}
          <Stat icon={Heart} label="Damage taken" value={String(results.damageTaken)} className="col-span-2" />
        </CardContent>

        <CardFooter className="flex flex-col gap-2 border-t border-border/50 pt-3">
          <ValidationNotice validation={validation} error={validationError} />
          <div className="flex w-full gap-2">
            <Link href="/raid" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                Raid Another
              </Button>
            </Link>
            <Link href="/map" className="flex-1">
              <Button className="w-full gap-2">
                <Map className="size-4" />
                Return to Map
              </Button>
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Footer notice reflecting the `resolve-raid` Edge Function round-trip
 * status. While validating, the player sees a spinner. On success, a
 * green check; on failure, an amber warning with the error reason plus
 * a note that the displayed rewards fell back to the client scaffold.
 */
function ValidationNotice({
  validation,
  error,
}: {
  validation: 'idle' | 'validating' | 'validated' | 'error';
  error: string | null;
}) {
  if (validation === 'validating') {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Validating with server…
      </p>
    );
  }
  if (validation === 'validated') {
    return (
      <p className="flex items-center gap-2 text-xs text-emerald-400">
        <CheckCircle2 className="size-3" />
        Rewards validated and credited.
      </p>
    );
  }
  if (validation === 'error') {
    return (
      <p className="flex items-start gap-2 text-xs text-amber-400">
        <ShieldAlert className="size-3 shrink-0 translate-y-0.5" />
        <span>{error ?? 'Validation failed — showing local estimate.'}</span>
      </p>
    );
  }
  // idle (shouldn't render in practice — RaidResolver flips to validating
  // immediately on mount — but render a sensible placeholder anyway).
  return (
    <p className="text-xs text-muted-foreground">
      Reward numbers pending server validation…
    </p>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  className = '',
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded border border-border/50 bg-card/40 p-2 ${className}`}>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  );
}
