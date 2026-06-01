/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { useSquadStore, type SquadMember } from "@/lib/store/useSquadStore";
import { unlockTechNodeAction, updateSquadMemberAction } from "./actions";
import { getAchievementsAction, equipCosmeticAction } from "./achievements";
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
  initialActiveBadge: string | null;
  initialActiveBorder: string | null;
  initialActiveRoomSkin: string | null;
}

export default function SquadDashboard({ 
  initialPlayerLevel,
  initialActiveBadge,
  initialActiveBorder,
  initialActiveRoomSkin 
}: SquadDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"loadout" | "tech" | "trophy">("loadout");

  // Zustand states
  const techPoints = usePlayerStore((state) => state.techPoints);
  const unlockedTechs = usePlayerStore((state) => state.unlockedTechs);
  const activeEffects = usePlayerStore((state) => state.activeEffects);
  const unlockTechNode = usePlayerStore((state) => state.unlockTechNode);

  const activeBadge = usePlayerStore((state) => state.activeBadge);
  const activeBorder = usePlayerStore((state) => state.activeBorder);
  const activeRoomSkin = usePlayerStore((state) => state.activeRoomSkin);
  const setCosmeticsState = usePlayerStore((state) => state.setCosmeticsState);

  const squadMembers = useSquadStore((state) => state.members);
  const isSlotLocked = useSquadStore((state) => state.isLocked);
  const updateSquadMember = useSquadStore((state) => state.updateMember);

  // Selected tech node detail state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Renaming inputs state
  const [renamingSlot, setRenamingSlot] = useState<number | null>(null);
  const [newNameVal, setNewNameVal] = useState("");

  // Achievements tracking details
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState(true);

  // Initialize cosmetics state on mount
  useEffect(() => {
    setCosmeticsState({
      activeBadge: initialActiveBadge,
      activeBorder: initialActiveBorder,
      activeRoomSkin: initialActiveRoomSkin,
    });
  }, [initialActiveBadge, initialActiveBorder, initialActiveRoomSkin, setCosmeticsState]);

  // Load achievements progress
  useEffect(() => {
    async function loadAchievements() {
      try {
        const res = await getAchievementsAction();
        if (res.success && res.achievements) {
          setAchievements(res.achievements);
        }
      } catch (err) {
        console.error("Failed to load achievements", err);
      } finally {
        setLoadingAchievements(false);
      }
    }
    loadAchievements();
  }, [activeBadge, activeBorder, activeRoomSkin]);

  const handleEquipCosmetic = async (type: "badge" | "border" | "room_skin", code: string | null) => {
    if (isPending) return;

    startTransition(async () => {
      try {
        const activeCode = type === "badge" ? activeBadge : type === "border" ? activeBorder : activeRoomSkin;
        const targetCode = activeCode === code ? null : code;

        const res = await equipCosmeticAction(type, targetCode);
        if (res.success) {
          setCosmeticsState({
            activeBadge: type === "badge" ? targetCode : activeBadge,
            activeBorder: type === "border" ? targetCode : activeBorder,
            activeRoomSkin: type === "room_skin" ? targetCode : activeRoomSkin,
          });

          toast.success(
            targetCode 
              ? `${type.replace("_", " ")} equipped successfully!` 
              : `${type.replace("_", " ")} unequipped.`
          );
          router.refresh();
        } else {
          toast.error("Failed to equip cosmetic", { description: res.error });
        }
      } catch (err) {
        toast.error("Error communicating with cosmetics server");
      }
    });
  };

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
            Tech Tree {initialPlayerLevel < 3 && <Icons.Lock className="size-3 text-muted-foreground" />}
          </button>
          <button
            onClick={() => setActiveTab("trophy")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded font-bold text-xs transition-all ${activeTab === "trophy" ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' : 'text-muted-foreground'}`}
          >
            <Icons.Trophy className="size-4 text-emerald-400 animate-pulse" />
            Trophy Room
          </button>
          <button
            onClick={() => router.push("/battle-pass")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded font-bold text-xs transition-all text-muted-foreground hover:text-foreground"
          >
            <Icons.Milestone className="size-4 text-amber-400" />
            Battle Pass
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

                    {/* Character headshot portrait box with glowing neon-green border overrides */}
                    <div className="flex justify-center py-2 shrink-0 select-none">
                      <div className={`relative flex items-center justify-center size-24 rounded-2xl bg-muted/30 border transition-all duration-500 ${
                        activeBorder === "neon-green" 
                          ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.45)]' 
                          : 'border-border/40'
                      }`}>
                        <div className="absolute inset-0.5 rounded-[14px] bg-background/80 flex items-center justify-center overflow-hidden">
                          <div className={`absolute inset-0 bg-gradient-to-br opacity-10 ${
                            slot === 1 ? 'from-rose-500 to-purple-500' :
                            slot === 2 ? 'from-emerald-500 to-teal-500' :
                            slot === 3 ? 'from-amber-500 to-red-500' :
                            'from-blue-500 to-indigo-500'
                          }`}></div>
                          {slot === 1 ? <Icons.ShieldAlert className={`size-10 transition-colors duration-500 ${activeBorder === 'neon-green' ? 'text-emerald-400' : 'text-rose-400'}`} /> :
                           slot === 2 ? <Icons.HeartPulse className={`size-10 transition-colors duration-500 ${activeBorder === 'neon-green' ? 'text-emerald-400' : 'text-emerald-400'}`} /> :
                           slot === 3 ? <Icons.Bomb className={`size-10 transition-colors duration-500 ${activeBorder === 'neon-green' ? 'text-emerald-400' : 'text-amber-400'}`} /> :
                           <Icons.Radar className={`size-10 transition-colors duration-500 ${activeBorder === 'neon-green' ? 'text-emerald-400' : 'text-blue-400'}`} />}
                        </div>
                        
                        {/* Little badge icon overlay on the portrait if user has equipped badge */}
                        {activeBadge === "raids_50" && (
                          <div className="absolute -bottom-2 -right-2 bg-background border border-amber-500/50 shadow rounded-lg p-1 animate-bounce">
                            <Icons.Award className="size-4 text-amber-500" />
                          </div>
                        )}
                      </div>
                    </div>
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
      ) : activeTab === "tech" ? (
        /* ========================================================
           TECH TREE TAB
           ======================================================== */
        <div className="space-y-6">
          {initialPlayerLevel < 3 ? (
            /* Locked Gate Screen */
            <Card className="border-border bg-card/40 backdrop-blur shadow-lg p-10 text-center max-w-lg mx-auto border-dashed">
              <Icons.Lock className="size-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-lg font-bold">Research Core Offline</h2>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                The stronghold's server network is uncalibrated. Reach <strong className="text-foreground">Player Level 3</strong> to unlock database research and available tech points!
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

                        <p className="text-xs text-muted-foreground leading-relaxed">
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
      ) : (
        /* ========================================================
           TROPHY ROOM TAB
           ======================================================= */
        <div className="space-y-6">
          {/* Hall Glassmorphic Header */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/30 p-6 backdrop-blur shadow-xl">
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
            <div className="absolute -left-16 -bottom-16 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 z-10">
              <div className="space-y-1.5">
                <h2 className="text-xl font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Icons.Award className="size-6 text-emerald-400 animate-pulse" />
                  Stronghold Trophy Hall
                </h2>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  Earn prestigious visual cosmetics and custom badges by completing high-difficulty tactical milestones. Equip borders and skins to showcase your achievements dynamically across the entire stronghold.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="rounded-xl border border-border/40 bg-background/40 p-3 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Achievements</span>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">
                    {loadingAchievements ? "..." : `${achievements.filter((a) => a.isUnlocked).length} / ${achievements.length}`}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/40 p-3 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Unlocked Rate</span>
                  <p className="text-lg font-black text-primary mt-0.5">
                    {loadingAchievements ? "..." : `${Math.round((achievements.filter((a) => a.isUnlocked).length / (achievements.length || 1)) * 100)}%`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Portrait Preview panel */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Icons.Users className="size-3.5 text-primary" /> Active Squad Portrait Previews
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((slot) => {
                const locked = isSlotLocked(slot, initialPlayerLevel);
                const member = squadMembers.find((m) => m.slotNumber === slot);

                if (locked || !member) {
                  const reqLvl = slot === 2 ? 10 : slot === 3 ? 25 : 30;
                  return (
                    <Card key={slot} className="border-border/40 bg-card/10 backdrop-blur opacity-40 flex flex-col justify-center items-center h-44 text-center p-4 border-dashed">
                      <Icons.Lock className="size-6 text-muted-foreground/30 mb-2" />
                      <span className="text-[10px] font-bold text-muted-foreground">Slot Locked (Level {reqLvl})</span>
                    </Card>
                  );
                }

                return (
                  <Card key={slot} className="border-border/20 bg-card/30 backdrop-blur shadow-lg flex flex-col p-4 relative overflow-hidden group">
                    <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                    <div className="flex items-center gap-4">
                      {/* Avatar preview with custom equipped border overlay */}
                      <div className={`relative flex items-center justify-center size-16 rounded-xl bg-muted/20 border transition-all duration-500 shrink-0 ${
                        activeBorder === "neon-green" 
                          ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse' 
                          : 'border-border/40'
                      }`}>
                        <div className="absolute inset-0.5 rounded-[9px] bg-background/80 flex items-center justify-center overflow-hidden">
                          <div className={`absolute inset-0 bg-gradient-to-br opacity-10 ${
                            slot === 1 ? 'from-rose-500 to-purple-500' :
                            slot === 2 ? 'from-emerald-500 to-teal-500' :
                            slot === 3 ? 'from-amber-500 to-red-500' :
                            'from-blue-500 to-indigo-500'
                          }`}></div>
                          {slot === 1 ? <Icons.ShieldAlert className={`size-7 transition-colors duration-500 ${activeBorder === 'neon-green' ? 'text-emerald-400' : 'text-rose-400'}`} /> :
                           slot === 2 ? <Icons.HeartPulse className={`size-7 transition-colors duration-500 ${activeBorder === 'neon-green' ? 'text-emerald-400' : 'text-emerald-400'}`} /> :
                           slot === 3 ? <Icons.Bomb className={`size-7 transition-colors duration-500 ${activeBorder === 'neon-green' ? 'text-emerald-400' : 'text-amber-400'}`} /> :
                           <Icons.Radar className={`size-7 transition-colors duration-500 ${activeBorder === 'neon-green' ? 'text-emerald-400' : 'text-blue-400'}`} />}
                        </div>

                        {/* Little badge icon overlay on the portrait if user has equipped badge */}
                        {activeBadge === "badge_veteran_raider" && (
                          <div className="absolute -bottom-1 -right-1 bg-background border border-amber-500/50 shadow rounded p-0.5 animate-bounce">
                            <Icons.Award className="size-3 text-amber-500" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-foreground truncate">{member.name}</h4>
                        <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                          Slot #{slot} • {slot === 1 ? 'Leader' : slot === 2 ? 'Medic' : slot === 3 ? 'Demoman' : 'Scout'}
                        </p>
                        
                        {/* Render active border/badge label below */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {activeBorder === "neon-green" && (
                            <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold px-1 rounded">
                              NEON FRAME
                            </span>
                          )}
                          {activeBadge === "badge_veteran_raider" && (
                            <span className="text-[8px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold px-1 rounded">
                              VETERAN BADGE
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Achievement Milestones Catalog Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Icons.Trophy className="size-3.5 text-emerald-400" /> Milestone Achievement Catalog
            </h3>
            
            {loadingAchievements ? (
              <div className="py-20 text-center text-xs text-muted-foreground animate-pulse">
                Accessing District Achievement Records...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {achievements.map((ach) => {
                  const percent = Math.min(100, Math.round((ach.progress / ach.targetValue) * 100));
                  
                  // Determine reward visual representation
                  let rewardLabel = "";
                  let rewardIcon = <Icons.HelpCircle className="size-5" />;
                  let isEquipped = false;

                  if (ach.rewardType === "badge") {
                    rewardLabel = "Exclusive Profile Badge";
                    rewardIcon = <Icons.Award className="size-5 text-amber-400" />;
                    isEquipped = activeBadge === ach.rewardCode;
                  } else if (ach.rewardType === "portrait_border") {
                    rewardLabel = "Glowing Portrait Border";
                    rewardIcon = <Icons.Sparkles className="size-5 text-emerald-400" />;
                    isEquipped = activeBorder === ach.rewardCode;
                  } else if (ach.rewardType === "room_skin") {
                    rewardLabel = "Phaser Room Skin Override";
                    rewardIcon = <Icons.Layers className="size-5 text-fuchsia-400" />;
                    isEquipped = activeRoomSkin === ach.rewardCode;
                  }

                  return (
                    <div 
                      key={ach.id} 
                      className={`relative overflow-hidden rounded-2xl border transition-all duration-500 bg-card/25 p-5 backdrop-blur flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
                        ach.isUnlocked 
                          ? 'border-emerald-500/30 bg-emerald-500/[0.02] shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                          : 'border-border/30 bg-background/5'
                      }`}
                    >
                      {/* Left Side: Detail & Progress Info */}
                      <div className="flex-1 space-y-3.5 min-w-0 w-full">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-xl p-2.5 border shrink-0 ${
                            ach.isUnlocked 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : 'bg-muted/10 border-border/30 text-muted-foreground'
                          }`}>
                            {rewardIcon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black uppercase tracking-wider text-foreground leading-tight">{ach.name}</h4>
                              {ach.isUnlocked && (
                                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                                  <Icons.CheckCircle className="size-2.5" /> UNLOCKED
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{ach.description}</p>
                          </div>
                        </div>

                        {/* Progress Meter */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-muted-foreground">Progress Checklist:</span>
                            <span className={`font-bold ${ach.isUnlocked ? 'text-emerald-400' : 'text-foreground'}`}>
                              {ach.progress} / {ach.targetValue} ({percent}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted/30 border border-border/20 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${
                                ach.isUnlocked 
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                                  : 'bg-gradient-to-r from-primary to-purple-600'
                              }`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Reward Display & Toggle button */}
                      <div className="flex flex-row md:flex-col items-center justify-between md:justify-center md:items-end shrink-0 w-full md:w-auto gap-4 border-t md:border-t-0 border-border/10 pt-4 md:pt-0">
                        <div className="text-left md:text-right">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Reward Earned:</span>
                          <p className="text-xs font-bold text-foreground mt-0.5">{rewardLabel}</p>
                          <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider">{ach.rewardCode}</p>
                        </div>

                        {ach.isUnlocked ? (
                          <Button
                            className={`w-32 font-black transition-all duration-300 border text-xs ${
                              isEquipped 
                                ? 'bg-primary/20 hover:bg-primary/30 text-primary border-primary/40 shadow-[0_0_10px_rgba(236,72,153,0.25)]' 
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:scale-[1.02]'
                            }`}
                            onClick={() => handleEquipCosmetic(ach.rewardType === "portrait_border" ? "border" : (ach.rewardType as any), ach.rewardCode)}
                            disabled={isPending}
                          >
                            {isPending ? (
                              <Icons.Loader2 className="size-4 animate-spin" />
                            ) : isEquipped ? (
                              <span className="flex items-center justify-center gap-1.5">
                                <Icons.Sparkle className="size-3.5 text-primary" /> EQUIPPED
                              </span>
                            ) : (
                              "EQUIP COSMETIC"
                            )}
                          </Button>
                        ) : (
                          <Button
                            className="w-32 bg-background/50 border border-border/40 text-muted-foreground text-xs select-none pointer-events-none"
                            disabled
                          >
                            <Icons.Lock className="size-3.5 mr-1.5" /> LOCKED
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
