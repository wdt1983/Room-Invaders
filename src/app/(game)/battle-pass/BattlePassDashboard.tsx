/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { claimRewardAction, unlockPremiumPassAction, buyTierAction } from "./actions";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import * as Icons from "lucide-react";

interface Reward {
  id: string;
  season_id: string;
  tier_number: number;
  is_premium: boolean;
  reward_type: "scrap" | "components" | "credits" | "contraband" | "intel" | "item" | "xp";
  reward_amount: number;
  item_id: string | null;
  items?: {
    name: string;
    description: string;
    type: string;
    sprite_key: string;
  };
}

interface Tier {
  season_id: string;
  tier_number: number;
  required_xp: number;
  battle_pass_rewards: Reward[];
}

interface BattlePassDashboardProps {
  initialProgress: {
    user_id: string;
    season_id: string;
    current_tier: number;
    current_xp: number;
    is_premium_unlocked: boolean;
    claimed_free_rewards: number[];
    claimed_premium_rewards: number[];
  };
  tiers: Tier[];
}

function RewardIcon({ type, itemType, className }: { type: string; itemType?: string; className?: string }) {
  if (type === "scrap") return <Icons.Cog className={className} />;
  if (type === "components") return <Icons.Cpu className={className} />;
  if (type === "credits") return <Icons.Coins className={className} />;
  if (type === "contraband") return <Icons.ShieldAlert className={className} />;
  if (type === "intel") return <Icons.Radio className={className} />;
  if (type === "xp") return <Icons.ChevronUp className={className} />;
  
  // Items
  if (itemType === "furniture") return <Icons.Bed className={className} />;
  if (itemType === "trap") return <Icons.Zap className={className} />;
  if (itemType === "turret") return <Icons.Target className={className} />;
  if (itemType === "barricade") return <Icons.Shield className={className} />;
  if (itemType === "guard") return <Icons.Activity className={className} />;
  
  return <Icons.HelpCircle className={className} />;
}

