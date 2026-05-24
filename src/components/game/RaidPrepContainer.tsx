/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition, useMemo } from "react";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { useSquadStore } from "@/lib/store/useSquadStore";
import { useRaidStore } from "@/lib/store/useRaidStore";
import { scoutTargetAction } from "@/app/(game)/raid/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { GameWrapper } from "@/components/game/GameWrapper";
import { RaidInitializer } from "@/components/game/RaidInitializer";
import { RaidHUD } from "@/components/game/RaidHUD";
import { RaidResults } from "@/components/game/RaidResults";
import { RaidResolver } from "@/components/game/RaidResolver";
import { entryTileFor } from "@/lib/game/entryPoints";
import * as Icons from "lucide-react";

interface RaidPrepContainerProps {
  target: {
    id: string;
    name: string;
    difficulty: string;
    isPvP?: boolean;
    gridSize: number;
    entryPoints: any[];
    placedItems: any[];
    stash?: { x: number; y: number };
  };
  playerLevel: number;
}

export function RaidPrepContainer({ target, playerLevel }: RaidPrepContainerProps) {
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"prep" | "execute">("prep");
  const [scouted, setScouted] = useState(false);

  // Zustand stores
  const playerIntel = usePlayerStore((state) => state.intel);
  const setInventory = usePlayerStore((state) => state.setInventory);
  const activeEffects = usePlayerStore((state) => state.activeEffects);
  const squadMembers = useSquadStore((state) => state.members);
  const isSlotLocked = useSquadStore((state) => state.isLocked);

  // Local prep assignments: Maps slot number to index of entryPoints
  const [assignments, setAssignments] = useState<Record<number, number>>({});

  // Active (unlocked) squad members
  const activeMembers = useMemo(() => {
    return squadMembers.filter((m) => !isSlotLocked(m.slotNumber, playerLevel));
  }, [squadMembers, isSlotLocked, playerLevel]);

  // Dynamic Intel scouting cost
  const intelCost = useMemo(() => {
    const base = target.isPvP ? 12 : 5;
    return Math.max(2, Math.round(base * activeEffects.scoutCostMult));
  }, [target.isPvP, activeEffects.scoutCostMult]);

  // Scouting handler
  const handleScoutTarget = () => {
    if (playerIntel < intelCost) {
      toast.error("Insufficient Intel balance. Complete quests or wait for passive generation.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await scoutTargetAction(intelCost);
        if (res.success) {
          setInventory({ intel: res.newIntel });
          setScouted(true);
          toast.success("Coordinates decrypted!", {
            description: "Room layout and defensive obstacles scanned."
          });
        } else {
          toast.error("Scouting failed", { description: res.error });
        }
      } catch (err) {
        toast.error("Failed to connect to reconnaissance feeds");
      }
    });
  };

  // Assign a squad member to an entry point
  const handleAssignEntry = (slot: number, entryIndex: number) => {
    // Check if another squad member is already assigned to this entry point
    const duplicate = Object.entries(assignments).find(
      ([s, idx]) => idx === entryIndex && parseInt(s, 10) !== slot
    );

    setAssignments((prev) => ({
      ...prev,
      [slot]: entryIndex,
    }));

    if (duplicate) {
      toast.info(`Repositioning: Multi-entry split.`);
    }
  };

  // Check if prep is fully completed
  const isPrepReady = useMemo(() => {
    return activeMembers.every((m) => assignments[m.slotNumber] !== undefined);
  }, [activeMembers, assignments]);

  // Commence Raid Execution
  const handleCommenceRaid = () => {
    if (!isPrepReady) {
      toast.error("Assign all active squad members to entry points first.");
      return;
    }

    // Map entry point coords and details to squad members for Phaser use
    const preparedSquad = activeMembers.map((m) => {
      const entryIdx = assignments[m.slotNumber];
      const entry = target.entryPoints[entryIdx];
      return {
        ...m,
        selectedEntryPoint: entry,
        assignedEntryPoint: entry,
      };
    });

    // Hydrate useRaidStore with the squad loadouts & entries
    const st = useRaidStore.getState();
    (st as any).prepSquadMembers = preparedSquad;

    setPhase("execute");
    toast.success("Breach commenced! Good luck, Commander.");
  };

  if (phase === "execute") {
    // Mount the Phaser Canvas & active Raiding HUD interfaces
    return (
      <div className="relative h-full w-full">
        <RaidInitializer
          target={{
            id: target.id,
            name: target.name,
            difficulty: target.difficulty as any,
            isPvP: target.isPvP,
            gridSize: target.gridSize,
            entryPoints: target.entryPoints,
            placedItems: target.placedItems,
            stash: target.stash,
          } as any}
        />
        <GameWrapper />
        <RaidHUD />
        <RaidResults />
        <RaidResolver />
      </div>
    );
  }

  /* ========================================================
     PREP SCREEN UI
     ======================================================== */
  return (
    <div className="container mx-auto h-full max-w-4xl overflow-y-auto p-4 pb-20 select-none">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2 text-rose-400">
            <Icons.Radar className="size-7 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Raid Briefing Room</h1>
            <p className="text-xs text-muted-foreground">Scout coordinates, assign entry pathways, and launch breach.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Tactician Controls / Squad assignments (1 column) */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-xl">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Icons.Users className="size-4.5 text-primary" />
                Squad Insertion Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="py-4 space-y-4 text-xs">
              {activeMembers.map((m) => {
                const assignedIdx = assignments[m.slotNumber];
                const hasAssignment = assignedIdx !== undefined;

                return (
                  <div key={m.slotNumber} className="rounded-lg border border-border/40 bg-background/30 p-3 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-foreground truncate max-w-[120px]">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">Slot #{m.slotNumber}</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-muted-foreground font-semibold uppercase">Insertion Entry</label>
                      <select
                        value={assignedIdx !== undefined ? assignedIdx.toString() : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== "") handleAssignEntry(m.slotNumber, parseInt(val, 10));
                        }}
                        className="w-full h-8 px-2 rounded border border-border bg-background/50 text-xs font-semibold"
                      >
                        <option value="" disabled>-- Assign Entry Point --</option>
                        {target.entryPoints.map((ep, idx) => (
                          <option key={idx} value={idx}>
                            {ep.wall.toUpperCase()} {ep.type.toUpperCase()} (Pos: {ep.position})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Show equipped loadout */}
                    <div className="flex flex-wrap gap-1 mt-1 text-[9px] text-muted-foreground">
                      <span className="bg-rose-500/5 px-1.5 py-0.5 rounded border border-rose-500/10 flex items-center gap-0.5" title="Active Ability">
                        <Icons.PlusSquare className="size-2.5 text-rose-400" /> {m.activeAbility ? m.activeAbility.replace("_", " ") : "No Ability"}
                      </span>
                      <span className="bg-red-500/5 px-1.5 py-0.5 rounded border border-red-500/10 flex items-center gap-0.5" title="Weapon Slot">
                        <Icons.Swords className="size-2.5 text-red-400" /> {m.weapon ? m.weapon.replace("_", " ") : "Crowbar"}
                      </span>
                      <span className="bg-cyan-500/5 px-1.5 py-0.5 rounded border border-cyan-500/10 flex items-center gap-0.5" title="Armor Suit">
                        <Icons.Shield className="size-2.5 text-cyan-400" /> {m.armor ? m.armor.replace("_", " ") : "No Armor"}
                      </span>
                      <span className="bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10 flex items-center gap-0.5" title="Utility Slot">
                        <Icons.Wrench className="size-2.5 text-amber-400" /> {m.passiveGear ? m.passiveGear.replace("_", " ") : "No Utility"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
            <CardFooter className="pt-2 pb-4 border-t border-border/50 bg-background/10 flex flex-col gap-3">
              <Button
                className="w-full font-bold shadow-lg shadow-rose-500/10 bg-rose-950/80 border border-rose-800 hover:bg-rose-800 text-rose-200"
                disabled={!isPrepReady || isPending}
                onClick={handleCommenceRaid}
              >
                <Icons.Swords className="size-4 mr-2" /> COMMENCE BREACH
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Side: Scouting & Room Blueprint layout grid (2 columns) */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border bg-card/20 backdrop-blur shadow-lg flex flex-col min-h-[460px]">
            <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Icons.Map className="size-4.5 text-muted-foreground" />
                  Stronghold Schematic Grid
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Scout targets to reveal barricades, turrets, and traps.
                </CardDescription>
              </div>

              {!scouted && (
                <Button
                  size="sm"
                  className="h-8 font-bold border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary shadow-sm"
                  disabled={isPending}
                  onClick={handleScoutTarget}
                >
                  <Icons.Search className="size-3.5 mr-1.5" />
                  Scout Target (Cost: {intelCost} Intel)
                </Button>
              )}
            </CardHeader>

            <CardContent className="flex-1 flex items-center justify-center py-6 relative">
              {scouted ? (
                /* Interactive Scouted Room Grid */
                <div className="flex flex-col items-center gap-4">
                  {/* Grid Layout Representation */}
                  <div
                    className="grid bg-background/40 border border-border/40 p-2 rounded-xl shadow-inner gap-0.5"
                    style={{
                      gridTemplateColumns: `repeat(${target.gridSize}, minmax(28px, 1fr))`,
                    }}
                  >
                    {Array.from({ length: target.gridSize }).map((_, y) => (
                      <div key={y} className="contents">
                        {Array.from({ length: target.gridSize }).map((_, x) => {
                          // Find item on this tile
                          const item = target.placedItems.find(
                            (i) => i.gridX === x && i.gridY === y
                          );

                          // Check if entry point is on this tile
                          const isEntry = target.entryPoints.some((ep) => {
                            const tile = entryTileFor(ep, target.gridSize);
                            return tile && tile.x === x && tile.y === y;
                          });

                          let tileColor = "bg-background/20 hover:bg-background/40";
                          let label = "";

                          if (isEntry) {
                            const assignedSlots = activeMembers
                              .filter((m) => {
                                const entryIdx = assignments[m.slotNumber];
                                if (entryIdx === undefined) return false;
                                const ep = target.entryPoints[entryIdx];
                                const tile = entryTileFor(ep, target.gridSize);
                                return tile && tile.x === x && tile.y === y;
                              })
                              .map((m) => m.slotNumber);

                            if (assignedSlots.length > 0) {
                              tileColor = "bg-emerald-500/40 border border-emerald-500 text-emerald-300 font-extrabold shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse";
                              label = `E${assignedSlots.join(",")}`;
                            } else {
                              tileColor = "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500/50 font-semibold";
                              label = "E";
                            }
                          } else if (item) {
                            if (item.type === "turret") {
                              tileColor = "bg-orange-500/30 border border-orange-500/40 text-orange-400 font-bold";
                              label = "T";
                            } else if (item.type === "barricade") {
                              tileColor = "bg-red-500/30 border border-red-500/40 text-red-400 font-bold";
                              label = "B";
                            } else if (item.type === "trap") {
                              // Gated by Tech Tree Scanner upgrade 'reveal_traps'!
                              if (activeEffects.revealTraps) {
                                tileColor = "bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 font-bold";
                                label = "TR";
                              } else {
                                // Hides trap to look like empty space
                                tileColor = "bg-background/20";
                              }
                            } else {
                              tileColor = "bg-slate-500/20 border border-slate-500/40 text-slate-400";
                              label = "F";
                            }
                          }

                          return (
                            <div
                              key={`${x},${y}`}
                              className={`aspect-square w-7 rounded flex items-center justify-center text-[9px] select-none transition-all cursor-default ${tileColor}`}
                              title={`Tile (${x}, ${y})`}
                            >
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Grid Legend Keys */}
                  <div className="flex flex-wrap gap-4 justify-center text-[10px] text-muted-foreground border-t border-border/40 pt-4">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded bg-emerald-500/20 border border-emerald-500/40 inline-block"></span>
                      Entry Point
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded bg-orange-500/30 border border-orange-500/40 inline-block"></span>
                      Turret
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded bg-red-500/30 border border-red-500/40 inline-block"></span>
                      Barricade
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded bg-slate-500/20 border border-slate-500/40 inline-block"></span>
                      Furniture
                    </span>
                    {activeEffects.revealTraps && (
                      <span className="flex items-center gap-1.5 font-bold text-yellow-400">
                        <span className="size-2.5 rounded bg-yellow-500/30 border border-yellow-500/40 inline-block"></span>
                        Decrypted Trap
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Obscured Obfuscated Noise Feed Visual */
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="size-16 rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center animate-pulse">
                    <Icons.AlertTriangle className="size-8" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Room Schematic Encrypted</h4>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    Stronghold visual feeds are obscured. Spend Intel resources to decrypt coordinates and scout obstacles.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
