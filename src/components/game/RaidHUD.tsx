"use client";

import { Button } from "@/components/ui/button";
import { useRaidStore } from "@/lib/store/useRaidStore";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
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
 * RaidHUD — in-raid React overlay (task 3.0.13), upgraded for Phase 7 (v0.4).
 *
 * Shows the countdown, target name + difficulty, combined squad HP bar,
 * stash hold capture progress (task 3.0.12), horizontal squad portraits list
 * with individual HP indicators, and Support Abilities hotkeys.
 */
export function RaidHUD() {
  const target = useRaidStore((s) => s.target);
  const phase = useRaidStore((s) => s.phase);
  const timeRemainingSeconds = useRaidStore((s) => s.timeRemainingSeconds);
  const durationSeconds = useRaidStore((s) => s.durationSeconds);
  const squadHp = useRaidStore((s) => s.squadHp);
  const squadMaxHp = useRaidStore((s) => s.squadMaxHp);
  const stashHoldProgress = useRaidStore((s) => s.stashHoldProgress);
  
  // Phase 7 Multi-Squad state
  const prepSquadMembers = useRaidStore((s) => s.prepSquadMembers) || [];
  const activeSquadIndex = useRaidStore((s) => s.activeSquadIndex);
  const activeAbilityMode = useRaidStore((s) => s.activeAbilityMode);
  
  // Tech tree active effects (to read unlocked active abilities)
  const activeEffects = usePlayerStore((s) => s.activeEffects);
  const unlockedAbilities = activeEffects?.unlockedAbilities || [];

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
      <div className="pointer-events-auto flex w-full max-w-lg flex-col gap-2.5 rounded-md border border-primary/30 bg-background/90 p-3 shadow-lg backdrop-blur">
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

        {/* Combined Squad HP Bar */}
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

        {/* Deployed Squad Members Portraits (Phase 7) */}
        {prepSquadMembers && prepSquadMembers.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-primary/10 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Squad Roster (Click to Select / Medkit)
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {prepSquadMembers.map((member, index) => {
                const isSelected = activeSquadIndex === index;
                const hpPercent = member.maxHp > 0 ? (member.hp / member.maxHp) * 100 : 0;
                const isDead = member.hp <= 0;
                
                return (
                  <button
                    key={member.id || index}
                    disabled={isDead}
                    onClick={() => {
                      if (activeAbilityMode === 'medkit') {
                        // Cast Medkit ability!
                        EventBus.emit('execute-ability', { ability: 'medkit', targetId: member.entityId });
                        useRaidStore.getState().setActiveAbilityMode(null);
                      } else {
                        // Regular select member
                        EventBus.emit('change-active-unit', index);
                      }
                    }}
                    className={`flex flex-col gap-1 rounded-lg border p-2 text-left transition-all pointer-events-auto shrink-0 w-28 ${
                      isDead 
                        ? 'opacity-40 border-muted bg-muted/20 cursor-not-allowed'
                        : isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500'
                          : 'border-primary/20 bg-background/50 hover:bg-primary/5 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-bold text-foreground">
                        {member.name}
                      </span>
                      {member.activeAbility && (
                        <span className="text-[9px] px-1 bg-primary/25 text-primary font-mono rounded shrink-0">
                          {member.activeAbility === 'medkit' ? 'MED' : member.activeAbility === 'breaching_charge' ? 'BRH' : 'EMP'}
                        </span>
                      )}
                    </div>
                    {/* Member HP Bar */}
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          hpPercent <= 30 ? 'bg-destructive' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground leading-none mt-0.5">
                      <span>{isDead ? 'KIA' : `${member.hp}/${member.maxHp}`}</span>
                    </div>
                    {/* Small loadout icons summary (Phase 7.0.5) */}
                    {!isDead && (member.weapon || member.armor || member.passiveGear) && (
                      <div className="flex gap-1.5 mt-1 border-t border-primary/5 pt-1 text-[9px] leading-none text-muted-foreground select-none">
                        {member.weapon && (
                          <span title={`Weapon: ${member.weapon.replace('_', ' ')}`}>
                            {member.weapon === 'heavy_machete' ? '🗡️' : '🔨'}
                          </span>
                        )}
                        {member.armor && (
                          <span title={`Armor: ${member.armor.replace('_', ' ')}`}>
                            {member.armor === 'reinforced_vest' ? '🛡️' : '🎖️'}
                          </span>
                        )}
                        {member.passiveGear && (
                          <span title={`Utility: ${member.passiveGear.replace('_', ' ')}`}>
                            {member.passiveGear === 'adrenaline_rush' ? '⚡' : '📡'}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Support Abilities Panel (Phase 7) */}
        {unlockedAbilities && unlockedAbilities.length > 0 ? (
          <div className="flex flex-col gap-1.5 border-t border-primary/10 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tactical Support Abilities
              </span>
              {activeAbilityMode && (
                <button 
                  onClick={() => useRaidStore.getState().setActiveAbilityMode(null)}
                  className="text-[10px] font-bold text-destructive hover:underline pointer-events-auto"
                >
                  Cancel Target Selection
                </button>
              )}
            </div>
            
            {/* Ability Mode Feedback Banner */}
            {activeAbilityMode && (
              <div className="text-xs border border-primary/30 bg-primary/10 text-primary-foreground p-1.5 rounded text-center animate-pulse">
                {activeAbilityMode === 'medkit' && "🔴 combat medkit active: click a squad portrait above to heal 40 HP."}
                {activeAbilityMode === 'breaching_charge' && "🔴 breaching charge active: click adjacent barricade in room."}
                {activeAbilityMode === 'emp_grenade' && "🔴 emp grenade active: click any turret tile in room."}
              </div>
            )}

            <div className="flex gap-2">
              {unlockedAbilities.map((ability) => {
                const isActive = activeAbilityMode === ability;
                
                // Icon, display name, description mapping
                let label = "Ability";
                let desc = "";
                let iconClass = "⚡";
                
                if (ability === 'medkit') {
                  label = "Combat Medkit";
                  desc = "Heal member +40 HP";
                  iconClass = "💚";
                } else if (ability === 'breaching_charge') {
                  label = "Breach Charge";
                  desc = "Blast adjacent barricade";
                  iconClass = "💥";
                } else if (ability === 'emp_grenade') {
                  label = "EMP Grenade";
                  desc = "Stun turrets 6s";
                  iconClass = "🔌";
                }

                return (
                  <button
                    key={ability}
                    onClick={() => {
                      if (isActive) {
                        useRaidStore.getState().setActiveAbilityMode(null);
                      } else {
                        useRaidStore.getState().setActiveAbilityMode(ability);
                      }
                    }}
                    className={`flex-1 flex items-center gap-1.5 border p-1.5 rounded-lg text-left transition-all pointer-events-auto ${
                      isActive 
                        ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_8px_rgba(224,242,254,0.4)] ring-1 ring-primary'
                        : 'border-primary/20 bg-background/50 hover:bg-primary/5 hover:border-primary/40 text-foreground'
                    }`}
                  >
                    <span className="text-base leading-none shrink-0">{iconClass}</span>
                    <div className="flex flex-col leading-none">
                      <span className="text-xs font-bold">{label}</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">{desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {stashHoldProgress > 0 ? (
          <div className="flex items-center gap-2 pt-1 border-t border-primary/10">
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

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-primary/10">
          <span className="text-xs text-muted-foreground">
            Phase: <span className="font-mono uppercase text-foreground">{phase}</span>
          </span>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 px-2 text-xs pointer-events-auto"
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