export default function BattlePassDashboard({ initialProgress, tiers }: BattlePassDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local state for instant UI responsiveness
  const [progress, setProgress] = useState(initialProgress);

  // Global Player Store to sync currencies immediately on claims
  const credits = usePlayerStore((state) => state.credits);
  const setInventory = usePlayerStore((state) => state.setInventory);

  // Find next tier XP required
  const nextTier = useMemo(() => {
    const nextNum = progress.current_tier + 1;
    return tiers.find((t) => t.tier_number === nextNum) || null;
  }, [progress.current_tier, tiers]);

  // Max tier details
  const maxTierNumber = useMemo(() => {
    return Math.max(...tiers.map((t) => t.tier_number));
  }, [tiers]);

  const progressPercent = useMemo(() => {
    if (!nextTier) return 100;
    if (nextTier.required_xp === 0) return 0;
    return Math.min(100, Math.round((progress.current_xp / nextTier.required_xp) * 100));
  }, [progress.current_xp, nextTier]);

  // Handle claim reward
  const handleClaim = async (tierNumber: number, isPremium: boolean) => {
    if (isPending) return;

    startTransition(async () => {
      const res = await claimRewardAction(tierNumber, isPremium);
      if (res.success) {
        // Update local state
        setProgress((prev) => ({
          ...prev,
          claimed_free_rewards: res.claimedFreeRewards || prev.claimed_free_rewards,
          claimed_premium_rewards: res.claimedPremiumRewards || prev.claimed_premium_rewards,
        }));

        // Sync to Zustand player store
        if (res.newInventory) {
          setInventory(res.newInventory);
        }

        toast.success("Reward claimed successfully!", {
          description: `Enjoy your new items/resources!`,
        });
        router.refresh();
      } else {
        toast.error("Claim failed", { description: res.error });
      }
    });
  };

  // Buy Premium Battle Pass (500 Credits)
  const handleUnlockPremium = async () => {
    if (isPending) return;

    if (credits < 500) {
      toast.error("Insufficient credits", {
        description: "You need 500 Credits to unlock the Premium Battle Pass.",
      });
      return;
    }

    startTransition(async () => {
      const res = await unlockPremiumPassAction();
      if (res.success) {
        setProgress((prev) => ({
          ...prev,
          is_premium_unlocked: res.isPremiumUnlocked,
        }));

        // Update local credits in store
        setInventory({ credits: res.newCredits });

        toast.success("Premium Pass Unlocked!", {
          description: "Welcome to Season 1: Security Overload Premium! Claim premium track rewards now.",
        });
        router.refresh();
      } else {
        toast.error("Unlock failed", { description: res.error });
      }
    });
  };

  // Skip Tier (100 Credits)
  const handleSkipTier = async () => {
    if (isPending) return;

    if (credits < 100) {
      toast.error("Insufficient credits", {
        description: "Skipping a tier costs 100 Credits.",
      });
      return;
    }

    if (progress.current_tier >= maxTierNumber) {
      toast.error("Max tier reached", {
        description: "You are already at the maximum tier of this Battle Pass.",
      });
      return;
    }

    startTransition(async () => {
      const res = await buyTierAction();
      if (res.success) {
        setProgress((prev) => ({
          ...prev,
          current_tier: res.newTier,
          current_xp: 0,
        }));

        // Update credits in store
        setInventory({ credits: res.newCredits });

        toast.success("Tier skipped successfully!", {
          description: `You are now Tier ${res.newTier}!`,
        });
        router.refresh();
      } else {
        toast.error("Skip failed", { description: res.error });
      }
    });
  };

  return (
    <div className="container mx-auto h-full max-w-5xl overflow-y-auto p-4 pb-20 select-none">
      {/* 1. Header Info Bar */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-tr from-primary to-purple-600 border border-primary/20 p-2 text-white shadow-lg shadow-primary/20">
            <Icons.Swords className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Season 1: Security Overload
            </h1>
            <p className="text-xs text-muted-foreground">Level up by raiding and completing quests to claim exclusive gear.</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2">
          {!progress.is_premium_unlocked && (
            <Button
              onClick={handleUnlockPremium}
              disabled={isPending}
              className="bg-gradient-to-r from-amber-500 via-orange-600 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20"
            >
              <Icons.ShieldAlert className="mr-1.5 size-4" />
              Unlock Premium (500 Cr)
            </Button>
          )}

          {progress.current_tier < maxTierNumber && (
            <Button
              onClick={handleSkipTier}
              disabled={isPending}
              variant="outline"
              className="border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 text-xs font-bold"
            >
              <Icons.ArrowUpCircle className="mr-1.5 size-4" />
              Skip Tier (100 Cr)
            </Button>
          )}
        </div>
      </div>

      {/* 2. Glassmorphic Track HUD */}
      <Card className="mb-8 border-primary/20 bg-card/30 backdrop-blur-md shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-purple-600/5 pointer-events-none"></div>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Tier Rank Circle */}
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-full bg-gradient-to-r from-primary to-purple-600 flex flex-col justify-center items-center text-white border-2 border-primary/30 shadow-lg shadow-primary/30 font-mono">
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary-foreground/75 leading-none">Tier</span>
                <span className="text-2xl font-black leading-none mt-0.5">{progress.current_tier}</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {progress.current_tier === maxTierNumber ? "Maximum Level Achieved!" : `Progression toward Tier ${progress.current_tier + 1}`}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {progress.current_tier === maxTierNumber 
                    ? "Season Complete! All rewards unlocked." 
                    : `${progress.current_xp} / ${nextTier?.required_xp} Seasonal BP XP`}
                </p>
              </div>
            </div>

            {/* Linear Progress Tracker */}
            {progress.current_tier < maxTierNumber && (
              <div className="flex-1 w-full max-w-md">
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono mb-1.5">
                  <span>Current Tier {progress.current_tier}</span>
                  <span className="text-primary font-bold">{progressPercent}%</span>
                  <span>Tier {progress.current_tier + 1}</span>
                </div>
                <div className="w-full h-3 bg-background/50 border border-border/40 rounded-full overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full shadow-lg shadow-primary/30 transition-all duration-500 relative"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <span className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></span>
                  </div>
                </div>
              </div>
            )}

            {/* Premium Status Pill */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <span className={`px-3 py-1.5 rounded-full text-xs font-black font-mono tracking-wider flex items-center gap-1.5 ${
                progress.is_premium_unlocked 
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md shadow-amber-500/5" 
                  : "bg-muted/10 border border-border/40 text-muted-foreground"
              }`}>
                <Icons.Crown className={`size-4 ${progress.is_premium_unlocked ? "text-amber-400" : "text-muted-foreground/70"}`} />
                {progress.is_premium_unlocked ? "PREMIUM DECK" : "FREE ACCESS"}
              </span>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* 3. Reward Grid Track (10 Tiers) */}
      <div className="space-y-4">
        <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-2 mb-2">
          <span>Tier Details</span>
          <div className="flex gap-16 mr-36 hidden md:flex">
            <span>Free Reward</span>
            <span>Premium Reward</span>
          </div>
        </div>

        {tiers.map((tier) => {
          const isCurrentOrPast = progress.current_tier >= tier.tier_number;
          const isFuture = progress.current_tier < tier.tier_number;
          
          // Separate rewards
          const freeReward = tier.battle_pass_rewards.find((r) => !r.is_premium);
          const premiumReward = tier.battle_pass_rewards.find((r) => r.is_premium);

          // Claims state
          const isFreeClaimed = progress.claimed_free_rewards.includes(tier.tier_number);
          const isPremiumClaimed = progress.claimed_premium_rewards.includes(tier.tier_number);

          return (
            <div 
              key={tier.tier_number} 
              className={`relative border rounded-2xl p-4 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                progress.current_tier === tier.tier_number
                  ? "bg-primary/5 border-primary/40 shadow-lg shadow-primary/5 relative"
                  : isFuture
                    ? "bg-background/20 border-border/30 opacity-60"
                    : "bg-background/40 border-emerald-500/20 hover:border-emerald-500/30"
              }`}
            >
              {/* Current Active Indicator border glow */}
              {progress.current_tier === tier.tier_number && (
                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-primary to-purple-600 rounded-t-full"></div>
              )}

              {/* A. Tier Circle & Status */}
              <div className="flex items-center gap-3.5 min-w-[120px]">
                <div className={`size-12 rounded-xl flex items-center justify-center font-mono font-black text-lg ${
                  progress.current_tier === tier.tier_number
                    ? "bg-primary text-white border border-primary/20 shadow-md shadow-primary/20 animate-pulse"
                    : isFuture
                      ? "bg-background/60 border border-border/50 text-muted-foreground"
                      : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                }`}>
                  {tier.tier_number.toString().padStart(2, "0")}
                </div>
                <div>
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wide block ${
                    progress.current_tier === tier.tier_number ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {progress.current_tier === tier.tier_number ? "Active Level" : isFuture ? "Locked" : "Unlocked"}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {tier.tier_number === 1 ? "Starter Level" : `Req: ${tier.required_xp} XP`}
                  </span>
                </div>
              </div>

              {/* B. Free Reward Block */}
              {freeReward && (
                <div className="flex-1 border border-border/30 bg-background/30 rounded-xl p-3.5 flex items-center justify-between gap-4 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 border ${
                      isFreeClaimed 
                        ? "bg-muted/10 border-border/40 text-muted-foreground/60"
                        : "bg-primary/10 border-primary/20 text-primary"
                    }`}>
                      <RewardIcon type={freeReward.reward_type} itemType={freeReward.items?.type} className="size-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none block">Free Reward</span>
                      <h4 className={`text-xs font-bold mt-0.5 leading-tight ${isFreeClaimed ? "text-muted-foreground/60 line-through" : "text-foreground"}`}>
                        {freeReward.reward_type === "item" 
                          ? freeReward.items?.name 
                          : `${freeReward.reward_amount.toLocaleString()} ${freeReward.reward_type.toUpperCase()}`}
                      </h4>
                      {freeReward.items?.description && !isFreeClaimed && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px] hidden sm:block">
                          {freeReward.items.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Claim Button */}
                  <div>
                    {isFreeClaimed ? (
                      <span className="text-[10px] font-black font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        <Icons.Check className="size-3.5" /> Claimed
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!isCurrentOrPast || isPending}
                        onClick={() => handleClaim(tier.tier_number, false)}
                        className={`h-7 text-[10px] font-extrabold px-3 ${
                          isCurrentOrPast
                            ? "bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 font-bold"
                            : "bg-background/80 border border-border text-muted-foreground cursor-not-allowed opacity-50"
                        }`}
                      >
                        {isCurrentOrPast ? "CLAIM" : <Icons.Lock className="size-3" />}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* C. Premium Reward Block */}
              {premiumReward && (
                <div className={`flex-1 border rounded-xl p-3.5 flex items-center justify-between gap-4 shadow-inner ${
                  progress.is_premium_unlocked 
                    ? "bg-amber-500/5 border-amber-500/20" 
                    : "bg-background/20 border-border/30 opacity-65"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 border ${
                      isPremiumClaimed
                        ? "bg-muted/10 border-border/40 text-muted-foreground/60"
                        : progress.is_premium_unlocked
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-muted/20 border-border/40 text-muted-foreground"
                    }`}>
                      <RewardIcon type={premiumReward.reward_type} itemType={premiumReward.items?.type} className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 leading-none">
                        <Icons.Crown className={`size-3 ${progress.is_premium_unlocked ? "text-amber-400" : "text-muted-foreground/50"}`} />
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none block">Premium Reward</span>
                      </div>
                      <h4 className={`text-xs font-bold mt-0.5 leading-tight ${isPremiumClaimed ? "text-muted-foreground/60 line-through" : "text-foreground"}`}>
                        {premiumReward.reward_type === "item" 
                          ? premiumReward.items?.name 
                          : `${premiumReward.reward_amount.toLocaleString()} ${premiumReward.reward_type.toUpperCase()}`}
                      </h4>
                      {premiumReward.items?.description && !isPremiumClaimed && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px] hidden sm:block">
                          {premiumReward.items.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Claim Button */}
                  <div>
                    {isPremiumClaimed ? (
                      <span className="text-[10px] font-black font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        <Icons.Check className="size-3.5" /> Claimed
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!isCurrentOrPast || !progress.is_premium_unlocked || isPending}
                        onClick={() => handleClaim(tier.tier_number, true)}
                        className={`h-7 text-[10px] font-extrabold px-3 ${
                          isCurrentOrPast && progress.is_premium_unlocked
                            ? "bg-amber-500 hover:bg-amber-600 text-black shadow-md shadow-amber-500/25 font-bold"
                            : "bg-background/80 border border-border text-muted-foreground cursor-not-allowed opacity-50"
                        }`}
                      >
                        {isCurrentOrPast && progress.is_premium_unlocked 
                          ? "CLAIM" 
                          : isCurrentOrPast 
                            ? <Icons.Crown className="size-3" />
                            : <Icons.Lock className="size-3" />}
                      </Button>
                    )}
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}
