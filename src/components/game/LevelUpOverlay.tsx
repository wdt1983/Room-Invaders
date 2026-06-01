"use client";

import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/lib/store/useUIStore";
import { useRoomStore } from "@/lib/store/useRoomStore";
import { SoundManager } from "@/game/objects/SoundManager";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  Sparkles, 
  Lock, 
  ChevronRight, 
  X, 
  ArrowUpRight, 
  TrendingUp, 
  Cpu, 
  ShieldAlert, 
  Swords, 
  Layers 
} from "lucide-react";

/**
 * Systemic Milestones mapping player levels to core feature unlocks
 */
const SYSTEMIC_UNLOCKS: Record<number, { title: string; desc: string; icon: any }> = {
  3: {
    title: "Tactical Squad Tech Tree",
    desc: "Spend tech points across Offense, Defense, and Utility nodes to boost combat stats.",
    icon: Cpu
  },
  5: {
    title: "PvP Raiding & Matchmaking",
    desc: "Breach rival player coordinate grids to plunder overflow scrap & earn Reputation Points!",
    icon: Swords
  },
  8: {
    title: "Advanced Security Defenses",
    desc: "Unlock lethal defensive systems including Tesla Coils, Patrol Drones, and Flame Vents.",
    icon: ShieldAlert
  },
  10: {
    title: "Raider Squad Slot #2",
    desc: "Field two squad members in raids to pull off advanced split-entry breach operations.",
    icon: ArrowUpRight
  },
  15: {
    title: "Stronghold Grid Expansion",
    desc: "Unlock grid scaling upgrades allowing up to 12x12 custom stronghold architectures.",
    icon: Layers
  },
  20: {
    title: "Clan Outposts & shared vaults",
    desc: "Establish cooperative stronghold districts, share boundary resources, and fund clan banks.",
    icon: Trophy
  },
  25: {
    title: "Raider Squad Slot #3",
    desc: "Formulate three-raider strike teams for overwhelming cooperative raid superiority.",
    icon: Swords
  }
};

