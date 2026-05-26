"use client";

import React, { useState } from "react";
import { useRoomStore } from "@/lib/store/useRoomStore";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { upgradeRoomLevel, upgradeRoomSizeTier } from "@/app/(game)/room/actions";
import { 
  slotsForLevel, 
  roomUpgradeCost, 
  MAX_ROOM_LEVEL, 
  ROOM_SIZE_TIERS, 
  MAX_ROOM_SIZE_TIER,
  roomSizeUpgradeCost
} from "@/lib/game/defense";
import { entryPointsForLevel } from "@/lib/game/entryPoints";
import { EventBus } from "@/game/EventBus";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield,
  ArrowRight,
  Check,
  AlertTriangle,
  Grid,
  Cpu,
  Cog,
  Sparkles,
  Lock,
  Maximize2,
} from "lucide-react";

export function UpgradePanel() {
  const roomLevel = useRoomStore((state) => state.roomLevel ?? 1);
  const roomSizeTier = useRoomStore((state) => state.roomSizeTier ?? 1);
  const gridSize = useRoomStore((state) => state.gridSize ?? 10);
  const scrap = usePlayerStore((state) => state.scrap ?? 0);
  const components = usePlayerStore((state) => state.components ?? 0);
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"level" | "grid">("level");

  // Tab 1: Stronghold Level Upgrade Math
  const isMaxLevel = roomLevel >= MAX_ROOM_LEVEL;
  const nextLevel = roomLevel + 1;
  const levelCost = roomUpgradeCost(roomLevel);
  const hasScrapForLevel = scrap >= levelCost.scrap;
  const hasComponentsForLevel = components >= levelCost.components;
  const canAffordLevel = hasScrapForLevel && hasComponentsForLevel;

  const currentLevelCaps = slotsForLevel(roomLevel);
  const nextLevelCaps = slotsForLevel(nextLevel);

  // Derive entry point counts
  const currentEntries = entryPointsForLevel(roomLevel, gridSize).length;
  const nextEntries = isMaxLevel ? currentEntries : entryPointsForLevel(nextLevel, nextLevelCaps.grid).length;

  // Tab 2: Stronghold Grid Size Upgrade Math
  const isMaxSizeTier = roomSizeTier >= MAX_ROOM_SIZE_TIER;
  const nextSizeTier = roomSizeTier + 1;
  const sizeCost = roomSizeUpgradeCost(roomSizeTier);
  const hasScrapForSize = scrap >= sizeCost.scrap;
  const hasComponentsForSize = components >= sizeCost.components;
  const canAffordSize = hasScrapForSize && hasComponentsForSize;

  const currentSizeInfo = ROOM_SIZE_TIERS[roomSizeTier] || { grid: 10, name: "Standard Room" };
  const nextSizeInfo = ROOM_SIZE_TIERS[nextSizeTier];

  const handleLevelUpgrade = async () => {
    if (!canAffordLevel || loading || isMaxLevel) return;
    setLoading(true);

    try {
      const res = await upgradeRoomLevel(roomLevel);

      if (res.success) {
        // 1. Update Zustands
        useRoomStore.getState().setDefenseStats({
          roomLevel: res.newRoomLevel,
          defenseSlotsCap: res.newDefenseSlotsCap,
          defenseRating: res.defenseRating,
          defenseSlotsUsed: res.defenseSlotsUsed,
        });
        useRoomStore.getState().setRoomState(res.newGridSize, useRoomStore.getState().placedItems);
        useRoomStore.getState().setEntryPoints(res.newEntryPoints);
        usePlayerStore.getState().setInventory({
          scrap: res.newScrap,
          components: res.newComponents,
          storageCapacity: res.newStorageCapacity,
        });

        // 2. Restart Phaser Scene dynamically
        EventBus.emit("room-upgraded");

        // 3. Show beautiful notification
        toast.success(`Stronghold Level Upgraded to Level ${res.newRoomLevel}!`, {
          description: `Grid expanded to ${res.newGridSize}×${res.newGridSize} · Protected capacity increased!`,
          duration: 5000,
        });

        setOpen(false);
      } else {
        toast.error("Upgrade failed", { description: res.error });
      }
    } catch (err) {
      console.error("Upgrade error:", err);
      toast.error("Upgrade failed", { description: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const handleSizeUpgrade = async () => {
    if (!canAffordSize || loading || isMaxSizeTier) return;
    setLoading(true);

    try {
      const res = await upgradeRoomSizeTier(roomSizeTier);

      if (res.success) {
        // 1. Update Zustands
        useRoomStore.getState().setDefenseStats({
          defenseRating: res.defenseRating,
          defenseSlotsUsed: res.defenseSlotsUsed,
        });
        useRoomStore.getState().setRoomState(res.newGridSize, useRoomStore.getState().placedItems, res.newRoomSizeTier);
        useRoomStore.getState().setEntryPoints(res.newEntryPoints);
        usePlayerStore.getState().setInventory({
          scrap: res.newScrap,
          components: res.newComponents,
        });

        // 2. Restart Phaser Scene dynamically
        EventBus.emit("room-upgraded");

        // 3. Show beautiful notification
        toast.success(`Stronghold Sized Upgraded to Tier ${res.newRoomSizeTier} (${nextSizeInfo.name})!`, {
          description: `Grid size expanded to ${res.newGridSize}×${res.newGridSize} · Layout expanded successfully!`,
          duration: 5000,
        });

        setOpen(false);
      } else {
        toast.error("Size expansion failed", { description: res.error });
      }
    } catch (err) {
      console.error("Size upgrade error:", err);
      toast.error("Size expansion failed", { description: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  // Helper to describe added features at specific levels
  const getUnlockDetails = (lvl: number) => {
    if (lvl === 5) return "+Skylight (West Vent)";
    if (lvl === 10) return "+Breach Wall (North Door)";
    if (lvl === 15) return "+Second Window (South Window)";
    if (lvl === 20) return "+Tunnel (East Door)";
    return null;
  };

  const unlockedFeature = getUnlockDetails(nextLevel);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 touch-target-expand"
            title={`Base Room Level: ${roomLevel}`}
          >
            <Shield className="mr-1.5 size-3.5" />
            Base Lvl {roomLevel} ({gridSize}x{gridSize})
          </Button>
        }
      />
      <DialogContent className="max-w-md border-border bg-background/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <Sparkles className="size-5 text-cyan-400 animate-pulse" />
            Stronghold Construction Console
          </DialogTitle>
        </DialogHeader>

        {/* Cybersecurity Glassmorphic Tab Selectors */}
        <div className="flex border-b border-border/10 mb-4 bg-muted/20 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("level")}
            className={`flex-1 py-1.5 text-xs font-black tracking-wider uppercase rounded-md transition-all duration-300 flex items-center justify-center gap-1.5 ${
              activeTab === "level"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-muted-foreground hover:text-white border border-transparent"
            }`}
          >
            <Shield className="size-3.5" />
            Stronghold Level
          </button>
          <button
            onClick={() => setActiveTab("grid")}
            className={`flex-1 py-1.5 text-xs font-black tracking-wider uppercase rounded-md transition-all duration-300 flex items-center justify-center gap-1.5 ${
              activeTab === "grid"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-muted-foreground hover:text-white border border-transparent"
            }`}
          >
            <Maximize2 className="size-3.5" />
            Grid Expansion
          </button>
        </div>

        {activeTab === "level" ? (
          /* ========================================================
             TAB 1: Stronghold Level Upgrades
             ======================================================== */
          isMaxLevel ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <Shield className="size-16 text-cyan-400 mb-4 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
              <h3 className="font-display font-semibold text-lg">Stronghold Level Maxed Out!</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Your room level is at maximum (Level 20). Your digital fortress is fully secured.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-2">
              {/* Header Level Comparison badge */}
              <div className="flex items-center justify-center gap-3 py-3 px-4 bg-muted/50 rounded-lg border border-border">
                <span className="font-mono text-sm font-semibold px-2 py-0.5 bg-background rounded border border-border">
                  Level {roomLevel}
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
                <span className="font-mono text-sm font-bold text-cyan-400 px-2 py-0.5 bg-cyan-950/40 border border-cyan-800/60 rounded">
                  Level {nextLevel}
                </span>
              </div>

              {/* Premium Stat cards */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="p-3 bg-muted/20 border-border/80 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Grid className="size-3.5 text-amber-400" />
                    Grid Dimensions
                  </div>
                  <div className="font-mono font-bold text-sm mt-1.5 flex items-center gap-1">
                    <span>{currentLevelCaps.grid}×{currentLevelCaps.grid}</span>
                    {nextLevelCaps.grid > currentLevelCaps.grid && (
                      <>
                        <ArrowRight className="size-3 text-cyan-400" />
                        <span className="text-cyan-400">{nextLevelCaps.grid}×{nextLevelCaps.grid}</span>
                      </>
                    )}
                  </div>
                </Card>

                <Card className="p-3 bg-muted/20 border-border/80 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="size-3.5 text-sky-400" />
                    Defense Slots
                  </div>
                  <div className="font-mono font-bold text-sm mt-1.5 flex items-center gap-1">
                    <span>{currentLevelCaps.defense}</span>
                    {nextLevelCaps.defense > currentLevelCaps.defense && (
                      <>
                        <ArrowRight className="size-3 text-cyan-400" />
                        <span className="text-cyan-400">{nextLevelCaps.defense}</span>
                      </>
                    )}
                  </div>
                </Card>

                <Card className="p-3 bg-muted/20 border-border/80 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5 text-emerald-400" />
                    Protected Capacity
                  </div>
                  <div className="font-mono font-bold text-sm mt-1.5 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <span>{roomLevel * 500}</span>
                      <ArrowRight className="size-3 text-cyan-400" />
                      <span className="text-cyan-400">{nextLevel * 500}</span>
                      <span className="text-[10px] text-muted-foreground">Scrap</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                      <span>{roomLevel * 125}</span>
                      <ArrowRight className="size-2.5 text-cyan-400" />
                      <span className="text-cyan-400">{nextLevel * 125}</span>
                      <span className="text-[9px]">Comp</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-3 bg-muted/20 border-border/80 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5 text-rose-400" />
                    Entry Points
                  </div>
                  <div className="font-mono font-bold text-sm mt-1.5 flex items-center gap-1">
                    <span>{currentEntries}</span>
                    {nextEntries > currentEntries && (
                      <>
                        <ArrowRight className="size-3 text-cyan-400" />
                        <span className="text-cyan-400">{nextEntries}</span>
                      </>
                    )}
                  </div>
                </Card>
              </div>

              {/* Special unlocks banner */}
              {unlockedFeature && (
                <div className="p-2.5 bg-cyan-950/20 border border-cyan-800/40 rounded-lg flex items-center gap-2">
                  <Sparkles className="size-4 text-cyan-400 shrink-0" />
                  <span className="text-xs text-cyan-300 font-medium">
                    Unlocks Entry Point: <strong className="text-white">{unlockedFeature}</strong>
                  </span>
                </div>
              )}

              {/* Costs Display */}
              <div className="flex flex-col gap-2 mt-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Level Upgrade Costs
                </h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <Card className={`p-2.5 flex items-center justify-between border ${hasScrapForLevel ? 'border-border/60 bg-muted/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    <div className="flex items-center gap-2">
                      <Cog className={`size-4 ${hasScrapForLevel ? 'text-amber-400' : 'text-destructive'}`} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground">Scrap</span>
                        <span className={`font-mono text-sm font-bold ${hasScrapForLevel ? '' : 'text-destructive'}`}>
                          {scrap}/{levelCost.scrap}
                        </span>
                      </div>
                    </div>
                    {hasScrapForLevel ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="size-4 text-destructive" />
                    )}
                  </Card>

                  <Card className={`p-2.5 flex items-center justify-between border ${hasComponentsForLevel ? 'border-border/60 bg-muted/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    <div className="flex items-center gap-2">
                      <Cpu className={`size-4 ${hasComponentsForLevel ? 'text-sky-400' : 'text-destructive'}`} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground">Components</span>
                        <span className={`font-mono text-sm font-bold ${hasComponentsForLevel ? '' : 'text-destructive'}`}>
                          {components}/{levelCost.components}
                        </span>
                      </div>
                    </div>
                    {hasComponentsForLevel ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="size-4 text-destructive" />
                    )}
                  </Card>
                </div>
              </div>

              {/* Action button */}
              <Button
                className={`w-full mt-4 font-semibold text-sm h-10 ${canAffordLevel ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : ''}`}
                disabled={!canAffordLevel || loading}
                onClick={handleLevelUpgrade}
              >
                {loading ? "Upgrading Stronghold..." : canAffordLevel ? "Upgrade Room" : "Insufficient Resources"}
              </Button>
            </div>
          )
        ) : (
          /* ========================================================
             TAB 2: Room Grid Sizing Upgrades (Task 9.0.24)
             ======================================================== */
          isMaxSizeTier ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <Grid className="size-16 text-cyan-400 mb-4 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)] animate-pulse" />
              <h3 className="font-display font-semibold text-lg">Dimensions Fully Expanded!</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Your stronghold is already expanded to the ultimate layout dimensions (Tier 5 - 18x18 house dimensions).
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-2">
              {/* Header Sizing Comparison badge */}
              <div className="flex flex-col items-center justify-center gap-1.5 py-3 px-4 bg-muted/50 rounded-lg border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Expand Layout Blueprint</span>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-sm font-semibold px-2 py-0.5 bg-background rounded border border-border flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground">Tier {roomSizeTier}</span>
                    <span>{currentSizeInfo.grid}×{currentSizeInfo.grid}</span>
                  </span>
                  <ArrowRight className="size-4 text-cyan-400" />
                  <span className="font-mono text-sm font-bold text-cyan-400 px-2 py-0.5 bg-cyan-950/40 border border-cyan-800/60 rounded flex flex-col items-center">
                    <span className="text-[10px] text-cyan-300">Tier {nextSizeTier}</span>
                    <span>{nextSizeInfo.grid}×{nextSizeInfo.grid}</span>
                  </span>
                </div>
              </div>

              {/* Expansion Details */}
              <Card className="p-3.5 bg-muted/20 border-border/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Maximize2 className="size-4 text-cyan-400" />
                  Blueprint Details: <span className="text-cyan-400">{nextSizeInfo.name}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Expanding the stronghold boundaries lets you construct advanced trap chains, place extensive decorative corridors, and enforce deep perimeter defense grids.
                </p>
              </Card>

              {/* Costs Display */}
              <div className="flex flex-col gap-2 mt-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Grid Expansion Costs
                </h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <Card className={`p-2.5 flex items-center justify-between border ${hasScrapForSize ? 'border-border/60 bg-muted/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    <div className="flex items-center gap-2">
                      <Cog className={`size-4 ${hasScrapForSize ? 'text-amber-400' : 'text-destructive'}`} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground">Scrap</span>
                        <span className={`font-mono text-sm font-bold ${hasScrapForSize ? '' : 'text-destructive'}`}>
                          {scrap}/{sizeCost.scrap}
                        </span>
                      </div>
                    </div>
                    {hasScrapForSize ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="size-4 text-destructive" />
                    )}
                  </Card>

                  <Card className={`p-2.5 flex items-center justify-between border ${hasComponentsForSize ? 'border-border/60 bg-muted/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    <div className="flex items-center gap-2">
                      <Cpu className={`size-4 ${hasComponentsForSize ? 'text-sky-400' : 'text-destructive'}`} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground">Components</span>
                        <span className={`font-mono text-sm font-bold ${hasComponentsForSize ? '' : 'text-destructive'}`}>
                          {components}/{sizeCost.components}
                        </span>
                      </div>
                    </div>
                    {hasComponentsForSize ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="size-4 text-destructive" />
                    )}
                  </Card>
                </div>
              </div>

              {/* Action button */}
              <Button
                className={`w-full mt-4 font-semibold text-sm h-10 ${canAffordSize ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : ''}`}
                disabled={!canAffordSize || loading}
                onClick={handleSizeUpgrade}
              >
                {loading ? "Constructing Expanded Grid..." : canAffordSize ? `Upgrade Grid to ${nextSizeInfo.grid}x${nextSizeInfo.grid}` : "Insufficient Resources"}
              </Button>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
