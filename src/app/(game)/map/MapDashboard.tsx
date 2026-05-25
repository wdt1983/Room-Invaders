// src/app/(game)/map/MapDashboard.tsx
//
// Phase 5 & 6 — Map Dashboard incorporating the visual NeighborhoodMap.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Map, ScanEye, User, Shield, ShieldAlert, Swords, Target, Eye, AlertTriangle } from "lucide-react";
import { NeighborhoodMap } from "./NeighborhoodMap";

interface ScoutTarget {
  id: string;
  username: string;
  player_level: number;
  room_level: number;
  grid_size: number;
  defense_rating: number;
  scrap_overflow: number;
  components_overflow: number;
}

interface FriendProfile {
  id: string;
  username: string;
  player_level: number;
  room_level?: number;
  defense_rating?: number;
}

interface MapDashboardProps {
  targets: ScoutTarget[];
  bracketRange: string;
  fallbackActive: boolean;
  playerProfile: {
    id: string;
    username: string;
    player_level: number;
  };
  friends: FriendProfile[];
}

export function MapDashboard({ 
  targets, 
  bracketRange, 
  fallbackActive,
  playerProfile,
  friends 
}: MapDashboardProps) {
  const [selectedTarget, setSelectedTarget] = useState<ScoutTarget | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "scanner">("map");

  const handleScout = (target: ScoutTarget) => {
    setSelectedTarget(target);
  };

  return (
    <div className="space-y-6">
      {/* Visual Navigation Tabs */}
      <div className="flex bg-background/50 border border-border/40 p-1 rounded-2xl max-w-sm shadow-md backdrop-blur">
        <button
          onClick={() => setViewMode("map")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 ${
            viewMode === "map"
              ? "bg-primary text-primary-foreground shadow-lg"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Map className="w-4 h-4" />
          Neighborhood Grid
        </button>
        <button
          onClick={() => setViewMode("scanner")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 ${
            viewMode === "scanner"
              ? "bg-primary text-primary-foreground shadow-lg"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <ScanEye className="w-4 h-4" />
          Scanner List
        </button>
      </div>

      {viewMode === "map" ? (
        <NeighborhoodMap 
          playerProfile={playerProfile} 
          pvpTargets={targets} 
          friends={friends} 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {targets && targets.length > 0 ? (
            targets.map((target) => {
              const hasLoot = target.scrap_overflow > 0 || target.components_overflow > 0;
              return (
                <Card 
                  key={target.id} 
                  className="border-primary/20 bg-card/40 backdrop-blur shadow-xl hover:border-primary/40 hover:bg-card/50 transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex justify-between items-start">
                      <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {target.username}
                      </CardTitle>
                      <div className="bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold">
                        Lv. {target.player_level}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="py-3.5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stronghold Level:</span>
                      <span className="font-bold text-foreground">Lvl {target.room_level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grid Dimensions:</span>
                      <span className="font-mono text-foreground">{target.grid_size}x{target.grid_size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Defense Rating:</span>
                      <span className="font-mono font-bold text-cyan-400">🛡️ {target.defense_rating}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-dashed border-border/40">
                      <span className="text-muted-foreground flex items-center gap-1">
                        Raidable Stakes:
                      </span>
                      <span className={`font-semibold ${hasLoot ? "text-emerald-400" : "text-amber-400/80"}`}>
                        {hasLoot ? "💎 High Assets" : "⚠️ RP Only (No Overflow)"}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 border-t border-border/50">
                    <Button 
                      onClick={() => handleScout(target)}
                      variant="default" 
                      className="w-full gap-2 text-xs font-bold h-10 bg-primary/80 hover:bg-primary"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Scout Stronghold
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-muted-foreground bg-card/30 rounded-lg border border-dashed border-border/60 shadow-inner">
              <ShieldAlert className="w-12 h-12 mb-4 opacity-50 text-cyan-400 animate-pulse" />
              <h3 className="text-lg font-medium text-foreground">No Vulnerable Targets</h3>
              <p className="text-xs text-center max-w-sm mt-2 leading-relaxed text-muted-foreground">
                Every coordinate in your room bracket has active ceasefire protocols or shields. Check back as shields expire!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Interactive Scouting Detail Dialog */}
      <Dialog open={selectedTarget !== null} onOpenChange={(open) => !open && setSelectedTarget(null)}>
        {selectedTarget && (
          <DialogContent className="sm:max-w-[480px] bg-card/90 border border-primary/30 backdrop-blur-md shadow-2xl p-6 rounded-2xl select-none">
            <DialogHeader className="space-y-1.5 pb-4 border-b border-border/50">
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <div className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
                </div>
                Scout File: {selectedTarget.username}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Analyzing target metrics. Safe Mode ceasefire has expired.
              </DialogDescription>
            </DialogHeader>

            <div className="py-5 space-y-5">
              {/* Pulsing Radar Visual */}
              <div className="flex justify-center py-2 relative">
                <div className="w-24 h-24 rounded-full border border-primary/20 flex items-center justify-center relative animate-pulse bg-primary/5">
                  <Swords className="w-10 h-10 text-primary animate-bounce duration-1000" />
                  <div className="absolute inset-0 rounded-full border border-dashed border-primary/35 animate-spin duration-[12000ms]"></div>
                </div>
              </div>

              {/* Defender Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-background/40 border border-border/40 p-3 rounded-xl flex flex-col gap-1 shadow-inner">
                  <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    Defense Cap
                  </span>
                  <span className="text-sm font-bold text-foreground">Rating: {selectedTarget.defense_rating}</span>
                </div>

                <div className="bg-background/40 border border-border/40 p-3 rounded-xl flex flex-col gap-1 shadow-inner">
                  <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                    <Target className="w-3.5 h-3.5 text-red-400" />
                    Grid Sizing
                  </span>
                  <span className="text-sm font-bold text-foreground">{selectedTarget.grid_size}x{selectedTarget.grid_size} Tiles</span>
                </div>
                
                <div className="bg-background/40 border border-border/40 p-3 rounded-xl flex flex-col gap-1 shadow-inner">
                  <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    Stronghold Level
                  </span>
                  <span className="text-sm font-bold text-foreground">Tier {selectedTarget.room_level} Room</span>
                </div>

                <div className="bg-background/40 border border-border/40 p-3 rounded-xl flex flex-col gap-1 shadow-inner">
                  <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                    <Eye className="w-3.5 h-3.5 text-purple-400" />
                    Replays Logged
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {Math.max(1, Math.floor((selectedTarget.defense_rating + selectedTarget.room_level * 5) % 15))} recorded
                  </span>
                </div>
              </div>

              {/* Raidable Overflow Assets */}
              <div className="bg-background/60 border border-primary/20 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                    Raidable Loot Pool
                  </h4>
                  <span className="text-[10px] text-muted-foreground">50% of defender overflow</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Scrap Pool */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-muted-foreground">⚙️ Scrap plundered:</span>
                      <span className={selectedTarget.scrap_overflow > 0 ? "text-emerald-400" : "text-muted-foreground"}>
                        {selectedTarget.scrap_overflow} units
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (selectedTarget.scrap_overflow / 300) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Components Pool */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-muted-foreground">🎛️ Components plundered:</span>
                      <span className={selectedTarget.components_overflow > 0 ? "text-emerald-400" : "text-muted-foreground"}>
                        {selectedTarget.components_overflow} units
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                      <div 
                        className="h-full bg-cyan-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (selectedTarget.components_overflow / 80) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {selectedTarget.scrap_overflow === 0 && selectedTarget.components_overflow === 0 && (
                  <p className="text-[10px] text-amber-400 leading-normal bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 shadow-inner">
                    This stronghold has no resource overflows to pillage because their stockpiles are protected under storage capacity ceilings. Victory will award **Reputation Points (RP)** only.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-row gap-3 pt-3 border-t border-border/50">
              <Button 
                onClick={() => setSelectedTarget(null)}
                variant="outline" 
                className="flex-1 text-xs font-bold border-border/80 hover:bg-muted"
              >
                Close File
              </Button>
              <Link href={`/raid/${selectedTarget.id}`} className="flex-1">
                <Button 
                  className="w-full text-xs font-bold bg-red-600 hover:bg-red-500 border border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)] animate-pulse"
                >
                  Launch Raid
                </Button>
              </Link>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
