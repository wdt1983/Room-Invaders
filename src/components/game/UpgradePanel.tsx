"use client";

import React, { useState } from "react";
import { useRoomStore } from "@/lib/store/useRoomStore";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { upgradeRoomLevel } from "@/app/(game)/room/actions";
import { slotsForLevel, roomUpgradeCost, MAX_ROOM_LEVEL } from "@/lib/game/defense";
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
} from "lucide-react";

export function UpgradePanel() {
  const roomLevel = useRoomStore((state) => state.roomLevel ?? 1);
  const scrap = usePlayerStore((state) => state.scrap ?? 0);
  const components = usePlayerStore((state) => state.components ?? 0);
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isMaxLevel = roomLevel >= MAX_ROOM_LEVEL;
  const nextLevel = roomLevel + 1;
  const cost = roomUpgradeCost(roomLevel);
  const hasScrap = scrap >= cost.scrap;
  const hasComponents = components >= cost.components;
  const canAfford = hasScrap && hasComponents;

  const currentCaps = slotsForLevel(roomLevel);
  const nextCaps = slotsForLevel(nextLevel);

  // Derive entry point counts
  const currentEntries = entryPointsForLevel(roomLevel, currentCaps.grid).length;
  const nextEntries = isMaxLevel ? currentEntries : entryPointsForLevel(nextLevel, nextCaps.grid).length;

  const handleUpgrade = async () => {
    if (!canAfford || loading || isMaxLevel) return;
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
        toast.success(`Base Room Upgraded to Level ${res.newRoomLevel}!`, {
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
            className="h-8 px-2 text-xs border-cyan-500 text-cyan-400 hover:bg-cyan-500/20"
            title={`Base Room Level: ${roomLevel}`}
          >
            <Shield className="mr-1.5 size-3.5" />
            Base Lvl {roomLevel}
          </Button>
        }
      />
      <DialogContent className="max-w-md border-border bg-background/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <Sparkles className="size-5 text-cyan-400 animate-pulse" />
            Base Stronghold Upgrade
          </DialogTitle>
        </DialogHeader>

        {isMaxLevel ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Shield className="size-16 text-cyan-400 mb-4 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
            <h3 className="font-display font-semibold text-lg">Stronghold Maxed Out!</h3>
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
                  <span>{currentCaps.grid}×{currentCaps.grid}</span>
                  {nextCaps.grid > currentCaps.grid && (
                    <>
                      <ArrowRight className="size-3 text-cyan-400" />
                      <span className="text-cyan-400">{nextCaps.grid}×{nextCaps.grid}</span>
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
                  <span>{currentCaps.defense}</span>
                  {nextCaps.defense > currentCaps.defense && (
                    <>
                      <ArrowRight className="size-3 text-cyan-400" />
                      <span className="text-cyan-400">{nextCaps.defense}</span>
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
                Upgrade Costs
              </h4>
              
              <div className="grid grid-cols-2 gap-2">
                <Card className={`p-2.5 flex items-center justify-between border ${hasScrap ? 'border-border/60 bg-muted/5' : 'border-destructive/30 bg-destructive/5'}`}>
                  <div className="flex items-center gap-2">
                    <Cog className={`size-4 ${hasScrap ? 'text-amber-400' : 'text-destructive'}`} />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground">Scrap</span>
                      <span className={`font-mono text-sm font-bold ${hasScrap ? '' : 'text-destructive'}`}>
                        {scrap}/{cost.scrap}
                      </span>
                    </div>
                  </div>
                  {hasScrap ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="size-4 text-destructive" />
                  )}
                </Card>

                <Card className={`p-2.5 flex items-center justify-between border ${hasComponents ? 'border-border/60 bg-muted/5' : 'border-destructive/30 bg-destructive/5'}`}>
                  <div className="flex items-center gap-2">
                    <Cpu className={`size-4 ${hasComponents ? 'text-sky-400' : 'text-destructive'}`} />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground">Components</span>
                      <span className={`font-mono text-sm font-bold ${hasComponents ? '' : 'text-destructive'}`}>
                        {components}/{cost.components}
                      </span>
                    </div>
                  </div>
                  {hasComponents ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="size-4 text-destructive" />
                  )}
                </Card>
              </div>
            </div>

            {/* Action button */}
            <Button
              className={`w-full mt-4 font-semibold text-sm h-10 ${canAfford ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : ''}`}
              disabled={!canAfford || loading}
              onClick={handleUpgrade}
            >
              {loading ? "Upgrading Stronghold..." : canAfford ? "Upgrade Room" : "Insufficient Resources"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
