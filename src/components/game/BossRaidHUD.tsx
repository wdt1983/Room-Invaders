"use client";

import { useEffect, useState } from "react";
import { useRaidStore } from "@/lib/store/useRaidStore";
import { resolveFixture } from "@/game/fixtures/npc-rooms";
import { Skull, ShieldAlert, Cpu, Swords, Sparkles } from "lucide-react";

export function BossRaidHUD() {
  const target = useRaidStore((s) => s.target);
  const phase = useRaidStore((s) => s.phase);
  const isBossRaid = useRaidStore((s) => s.isBossRaid);
  const bossHp = useRaidStore((s) => s.bossHp);
  const bossMaxHp = useRaidStore((s) => s.bossMaxHp);
  const bossPhase = useRaidStore((s) => s.bossPhase);
  const bossTotalPhases = useRaidStore((s) => s.bossTotalPhases);
  const bossName = useRaidStore((s) => s.bossName);
  const bossTitle = useRaidStore((s) => s.bossTitle);
  const briefingText = useRaidStore((s) => s.briefingText);

  // Local UI state
  const [showBriefing, setShowBriefing] = useState(true);
  const [lastPhase, setLastPhase] = useState(1);
  const [activeBanner, setActiveBanner] = useState<string | null>(null);

  // Auto-dismiss briefing after 2s once combat is active
  useEffect(() => {
    if (phase === "active") {
      const timer = setTimeout(() => {
        setShowBriefing(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Skip briefing on Space, Escape, or Enter keys
  useEffect(() => {
    if (!showBriefing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Escape" || e.key === "Enter") {
        setShowBriefing(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showBriefing]);

  // Phase transition banner trigger
  useEffect(() => {
    if (!isBossRaid) return;
    if (bossPhase !== lastPhase) {
      setLastPhase(bossPhase);
      if (bossPhase > 1) {
        let bannerText = `⚡ PHASE ${bossPhase} — Combat protocols upgraded!`;
        if (bossName === "Volkov" && bossPhase === 2) {
          bannerText = "⚡ DRONE STRIKE — Tactical assault drones spawned!";
        } else if (bossName === "Circuit" && bossPhase === 2) {
          bannerText = "⚡ OVERCHARGE — All defense turrets fire 2x faster!";
        } else if (bossName === "The Warden") {
          if (bossPhase === 2) {
            bannerText = "🔒 LOCKDOWN — Squad stunned, Warden guards deployed!";
          } else if (bossPhase === 3) {
            bannerText = "🔥 ENRAGED — Damage and movement speed maximized!";
          }
        }
        setActiveBanner(bannerText);
        const timer = setTimeout(() => {
          setActiveBanner(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [bossPhase, lastPhase, bossName, isBossRaid]);

  if (!isBossRaid || !target || phase === "results") return null;

  // Resolve boss fixture to fetch exact phase thresholds
  const fixture = resolveFixture(target.id);
  const bossDef = (fixture as any)?.boss;
  const phases = bossDef?.phases || [];

  // Unified health percentage
  const hpPercent = bossMaxHp > 0 ? (bossHp / bossMaxHp) * 100 : 0;
  const lowHp = hpPercent <= 30;

  return (
    <>
      {/* 1. TOP OVERLAY: BOSS HEALTH BAR */}
      <div className="pointer-events-none absolute inset-x-0 top-[170px] sm:top-[12px] z-45 flex flex-col items-center p-3">
        <div className="w-full max-w-lg rounded-xl border border-red-500/30 bg-black/85 p-3.5 shadow-[0_0_20px_rgba(239,68,68,0.15)] backdrop-blur-xl">
          {/* Header metadata */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-1.5 text-red-500 animate-pulse">
                <Skull className="size-4.5" />
              </div>
              <div className="flex flex-col leading-tight">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-black tracking-wider uppercase text-white font-mono">{bossName}</span>
                  <span className="text-[9px] font-mono tracking-widest text-red-400/80 uppercase">[{bossTitle}]</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider bg-red-950/40 border border-red-900/50 px-2 py-0.5 rounded">
                Boss Encounter
              </span>
              <span className="text-white font-bold">
                Phase {bossPhase}/{bossTotalPhases}
              </span>
            </div>
          </div>

          {/* Health Pool Progress Bar Container */}
          <div className="relative h-4.5 w-full rounded-md border border-red-500/40 bg-red-950/20 overflow-hidden shadow-inner">
            {/* The active health gradient */}
            <div
              className={`h-full transition-all duration-300 ease-out bg-gradient-to-r ${
                lowHp ? "from-red-600 via-rose-500 to-red-600 animate-pulse" : "from-red-700 via-amber-500 to-red-500"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
            />

            {/* Dynamic Phase Threshold Ticks */}
            {phases.map((p: any, idx: number) => {
              if (p.hpThreshold === 1.0) return null;
              const position = p.hpThreshold * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 w-0.75 bg-black/90 border-r border-red-500/30"
                  style={{ left: `${position}%` }}
                  title={`Phase Threshold (${Math.round(position)}%)`}
                />
              );
            })}

            {/* Centered numerical health indicator */}
            <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] tracking-wider">
              {bossHp > 0 ? `${bossHp} / ${bossMaxHp} HP (${Math.round(hpPercent)}%)` : "ELIMINATED"}
            </div>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC CENTER NOTIFICATION BANNER */}
      {activeBanner && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-50 flex justify-center px-4">
          <div className="rounded-xl border-2 border-red-500 bg-red-950/90 px-6 py-4 shadow-[0_0_30px_rgba(239,68,68,0.4)] backdrop-blur-xl animate-bounce flex items-center gap-3">
            <ShieldAlert className="size-6 text-red-400 shrink-0 animate-ping" />
            <div className="flex flex-col">
              <span className="font-mono text-xs uppercase tracking-widest text-red-400 font-bold">Tactical Alert</span>
              <span className="font-mono text-sm font-extrabold text-white tracking-wide">{activeBanner}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. MONOSPACE TERMINAL PRE-RAID BRIEFING */}
      {showBriefing && briefingText && (
        <div className="absolute inset-x-0 bottom-6 sm:bottom-12 z-45 flex justify-center p-4">
          <div 
            onClick={() => setShowBriefing(false)}
            className="w-full max-w-xl rounded-xl border border-red-500/40 bg-black/95 p-4 shadow-[0_0_25px_rgba(0,0,0,0.8)] backdrop-blur-xl cursor-pointer hover:border-red-500/60 transition-all font-mono pointer-events-auto"
          >
            <div className="flex items-center justify-between border-b border-red-500/20 pb-2 mb-3">
              <div className="flex items-center gap-2 text-red-500">
                <Cpu className="size-4 animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest uppercase">The Network // Intercepted Broadcast</span>
              </div>
              <span className="text-[9px] text-muted-foreground animate-pulse">
                [Tap anywhere to skip]
              </span>
            </div>

            {/* Monospace message */}
            <p className="text-xs text-red-100 leading-relaxed italic bg-red-950/10 border border-red-950/40 p-3 rounded mb-2.5">
              {briefingText}
            </p>

            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Swords className="size-3" /> Targeted: {bossName}
              </span>
              <span className="flex items-center gap-1 font-bold text-red-400">
                <Sparkles className="size-3" /> Mission: Terminate Boss Warlord
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