export function LevelUpOverlay() {
  const levelUpOverlay = useUIStore((state) => state.levelUpOverlay);
  const closeLevelUpOverlay = useUIStore((state) => state.closeLevelUpOverlay);
  const catalog = useRoomStore((state) => state.catalog);

  const [mounted, setMounted] = useState(false);
  const isTriggered = levelUpOverlay?.isOpen ?? false;
  const previousLevel = levelUpOverlay?.previousLevel ?? 1;
  const newLevel = levelUpOverlay?.newLevel ?? 2;

  // Sound and visual triggering
  useEffect(() => {
    if (isTriggered) {
      setMounted(true);
      // Play premium level-up celebratory sound
      try {
        SoundManager.getInstance().playSfx("victory");
      } catch (err) {
        console.warn("Failed to play level-up SFX:", err);
      }
    } else {
      setMounted(false);
    }
  }, [isTriggered]);

  if (!isTriggered || !mounted) return null;

  // 1. Scan catalog for placeable items unlocked in this level window (previousLevel, newLevel]
  const unlockedCatalogItems = catalog.filter(
    (item) => item.unlock_level > previousLevel && item.unlock_level <= newLevel
  );

  // 2. Scan systemic milestones unlocked in this level window
  const unlockedMilestones: Array<{ level: number; title: string; desc: string; icon: any }> = [];
  for (let l = previousLevel + 1; l <= newLevel; l++) {
    if (SYSTEMIC_UNLOCKS[l]) {
      unlockedMilestones.push({ level: l, ...SYSTEMIC_UNLOCKS[l] });
    }
  }

  // 3. Stat scaling calculations
  const getScrapCap = (lvl: number) => Math.max(1, lvl) * 1000;
  const getCompCap = (lvl: number) => Math.max(1, lvl) * 250;

  const prevScrapCap = getScrapCap(previousLevel);
  const nextScrapCap = getScrapCap(newLevel);
  const prevCompCap = getCompCap(previousLevel);
  const nextCompCap = getCompCap(newLevel);

  const totalUnlocksCount = unlockedCatalogItems.length + unlockedMilestones.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-in fade-in duration-300">
      {/* Neon Cyber Particles Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.15),transparent_60%)] pointer-events-none animate-pulse" />
      
      {/* Container Card with cyber highlights */}
      <div className="relative w-full max-w-2xl border border-emerald-500/30 bg-card/90 shadow-[0_0_50px_-12px_rgba(16,185,129,0.4)] backdrop-blur rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        
        {/* Top bar neon border */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse" />

        {/* Modal close */}
        <button 
          onClick={closeLevelUpOverlay}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground transition-all hover:scale-110"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center space-y-2 select-none shrink-0">
          <div className="inline-flex rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-400 animate-bounce">
            <Trophy className="size-10" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent uppercase animate-pulse">
            Level Promoted!
          </h1>
          <div className="flex items-center justify-center gap-3 text-lg font-mono font-bold text-foreground">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              Lvl {previousLevel}
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
            <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 animate-pulse">
              Lvl {newLevel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Your coordinate signatures have been updated. Tech capacities expanded.
          </p>
        </div>

        {/* Scrollable unlocks and metrics dashboard */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6 scrollbar-thin">
          
          {/* 1. Stat Capacities Increase */}
          <div className="space-y-2">
            <h3 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-emerald-400" />
              Resource Storage Upgrades
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Scrap capacity Card */}
              <div className="bg-background/45 border border-border/50 rounded-2xl p-4 flex justify-between items-center shadow-inner">
                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold">Max Scrap Limit</span>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {prevScrapCap.toLocaleString()} → <strong className="text-emerald-400">{nextScrapCap.toLocaleString()}</strong>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded font-bold">
                  +{nextScrapCap - prevScrapCap}
                </span>
              </div>

              {/* Components capacity Card */}
              <div className="bg-background/45 border border-border/50 rounded-2xl p-4 flex justify-between items-center shadow-inner">
                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold">Max Components Limit</span>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {prevCompCap.toLocaleString()} → <strong className="text-emerald-400">{nextCompCap.toLocaleString()}</strong>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded font-bold">
                  +{nextCompCap - prevCompCap}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Unlocks list */}
          <div className="space-y-3.5">
            <h3 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-emerald-400 animate-pulse" />
              Milestones & Items Unlocked ({totalUnlocksCount})
            </h3>

            {totalUnlocksCount > 0 ? (
              <div className="space-y-3">
                {/* Systemic Milestone Unlocks */}
                {unlockedMilestones.map((m) => {
                  const IconComponent = m.icon;
                  return (
                    <div 
                      key={`milestone-${m.level}`}
                      className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-3.5 flex gap-3.5 items-start relative shadow-inner animate-in slide-in-from-left-4 duration-300"
                    >
                      <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-emerald-400 shrink-0 mt-0.5">
                        <IconComponent className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-foreground text-sm leading-none">
                            {m.title}
                          </h4>
                          <span className="text-[9px] font-extrabold text-emerald-300 bg-emerald-500/25 border border-emerald-500/40 px-1.5 py-0.5 rounded leading-none">
                            Lvl {m.level} Unlock
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed pr-4">
                          {m.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Catalog Placeable Item Unlocks */}
                {unlockedCatalogItems.map((item) => (
                  <div 
                    key={`item-${item.id}`}
                    className="border border-border/50 bg-background/30 rounded-2xl p-3.5 flex gap-3.5 items-start relative shadow-inner animate-in slide-in-from-left-4 duration-300"
                  >
                    {/* Visual icon for item category */}
                    <div className="rounded-xl bg-primary/10 border border-primary/20 p-2.5 text-primary shrink-0 mt-0.5 font-bold text-sm">
                      {item.type === 'turret' ? '🎯' : item.type === 'trap' ? '⚡' : '🛡️'}
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-foreground text-sm leading-none">
                            {item.name}
                          </h4>
                          <span className="text-[9px] uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded leading-none">
                            {item.type}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground font-mono">
                          Unlocks at Lvl {item.unlock_level}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {(item as any).description || item.stats?.description || "Advanced security defensive unit."}
                      </p>
                      
                      {/* Cost representation */}
                      {item.cost && (
                        <div className="flex gap-2 text-[9px] font-mono text-muted-foreground pt-1.5">
                          {item.cost.scrap && <span>⚙️ {item.cost.scrap} Scrap</span>}
                          {item.cost.components && <span>🎛️ {item.cost.components} Components</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-border/50 bg-background/20 rounded-2xl p-6 text-center text-muted-foreground shadow-inner select-none leading-relaxed">
                <Lock className="size-6 mx-auto mb-2 opacity-30 text-muted-foreground" />
                <p className="text-xs">
                  No catalog blueprints unlocked at this level.
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Keep upgrading to unlock advanced turrets and traps at Level 3, 5, 8, and 10!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-6 border-t border-border/40 bg-background/40 flex flex-col sm:flex-row gap-3 justify-between items-center shrink-0">
          <div className="text-[10px] text-emerald-400/80 font-bold bg-emerald-500/5 px-2.5 py-1.5 rounded-xl border border-emerald-500/10 flex items-center gap-1.5 select-none">
            <Sparkles className="size-3.5 text-emerald-400 animate-pulse" />
            +1 Tech Point Credited to Squad Tree!
          </div>
          <Button 
            onClick={closeLevelUpOverlay}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs px-6 py-4 rounded-xl shadow-lg shadow-emerald-500/20"
          >
            Acknowledge Promoted Coordinates
          </Button>
        </div>
      </div>
    </div>
  );
}
