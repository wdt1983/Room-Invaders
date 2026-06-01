"use client";

import { useEffect } from "react";
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

  // Keyboard Hotkeys listener for active combat
  useEffect(() => {
    if (phase !== 'active') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus check to prevent capturing typing inside chat console or inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toUpperCase();

      // 1. Squad roster selection (1 - 4)
      if (key >= '1' && key <= '4') {
        const index = parseInt(key) - 1;
        if (prepSquadMembers && index >= 0 && index < prepSquadMembers.length) {
          const member = prepSquadMembers[index];
          if (member && member.hp > 0) {
            EventBus.emit('change-active-unit', index);
          }
        }
      }

      // 2. Support Abilities (Q, W, E)
      if (unlockedAbilities && unlockedAbilities.length > 0) {
        let selectedAbility: string | null = null;
        if (key === 'Q' && unlockedAbilities.includes('medkit')) {
          selectedAbility = 'medkit';
        } else if (key === 'W' && unlockedAbilities.includes('breaching_charge')) {
          selectedAbility = 'breaching_charge';
        } else if (key === 'E' && unlockedAbilities.includes('emp_grenade')) {
          selectedAbility = 'emp_grenade';
        }

        if (selectedAbility) {
          if (selectedAbility === 'medkit') {
            // Instant cast Medkit on the currently active squad member
            const activeMember = prepSquadMembers[activeSquadIndex];
            if (activeMember && activeMember.hp > 0) {
              EventBus.emit('execute-ability', { ability: 'medkit', targetId: activeMember.entityId });
              useRaidStore.getState().setActiveAbilityMode(null);
            }
          } else {
            // Toggle targeting cursor mode for breach charges & EMPs
            const currentMode = useRaidStore.getState().activeAbilityMode;
            if (currentMode === selectedAbility) {
              useRaidStore.getState().setActiveAbilityMode(null);
            } else {
              useRaidStore.getState().setActiveAbilityMode(selectedAbility);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, prepSquadMembers, activeSquadIndex, unlockedAbilities]);

  if (!target || phase === 'results') return null;

  const lowTime = timeRemainingSeconds <= 15 && phase === 'active';
  const progress = durationSeconds > 0 ? (timeRemainingSeconds / durationSeconds) : 1;
  const hpProgress = squadMaxHp > 0 ? (squadHp / squadMaxHp) : 0;
  const lowHp = squadMaxHp > 0 && squadHp / squadMaxHp <= 0.3;

  const emitOutcome = (outcome: 'victory' | 'defeat', reason: string) => {
    EventBus.emit('raid-complete', { outcome, reason });
  };

  return (
    <div className="pointer-events-none absolute top-16 right-4 bottom-16 w-80 z-40 flex flex-col justify-center select-none">
      <div className="pointer-events-auto flex w-full flex-col gap-3 rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur max-h-[85vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Crosshair className="size-4 text-primary shrink-0" />
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {target.difficulty} raid
              </span>
              <span className="text-sm font-bold truncate text-foreground">{target.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-2xl tabular-nums shrink-0">
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
          <div className="flex items-center gap-2 border-b border-primary/10 pb-2.5">
            <Heart className={`size-4 shrink-0 ${lowHp ? 'text-destructive' : 'text-rose-400'}`} />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-[width] duration-200 ease-out ${lowHp ? 'bg-destructive' : 'bg-rose-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, hpProgress * 100))}%` }}
              />
            </div>
            <span className="w-16 text-right font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
              {squadHp} / {squadMaxHp}
            </span>
          </div>
        ) : null}

        {/* Deployed Squad Members Portraits (Phase 7) */}
        {prepSquadMembers && prepSquadMembers.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Squad Roster (Hotkeys 1-4 / Medkit)
            </span>
            <div className="flex flex-col gap-2">
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
                    className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-all pointer-events-auto w-full hover:scale-[1.01] active:scale-[0.99] ${
                      isDead 
                        ? 'opacity-40 border-muted bg-muted/20 cursor-not-allowed'
                        : isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500'
                          : 'border-primary/20 bg-background/50 hover:bg-primary/5 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] font-mono font-bold leading-none px-1.5 py-0.5 bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 rounded shrink-0 select-none">
                          {index + 1}
                        </span>
                        <span className="truncate text-xs font-bold text-foreground">
                          {member.name}
                        </span>
                      </div>
                      {member.activeAbility && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-primary/25 text-primary font-mono rounded shrink-0 leading-none">
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
                    <div className="flex justify-between items-center w-full text-[10px] font-mono text-muted-foreground leading-none">
                      <span>{isDead ? 'KIA' : `${member.hp}/${member.maxHp} HP`}</span>
                      
                      {/* Loadout icons summary */}
                      {!isDead && (member.weapon || member.armor || member.passiveGear) && (
                        <div className="flex gap-2 text-xs select-none">
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
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Support Abilities Panel (Phase 7) */}
        {unlockedAbilities && unlockedAbilities.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-primary/10 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Support Abilities (Hotkeys Q/W/E)
              </span>
              {activeAbilityMode && (
                <button 
                  onClick={() => useRaidStore.getState().setActiveAbilityMode(null)}
                  className="text-[10px] font-bold text-destructive hover:underline pointer-events-auto"
                >
                  Cancel
                </button>
              )}
            </div>
            
            {/* Ability Mode Feedback Banner */}
            {activeAbilityMode && (
              <div className="text-[10px] leading-tight border border-primary/30 bg-primary/10 text-primary-foreground p-2 rounded-lg text-center animate-pulse">
                {activeAbilityMode === 'medkit' && "🔴 Combat Medkit active: click squad card to heal 40 HP."}
                {activeAbilityMode === 'breaching_charge' && "🔴 Breach Charge active: click barricade in room."}
                {activeAbilityMode === 'emp_grenade' && "🔴 EMP Grenade active: click turret in room."}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {unlockedAbilities.map((ability) => {
                const isActive = activeAbilityMode === ability;
                
                // Icon, display name, description mapping
                let label = "Ability";
                let desc = "";
                let iconClass = "⚡";
                const hotkey = ability === 'medkit' ? 'Q' : ability === 'breaching_charge' ? 'W' : 'E';
                
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
                    className={`relative w-full flex items-center gap-3 border p-2.5 rounded-xl text-left transition-all pointer-events-auto hover:scale-[1.02] active:scale-[0.98] ${
                      isActive 
                        ? 'border-emerald-500 bg-emerald-500/10 text-foreground shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500'
                        : 'border-primary/20 bg-background/50 hover:bg-primary/5 hover:border-primary/40 text-foreground'
                    }`}
                  >
                    <span className="text-2xl leading-none shrink-0">{iconClass}</span>
                    <div className="flex flex-col leading-tight min-w-0 pr-8">
                      <span className="text-xs font-extrabold">{label}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{desc}</span>
                    </div>
                    {/* Hotkey Indicator Badge */}
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold leading-none px-2 py-1 bg-muted border border-border text-muted-foreground rounded-md shadow-sm">
                      {hotkey}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {stashHoldProgress > 0 ? (
          <div className="flex items-center gap-2 pt-2 border-t border-primary/10">
            <Package className="size-4 shrink-0 text-amber-400 animate-pulse" />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-amber-400 transition-[width] duration-100 ease-linear"
                style={{ width: `${Math.max(0, Math.min(100, stashHoldProgress * 100))}%` }}
              />
            </div>
            <span className="text-right font-mono text-[10px] font-bold text-amber-400 shrink-0">
              Capturing...
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-primary/10 mt-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">
            Phase: <span className="font-mono text-foreground">{phase}</span>
          </span>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 px-2.5 text-xs font-bold pointer-events-auto touch-target-expand rounded-xl shadow-lg shadow-destructive/10"
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
