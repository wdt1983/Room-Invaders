"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crosshair, Timer, Lock, Clock } from "lucide-react";
import type { NpcRoomFixture } from "@/game/fixtures/npc-rooms";
import { RAID_DURATION_SECONDS } from "@/lib/store/useRaidStore";

const DIFFICULTY_LABEL: Record<NpcRoomFixture["difficulty"], string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const DIFFICULTY_COLOR: Record<NpcRoomFixture["difficulty"], string> = {
  easy: "text-emerald-400",
  medium: "text-amber-400",
  hard: "text-destructive",
};

interface RaidTargetCardProps {
  fixture: NpcRoomFixture;
  playerLevel: number;
  availableAtMs: number | null; // Timestamp when it becomes available, or null if ready
}

export function RaidTargetCard({ fixture, playerLevel, availableAtMs }: RaidTargetCardProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const initialTimer = setTimeout(() => setNow(Date.now()), 0);
    if (!availableAtMs) return () => clearTimeout(initialTimer);
    
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [availableAtMs]);

  const seconds = RAID_DURATION_SECONDS[fixture.difficulty];
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const timerLabel = ss === 0 ? `${mm}:00` : `${mm}:${ss.toString().padStart(2, "0")}`;

  const isLevelLocked = playerLevel < fixture.requiredLevel;
  
  let isCooldown = false;
  let cooldownLabel = "";
  if (availableAtMs && now !== null && availableAtMs > now) {
    isCooldown = true;
    const diffMs = availableAtMs - now;
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    cooldownLabel = `${hrs}h ${mins}m ${secs}s`;
  }

  const isLocked = isLevelLocked || isCooldown;

  return (
    <Card className={`border-primary/20 bg-card/50 backdrop-blur ${isLocked ? 'opacity-75 grayscale-[0.3]' : ''}`}>
      <CardHeader className="border-b border-border/50 pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2">
            {isLevelLocked ? <Lock className="size-5 text-muted-foreground" /> : <Crosshair className="size-5 text-muted-foreground" />}
            {fixture.name}
          </CardTitle>
          <div className={`rounded bg-primary/10 px-2 py-1 text-xs font-bold ${DIFFICULTY_COLOR[fixture.difficulty]}`}>
            {DIFFICULTY_LABEL[fixture.difficulty]}
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-4">
        <CardDescription className="text-sm">
          {fixture.description}
        </CardDescription>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Timer className="size-3.5" />
            {timerLabel}
          </span>
          <span className={isLevelLocked ? "text-destructive font-semibold" : ""}>
            Level {fixture.requiredLevel} Required
          </span>
        </div>
      </CardContent>
      <CardFooter>
        {isLocked ? (
          <Button variant="secondary" className="w-full gap-2" disabled>
            {isLevelLocked ? (
              <>
                <Lock className="size-4" />
                Locked
              </>
            ) : (
              <>
                <Clock className="size-4" />
                Available in {cooldownLabel}
              </>
            )}
          </Button>
        ) : (
          <Link href={`/raid/${fixture.id}`} className="w-full">
            <Button variant="default" className="w-full gap-2">
              <Crosshair className="size-4" />
              Launch Raid
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
