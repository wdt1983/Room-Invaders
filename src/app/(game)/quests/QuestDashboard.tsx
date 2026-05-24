/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/(game)/quests/QuestDashboard.tsx
//
// Phase 4 Tasks 4.0.7 & 4.0.12 — Quest dashboard UI and claiming flow.
// Interactive Client Component managing reward claims and safe mode briefing triggers.

"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { completeSafeModeBriefing } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import {
  ClipboardList,
  CheckCircle2,
  Lock,
  Cpu,
  Coins,
  Eye,
  Package,
  Sparkles,
  BookOpen,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import type { QuestDefinition } from "@/lib/game/quests";
import questsData from "@/game/fixtures/quests.json";

// Type definitions matching database schema
interface PlayerQuestRow {
  quest_id: string;
  status: "active" | "completed" | "claimed";
  progress: number;
  target_value: number;
  completed_at?: string;
  claimed_at?: string;
}

interface QuestDashboardProps {
  initialQuests: PlayerQuestRow[];
  playerLevel: number;
}

const allQuests: {
  tutorial: QuestDefinition[];
  daily: QuestDefinition[];
  weekly: QuestDefinition[];
} = questsData as any;

export default function QuestDashboard({ initialQuests, playerLevel }: QuestDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Zustand Store integration
  const setInventory = usePlayerStore((state) => state.setInventory);
  const applyXpAndLevel = usePlayerStore((state) => state.applyXpAndLevel);
  const safeModeUntil = usePlayerStore((state) => state.safeModeUntil);

  const formatTimeRemaining = (targetDateStr: string) => {
    const target = new Date(targetDateStr).getTime();
    const diff = target - now.getTime();
    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const isSafeMode = !!(safeModeUntil && new Date(safeModeUntil) > now && playerLevel < 5);

  const supabase = createClient();

  // Index user quest rows for quick lookup
  const userQuestsMap = initialQuests.reduce<Record<string, PlayerQuestRow>>((acc, curr) => {
    acc[curr.quest_id] = curr;
    return acc;
  }, {});

  // 1. Claim reward function using process-quest Edge Function
  const handleClaimReward = async (questId: string) => {
    if (claimingId) return;
    setClaimingId(questId);

    try {
      const authHeader = (await supabase.auth.getSession()).data.session?.access_token;
      if (!authHeader) {
        toast.error("Authentication expired. Please log in again.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("process-quest", {
        body: { questId },
        headers: {
          Authorization: `Bearer ${authHeader}`,
        },
      });

      if (error || !data || !data.success) {
        const errorMsg = data?.error || error?.message || "Failed to claim reward";
        toast.error(errorMsg);
        return;
      }

      // 2. Play reward sounds and toast
      toast.success(
        <div className="flex flex-col gap-1">
          <div className="font-bold text-emerald-400">Quest Reward Claimed!</div>
          <div className="text-xs text-muted-foreground">
            +{data.xpGained} XP
            {data.lootScrap > 0 && ` · +${data.lootScrap} Scrap`}
            {data.lootComponents > 0 && ` · +${data.lootComponents} Components`}
            {data.lootCredits > 0 && ` · +${data.lootCredits} Credits`}
            {data.lootIntel > 0 && ` · +${data.lootIntel} Intel`}
            {data.lootContraband > 0 && ` · +${data.lootContraband} Contraband`}
          </div>
        </div>
      );

      // 3. Update Zustand Store with fresh stats from Edge Function
      setInventory({
        scrap: data.newScrap,
        components: data.newComponents,
        credits: data.newCredits,
        intel: data.newIntel,
        contraband: data.newContraband,
      });

      const { leveledUp, newLevel } = applyXpAndLevel(data.newXp, data.newPlayerLevel);
      if (leveledUp) {
        toast.success(`LEVEL UP! Reached Lvl ${newLevel}!`);
      }

      // 4. Reload page component stats
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      console.error("Claim error:", err);
      toast.error("Failed to connect to quest processor");
    } finally {
      setClaimingId(null);
    }
  };

  // 5. Safe Mode briefing completion trigger
  const handleCompleteBriefing = async () => {
    try {
      const res = await completeSafeModeBriefing();
      if (res.success) {
        toast.success("Safe Mode briefing completed!");
        setBriefingOpen(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(res.error || "Briefing failed");
      }
    } catch (err) {
      toast.error("Network error completing briefing");
    }
  };

  // Helper to render currency badges
  const renderRewards = (rewards: QuestDefinition["rewards"], xpReward: number) => {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <span className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-primary">
          <Sparkles className="size-3" />
          {xpReward} XP
        </span>
        {rewards.scrap && (
          <span className="flex items-center gap-1 rounded-full bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 text-orange-400">
            <TrendingUp className="size-3" />
            {rewards.scrap} Scrap
          </span>
        )}
        {rewards.components && (
          <span className="flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-cyan-400">
            <Cpu className="size-3" />
            {rewards.components} Comp
          </span>
        )}
        {rewards.credits && (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-amber-400">
            <Coins className="size-3" />
            {rewards.credits} Coins
          </span>
        )}
        {rewards.intel && (
          <span className="flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-blue-400">
            <Eye className="size-3" />
            {rewards.intel} Intel
          </span>
        )}
        {rewards.contraband && (
          <span className="flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-indigo-400">
            <Package className="size-3" />
            {rewards.contraband} Contra
          </span>
        )}
      </div>
    );
  };

  // Compute tutorial checklist metrics
  const claimedTutorialsCount = allQuests.tutorial.filter(
    (q) => userQuestsMap[q.id]?.status === "claimed"
  ).length;
  const completedTutorialsCount = allQuests.tutorial.filter(
    (q) => userQuestsMap[q.id]?.status === "completed"
  ).length;
  const progressPercent = Math.round((claimedTutorialsCount / allQuests.tutorial.length) * 100);

  return (
    <div className="container mx-auto h-full max-w-4xl overflow-y-auto p-4 pb-20">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-2 text-primary">
            <ClipboardList className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Quest Board</h1>
            <p className="text-xs text-muted-foreground">Complete goals to unlock items and credit rewards.</p>
          </div>
        </div>

        {/* Global Progress Pill */}
        <div className="flex items-center gap-2 rounded-xl bg-card/40 border border-border/50 px-3 py-1.5 backdrop-blur">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Onboarding</span>
            <span className="text-sm font-bold text-primary">{claimedTutorialsCount} / 8</span>
          </div>
          <div className="relative size-10">
            <svg className="size-full -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-muted/30 fill-none"
                strokeWidth="3.5"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                className="stroke-primary fill-none transition-all duration-500"
                strokeWidth="3.5"
                strokeDasharray={`${2 * Math.PI * 16}`}
                strokeDashoffset={`${2 * Math.PI * 16 * (1 - progressPercent / 100)}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
              {progressPercent}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Onboarding Timeline checklist (Left 2 columns) */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Sparkles className="size-5 text-primary" />
                Fortress Training (Tutorial)
              </CardTitle>
              <CardDescription className="text-xs">
                Unlock rooms, traps, and new systems by completing your survivor onboarding chain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative space-y-6 pl-6 border-l border-border/80 ml-2.5">
                {allQuests.tutorial.map((q, idx) => {
                  const uQuest = userQuestsMap[q.id];
                  const isActive = uQuest?.status === "active";
                  const isCompleted = uQuest?.status === "completed";
                  const isClaimed = uQuest?.status === "claimed";
                  const isLocked = !uQuest;

                  return (
                    <div key={q.id} className="relative group">
                      {/* Timeline Bullet node */}
                      <span className="absolute -left-[31px] top-0.5 flex size-4 items-center justify-center rounded-full bg-background border border-border">
                        {isClaimed ? (
                          <div className="size-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                        ) : isCompleted ? (
                          <div className="size-2 rounded-full bg-primary animate-ping" />
                        ) : isActive ? (
                          <div className="size-1.5 rounded-full bg-primary" />
                        ) : (
                          <Lock className="size-2.5 text-muted-foreground/50" />
                        )}
                      </span>

                      <div className={`transition-opacity duration-300 ${isLocked ? "opacity-40" : "opacity-100"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className={`text-sm font-semibold tracking-tight ${isClaimed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                              {idx + 1}. {q.title}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-md">
                              {q.description}
                            </p>
                            
                            {/* Badger Rewards */}
                            {!isClaimed && renderRewards(q.rewards, q.xpReward)}
                          </div>

                          {/* Action button based on state */}
                          <div className="shrink-0 pt-0.5">
                            {isLocked ? (
                              <div className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground flex items-center gap-1 font-medium select-none">
                                <Lock className="size-3" /> Locked
                              </div>
                            ) : isClaimed ? (
                              <div className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="size-3" /> Claimed
                              </div>
                            ) : isCompleted ? (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 bg-primary text-primary-foreground font-bold text-xs px-2.5 rounded shadow-lg shadow-primary/30 animate-pulse"
                                disabled={claimingId !== null}
                                onClick={() => handleClaimReward(q.id)}
                              >
                                Claim
                              </Button>
                            ) : (
                              /* Active In Progress */
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] text-muted-foreground font-bold">
                                  Progress
                                </span>
                                <span className="text-xs font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  {uQuest.progress} / {uQuest.target_value}
                                </span>

                                {/* Handle manual Safe Mode briefing modal trigger */}
                                {q.id === "tut-08" && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-6 mt-1 text-[10px] border border-border px-1.5"
                                    onClick={() => setBriefingOpen(true)}
                                  >
                                    <BookOpen className="size-3 mr-1" /> Briefing
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily/Weekly Card (Right 1 column) */}
        <div className="space-y-6">
          {/* Daily Quests */}
          <Card className="border-border/60 bg-card/30 backdrop-blur shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <ClipboardList className="size-4.5 text-muted-foreground" />
                Daily Operations
              </CardTitle>
              <CardDescription className="text-[10px]">
                Refreshed every 24 hours at 00:00 UTC.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {allQuests.daily.map((q) => {
                const uQuest = userQuestsMap[q.id];
                if (!uQuest) return null; // Player level locked

                const isCompleted = uQuest.status === "completed";
                const isClaimed = uQuest.status === "claimed";

                return (
                  <div key={q.id} className="rounded-lg bg-card/60 border border-border/40 p-3 shadow-inner">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className={`text-xs font-bold ${isClaimed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {q.title}
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          {q.description}
                        </p>
                      </div>
                      
                      <div className="shrink-0">
                        {isClaimed ? (
                          <div className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            Claimed
                          </div>
                        ) : isCompleted ? (
                          <Button
                            size="sm"
                            className="h-6 text-[9px] bg-primary font-bold px-2 py-0"
                            disabled={claimingId !== null}
                            onClick={() => handleClaimReward(q.id)}
                          >
                            Claim
                          </Button>
                        ) : (
                          <div className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {uQuest.progress}/{uQuest.target_value}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rewards bar for active daily */}
                    {!isClaimed && renderRewards(q.rewards, q.xpReward)}
                  </div>
                );
              })}
              
              {allQuests.daily.every((q) => !userQuestsMap[q.id]) && (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  <HelpCircle className="size-6 mx-auto mb-2 text-muted-foreground/30" />
                  Level locked. Upgrade your level to unlock daily operations.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Quests */}
          <Card className="border-border/60 bg-card/30 backdrop-blur shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <TrendingUp className="size-4.5 text-muted-foreground" />
                Weekly Missions
              </CardTitle>
              <CardDescription className="text-[10px]">
                Refreshed every Monday at 00:00 UTC.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {allQuests.weekly.map((q) => {
                const uQuest = userQuestsMap[q.id];
                if (!uQuest) return null;

                const isCompleted = uQuest.status === "completed";
                const isClaimed = uQuest.status === "claimed";

                return (
                  <div key={q.id} className="rounded-lg bg-card/60 border border-border/40 p-3 shadow-inner">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className={`text-xs font-bold ${isClaimed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {q.title}
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          {q.description}
                        </p>
                      </div>
                      
                      <div className="shrink-0">
                        {isClaimed ? (
                          <div className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            Claimed
                          </div>
                        ) : isCompleted ? (
                          <Button
                            size="sm"
                            className="h-6 text-[9px] bg-primary font-bold px-2 py-0"
                            disabled={claimingId !== null}
                            onClick={() => handleClaimReward(q.id)}
                          >
                            Claim
                          </Button>
                        ) : (
                          <div className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {uQuest.progress}/{uQuest.target_value}
                          </div>
                        )}
                      </div>
                    </div>

                    {!isClaimed && renderRewards(q.rewards, q.xpReward)}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 6. Safe Mode Briefing Modal Overlay */}
      {briefingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <Card className="max-w-md border-primary/30 bg-card/95 shadow-2xl relative">
            <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center gap-3">
              <div className="rounded bg-primary/10 p-1.5 text-primary">
                <BookOpen className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Safe Mode Briefing</CardTitle>
                <CardDescription className="text-xs">Security Protocol 09-Ceasefire</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="py-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">Attention Survivor:</strong> The local Network mesh-net has secured a temporary cease-fire zone around your bedroom coordinates. This is **Safe Mode**.
              </p>
              
              <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 flex gap-2">
                <AlertTriangle className="size-5 shrink-0 text-primary mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-foreground text-[11px]">CEASE-FIRE PARAMETERS</span>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    While Safe Mode is active, other survivors **cannot raid your room** and steal your overflow resources.
                  </p>
                </div>
              </div>

              {isSafeMode && safeModeUntil && (
                <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/15 p-3 space-y-1">
                  <div className="flex justify-between text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Shield className="size-3.5 text-cyan-400" />
                      Ceasefire Active
                    </span>
                    <span className="text-cyan-400 font-mono">{formatTimeRemaining(safeModeUntil)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Expires:</span>
                    <span className="font-mono">{new Date(safeModeUntil).toLocaleString()}</span>
                  </div>
                </div>
              )}

              <p>
                Your ceasefire will **automatically expire** when you reach <strong className="text-foreground">Player Level 5</strong>, or if you choose to manually deactivate it once PvP matchmaking unlocks.
              </p>

              <p>
                Once Safe Mode drops, any resources stored above your **Storage Cap** will accumulate as <strong className="text-foreground">Overflow</strong>. Overflow scrap and components can be raided. Place heavy defenses now to prepare for the inevitable!
              </p>
            </CardContent>
            <CardFooter className="border-t border-border/40 pt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setBriefingOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="default" className="font-bold" onClick={handleCompleteBriefing}>
                Confirm Briefing
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
