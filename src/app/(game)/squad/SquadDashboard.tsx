/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { useSquadStore, type SquadMember } from "@/lib/store/useSquadStore";
import { unlockTechNodeAction, updateSquadMemberAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import techTree from "@/game/fixtures/tech-tree.json";

// Dynamic Lucide icon lookup utility
function Icon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (Icons as any)[name];
  if (!IconComponent) return <Icons.HelpCircle className={className} />;
  return <IconComponent className={className} />;
}

interface SquadDashboardProps {
  initialPlayerLevel: number;
}

export default function SquadDashboard({ initialPlayerLevel }: SquadDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"loadout" | "tech">("loadout");

  // Zustand states
  const techPoints = usePlayerStore((state) => state.techPoints);
  const unlockedTechs = usePlayerStore((state) => state.unlockedTechs);
  const activeEffects = usePlayerStore((state) => state.activeEffects);
  const unlockTechNode = usePlayerStore((state) => state.unlockTechNode);

  const squadMembers = useSquadStore((state) => state.members);
  const isSlotLocked = useSquadStore((state) => state.isLocked);
  const updateSquadMember = useSquadStore((state) => state.updateMember);

  // Selected tech node detail state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Renaming inputs state
  const [renamingSlot, setRenamingSlot] = useState<number | null>(null);
  const [newNameVal, setNewNameVal] = useState("");

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return techTree.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId]);

  const unlockedIdsSet = useMemo(() => new Set(unlockedTechs), [unlockedTechs]);

  // Group nodes by branch
  const branchNodes = useMemo(() => {
    const grouped: Record<string, typeof techTree.nodes> = {
      offense: [],
      defense: [],
      utility: [],
    };
    techTree.nodes.forEach((node) => {
      if (grouped[node.branch]) {
        grouped[node.branch].push(node);
      }
    });
    return grouped;
  }, []);

  // Tech Tree Node Unlock Trigger
  const handleUnlockNode = async (nodeId: string, cost: number) => {
    if (isPending) return;

    startTransition(async () => {
      try {
        const res = await unlockTechNodeAction(nodeId);
        if (res.success) {
          unlockTechNode(nodeId, cost);
          toast.success("Technology unlocked!", {
            description: `Successfully researched: ${techTree.nodes.find(n => n.id === nodeId)?.name}`
          });
          router.refresh();
        } else {
          toast.error("Unlock failed", { description: res.error });
        }
      } catch (err) {
        toast.error("Failed to communicate with tech server");
      }
    });
  };

  // Squad Member rename trigger
  const handleRenameMember = async (slot: number) => {
    if (!newNameVal.trim()) return;
    startTransition(async () => {
      try {
        const res = await updateSquadMemberAction(slot, { name: newNameVal.trim() });
        if (res.success) {
          updateSquadMember(slot, { name: newNameVal.trim() });
          toast.success("Squad member renamed!");
          setRenamingSlot(null);
          router.refresh();
        } else {
          toast.error("Rename failed", { description: res.error });
        }
      } catch (err) {
        toast.error("Rename failed due to connection error");
      }
    });
  };

  // Squad Equipment trigger
  const handleEquipAbility = async (slot: number, ability: string | null) => {
    startTransition(async () => {
      try {
        const res = await updateSquadMemberAction(slot, { activeAbility: ability });
        if (res.success) {
          updateSquadMember(slot, { activeAbility: ability });
          toast.success(ability ? "Ability equipped!" : "Ability unequipped!");
          router.refresh();
        } else {
          toast.error("Equipment update failed", { description: res.error });
        }
      } catch (err) {
        toast.error("Failed to update equipment slots");
      }
    });
  };

  const handleEquipGear = async (slot: number, gear: string | null) => {
    startTransition(async () => {
      try {
        const res = await updateSquadMemberAction(slot, { passiveGear: gear });
        if (res.success) {
          updateSquadMember(slot, { passiveGear: gear });
          toast.success(gear ? "Tactical gear equipped!" : "Tactical gear unequipped!");
          router.refresh();
        } else {
          toast.error("Equipment update failed", { description: res.error });
        }
      } catch (err) {
        toast.error("Failed to update equipment slots");
      }
    });
  };

  const handleEquipWeapon = async (slot: number, weapon: string | null) => {
    startTransition(async () => {
      try {
        const res = await updateSquadMemberAction(slot, { weapon });
        if (res.success) {
          updateSquadMember(slot, { weapon });
          toast.success(weapon ? "Weapon equipped!" : "Weapon unequipped!");
          router.refresh();
        } else {
          toast.error("Equipment update failed", { description: res.error });
        }
      } catch (err) {
        toast.error("Failed to update weapon slot");
      }
    });
  };

  const handleEquipArmor = async (slot: number, armor: string | null) => {
    startTransition(async () => {
      try {
        const res = await updateSquadMemberAction(slot, { armor });
        if (res.success) {
          updateSquadMember(slot, { armor });
          toast.success(armor ? "Armor equipped!" : "Armor unequipped!");
          router.refresh();
        } else {
          toast.error("Equipment update failed", { description: res.error });
        }
      } catch (err) {
        toast.error("Failed to update armor slot");
      }
    });
  };

  // Check if a node is buyable (cost available & prerequisites unlocked)
  const isNodeUnlockable = (node: any) => {
    if (unlockedIdsSet.has(node.id)) return false;
    if (techPoints < node.cost) return false;
    return node.prerequisites.every((p: string) => unlockedIdsSet.has(p));
  };

  return (
    <div className="container mx-auto h-full max-w-5xl overflow-y-auto p-4 pb-20 select-none">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-2 text-primary">
            <Icons.Swords className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tactical Command</h1>
            <p className="text-xs text-muted-foreground">Manage your raider squad and research new battle tech.</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-background/50 border border-border/40 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("loadout")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded font-bold text-xs transition-all ${activeTab === "loadout" ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' : 'text-muted-foreground'}`}
          >
            <Icons.Users className="size-4" />
            Squad Loadouts
          </button>
          <button
            onClick={() => setActiveTab("tech")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded font-bold text-xs transition-all ${activeTab === "tech" ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' : 'text-muted-foreground'}`}
          >
            <Icons.Cpu className="size-4" />
            Tech Tree {initialPlayerLevel < 8 && <Icons.Lock className="size-3 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {activeTab === "loadout" ? (
        /* ========================================================
           SQUAD LOADOUTS TAB
           ======================================================== */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((slot) => {
              const locked = isSlotLocked(slot, initialPlayerLevel);
              const member = squadMembers.find((m) => m.slotNumber === slot);

              if (locked || !member) {
                const reqLvl = slot === 2 ? 10 : slot === 3 ? 25 : 30;
                return (
                  <Card key={slot} className="border-border/40 bg-card/20 backdrop-blur opacity-50 relative flex flex-col justify-center items-center h-[520px] text-center p-6 border-dashed">
                    <Icons.Lock className="size-10 text-muted-foreground/30 mb-3" />
                    <h3 className="text-sm font-bold text-foreground/70">Slot Locked</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[150px]">
                      Requires Player Level {reqLvl} to unlock.
                    </p>
                  </Card>
                );
              }

              const renamingActive = renamingSlot === slot;

              // Calculate individualized stats based on tech unlocks + equipped weapons/armor/utility gear
              let hp = 100 * activeEffects.squadHpMult;
              if (member.armor === "reinforced_vest") hp *= 1.15;
              else if (member.armor === "tactical_armor") hp *= 1.35;

              let speed = 100 * activeEffects.squadSpeedMult;
              if (member.passiveGear === "adrenaline_rush") speed *= 1.10;

              let dmg = 10 * activeEffects.squadMeleeDmgMult;
              if (member.weapon === "heavy_machete") dmg *= 1.5;
              else if (member.weapon === "demo_hammer") dmg *= 2.0;

              const memberStats = {
                hp: Math.round(hp),
                speed: Math.round(speed),
                damage: Math.round(dmg),
              };

              return (
                <Card key={slot} className="border-primary/20 bg-card/40 backdrop-blur shadow-lg flex flex-col h-[520px] relative overflow-hidden group">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-primary to-purple-600"></div>
                  
                  <CardHeader className="pb-2">
                    {renamingActive ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Input
                          size={10}
                          value={newNameVal}
                          onChange={(e) => setNewNameVal(e.target.value)}
                          className="h-8 text-xs font-bold"
                          placeholder={member.name}
                          maxLength={12}
                          autoFocus
                        />
                        <Button size="icon-sm" className="h-8 w-8" onClick={() => handleRenameMember(slot)} disabled={isPending}>
                          <Icons.Check className="size-3.5" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setRenamingSlot(null)}>
                          <Icons.X className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center group/title">
                        <CardTitle className="text-base font-bold tracking-tight mt-1 flex items-center gap-1">
                          {member.name}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setRenamingSlot(slot);
                            setNewNameVal(member.name);
                          }}
                        >
                          <Icons.Edit2 className="size-3" />
                        </Button>
                      </div>
                    )}
                    <CardDescription className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                      Squad Slot #{slot}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 py-2 space-y-3 text-xs overflow-y-auto scrollbar-none">
                    {/* Active Ability Slot */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1">
                        <Icons.PlusSquare className="size-3 text-rose-400" /> Active Ability
                      </label>
                      <select
                        value={member.activeAbility || ""}
                        onChange={(e) => handleEquipAbility(slot, e.target.value || null)}
                        disabled={isPending}
                        className="w-full h-10 px-2 rounded-md border border-border bg-background/50 hover:bg-background/80 transition-colors text-[11px] font-medium focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- Empty Slot --</option>
                        {activeEffects.unlockedAbilities.map((ab) => (
                          <option key={ab} value={ab}>
                            {ab === "medkit" ? "🩹 Medkit" : ab === "breaching_charge" ? "💥 Breach Charge" : "⚡ EMP Grenade"}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Weapon Slot */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1">
                        <Icons.Swords className="size-3 text-red-400" /> Weapon Gear
                      </label>
                      <select
                        value={member.weapon || ""}
                        onChange={(e) => handleEquipWeapon(slot, e.target.value || null)}
                        disabled={isPending}
                        className="w-full h-10 px-2 rounded-md border border-border bg-background/50 hover:bg-background/80 transition-colors text-[11px] font-medium focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- Crowbar / Default --</option>
                        {unlockedIdsSet.has("off_squad_dmg_1") && (
                          <option value="heavy_machete">🗡️ Heavy Machete (+50% Dmg)</option>
                        )}
                        {unlockedIdsSet.has("off_ability_breaching") && (
                          <option value="demo_hammer">🔨 Demo Hammer (+100% Dmg)</option>
                        )}
                      </select>
                    </div>

                    {/* Armor Slot */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1">
                        <Icons.Shield className="size-3 text-cyan-400" /> Armor Suit
                      </label>
                      <select
                        value={member.armor || ""}
                        onChange={(e) => handleEquipArmor(slot, e.target.value || null)}
                        disabled={isPending}
                        className="w-full h-10 px-2 rounded-md border border-border bg-background/50 hover:bg-background/80 transition-colors text-[11px] font-medium focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- No Armor --</option>
                        {unlockedIdsSet.has("off_squad_hp_1") && (
                          <option value="reinforced_vest">🛡️ Reinforced Vest (+15% HP)</option>
                        )}
                        {unlockedIdsSet.has("off_squad_hp_2") && (
                          <option value="tactical_armor">🎖️ Tactical Armor Sheets (+35% HP)</option>
                        )}
                      </select>
                    </div>

                    {/* Utility Gear Slot */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1">
                        <Icons.Wrench className="size-3 text-amber-400" /> Utility Slot
                      </label>
                      <select
                        value={member.passiveGear || ""}
                        onChange={(e) => handleEquipGear(slot, e.target.value || null)}
                        disabled={isPending}
                        className="w-full h-10 px-2 rounded-md border border-border bg-background/50 hover:bg-background/80 transition-colors text-[11px] font-medium focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- None --</option>
                        {unlockedIdsSet.has("off_squad_speed_1") && (
                          <option value="adrenaline_rush">⚡ Adrenaline Jet (+10% Speed)</option>
                        )}
                        {unlockedIdsSet.has("util_intel_detail_1") && (
                          <option value="decryption_scanner">📡 Decryption Scanner (Reveal Traps)</option>
                        )}
                      </select>
                    </div>

                    {/* Core Stats Overview */}
                    <div className="rounded-lg bg-background/30 border border-border/20 p-2 space-y-1 text-[10px] text-muted-foreground shadow-inner font-mono">
                      <div className="flex justify-between">
                        <span>Max Health:</span>
                        <span className="font-bold text-foreground">
                          {memberStats.hp} HP
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Movement:</span>
                        <span className="font-bold text-foreground">
                          {memberStats.speed}% Speed
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Melee Attack:</span>
                        <span className="font-bold text-foreground">
                          {memberStats.damage} Damage
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-1.5 pb-3 border-t border-border/20 bg-background/10 shrink-0">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Icons.CheckCircle2 className="size-3.5 text-emerald-400" /> Active Duty Raider
                    </span>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {/* Tactical Advice Panel */}
          <Card className="border-border bg-card/20 backdrop-blur max-w-xl">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Icons.AlertCircle className="size-4.5 text-primary" />
                Squad deployment guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 text-xs leading-relaxed text-muted-foreground">
              During a raid, your squad will breach from their designated entry points. Equipping **Abilities** lets you use tactical tools like Medkits to heal members, EMPs to freeze sentry turrets, and Breaching Charges to quickly blow open flipped tables.
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ========================================================
           TECH TREE TAB
           ======================================================== */
        <div className="space-y-6">
          {initialPlayerLevel < 8 ? (
            /* Locked Gate Screen */
            <Card className="border-border bg-card/40 backdrop-blur shadow-lg p-10 text-center max-w-lg mx-auto border-dashed">
              <Icons.Lock className="size-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-lg font-bold">Research Core Offline</h2>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                The stronghold's server network is uncalibrated. Reach <strong className="text-foreground">Player Level 8</strong> to unlock database research and available tech points!
              </p>
            </Card>
          ) : (
            /* Open Research Graph */
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Node selection / Detail Sidebar */}
              <div className="md:col-span-1">
                <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-xl sticky top-20 flex flex-col justify-between h-[520px]">
                  <CardHeader className="pb-2 border-b border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Research Node</span>
                      <span className="flex items-center gap-1 text-[10px] bg-primary/10 border border-primary/20 text-primary font-extrabold px-2 py-0.5 rounded-full select-none">
                        <Icons.Cpu className="size-3" /> {techPoints} Points Available
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 py-4 overflow-y-auto space-y-4">
                    {selectedNode ? (
                      <div className="space-y-4 select-none">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-lg p-2.5 border ${
                            selectedNode.branch === 'offense' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                            selectedNode.branch === 'defense' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' :
                            'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}>
                            <Icon name={selectedNode.icon} className="size-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-foreground leading-tight">{selectedNode.name}</h3>
                            <span className="text-[9px] text-muted-foreground/80 font-mono uppercase font-bold">
                              {techTree.branches[selectedNode.branch as keyof typeof techTree.branches]?.name}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed leading-snug">
                          {selectedNode.description}
                        </p>

                        <div className="border-t border-border/50 pt-3.5 space-y-2.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Research Cost:</span>
                            <span className="font-bold text-primary font-mono">{selectedNode.cost} Tech Points</span>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Prerequisites:</span>
                            {selectedNode.prerequisites.length > 0 ? (
                              <div className="space-y-1 mt-1">
                                {selectedNode.prerequisites.map((pId) => {
                                  const pr = techTree.nodes.find(n => n.id === pId);
                                  const unlocked = unlockedIdsSet.has(pId);
                                  return (
                                    <div key={pId} className="flex justify-between items-center text-[10.5px]">
                                      <span className={unlocked ? "text-muted-foreground" : "text-destructive font-semibold"}>
                                        • {pr?.name || pId}
                                      </span>
                                      <span className={`text-[9px] font-bold ${unlocked ? "text-emerald-400" : "text-destructive"}`}>
                                        {unlocked ? "RESOLVED" : "LOCKED"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[10.5px] text-muted-foreground font-mono italic">None (Starter Upgrade)</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-20 text-muted-foreground space-y-3">
                        <Icons.HelpCircle className="size-10 mx-auto opacity-20" />
                        <p className="text-xs max-w-[150px] mx-auto leading-relaxed">Select any node on the graph to inspect research and unlocks.</p>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-3 pb-4 border-t border-border/50 bg-background/10">
                    {selectedNode && (
                      <div className="w-full">
                        {unlockedIdsSet.has(selectedNode.id) ? (
                          <Button className="w-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 text-emerald-400 font-bold" disabled>
                            <Icons.Check className="size-4 mr-1.5" /> Research Completed
                          </Button>
                        ) : (
                          <Button
                            className="w-full font-bold shadow-lg shadow-primary/30"
                            disabled={!isNodeUnlockable(selectedNode) || isPending}
                            onClick={() => handleUnlockNode(selectedNode.id, selectedNode.cost)}
                          >
                            {isPending ? "Researching..." : `Unlock (Cost: ${selectedNode.cost} TP)`}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardFooter>
                </Card>
              </div>

              {/* Branch Node Columns (Right 3 columns) */}
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 border border-border/40 p-4 rounded-2xl bg-background/20 relative shadow-inner overflow-hidden min-h-[520px]">
                {/* SVG background connections */}
                <div className="absolute inset-0 pointer-events-none opacity-40">
                  {/* Grid background visual overlay */}
                  <svg className="size-full">
                    <defs>
                      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                </div>

                {/* Branches maps */}
                {Object.keys(branchNodes).map((branch) => {
                  const branchInfo = techTree.branches[branch as keyof typeof techTree.branches];
                  const nodes = branchNodes[branch];

                  return (
                    <div key={branch} className="space-y-4 flex flex-col relative z-10">
                      {/* Column Header */}
                      <div className={`p-3 rounded-xl border flex flex-col gap-0.5 ${
                        branch === 'offense' ? 'bg-rose-500/5 border-rose-500/10 text-rose-300' :
                        branch === 'defense' ? 'bg-cyan-500/5 border-cyan-500/10 text-cyan-300' :
                        'bg-amber-500/5 border-amber-500/10 text-amber-300'
                      }`}>
                        <span className="text-[11px] font-bold uppercase tracking-wider">{branchInfo.name}</span>
                        <span className="text-[9px] text-muted-foreground leading-tight">{branchInfo.description}</span>
                      </div>

                      {/* Vertically Scrolling Nodes Track */}
                      <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[390px] scrollbar-none select-none">
                        {nodes.map((node) => {
                          const unlocked = unlockedIdsSet.has(node.id);
                          const active = selectedNodeId === node.id;
                          const unlockable = isNodeUnlockable(node);

                          return (
                            <button
                              key={node.id}
                              onClick={() => setSelectedNodeId(node.id)}
                              className={`w-full text-left p-3 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 ${
                                unlocked 
                                  ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 shadow-inner'
                                  : unlockable
                                    ? 'bg-primary/5 border-primary/40 text-primary-foreground hover:bg-primary/10 shadow-sm animate-pulse'
                                    : 'bg-background/40 border-border/40 text-muted-foreground hover:bg-background/60 opacity-60'
                              } ${active ? 'ring-1 ring-primary scale-[0.98]' : ''}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`rounded p-1.5 ${
                                  unlocked 
                                    ? 'bg-emerald-500/10 text-emerald-400' 
                                    : branch === 'offense' ? 'bg-rose-500/10 text-rose-400' :
                                      branch === 'defense' ? 'bg-cyan-500/10 text-cyan-400' :
                                      'bg-amber-500/10 text-amber-400'
                                }`}>
                                  <Icon name={node.icon} className="size-4 shrink-0" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-[11.5px] font-bold truncate leading-tight">{node.name}</h4>
                                  <p className="text-[9.5px] text-muted-foreground truncate max-w-[130px] mt-0.5 leading-none">
                                    {node.description}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0 font-mono text-[9px] font-extrabold flex items-center">
                                {unlocked ? (
                                  <Icons.Check className="size-3.5 text-emerald-400" />
                                ) : (
                                  <span>{node.cost} TP</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
