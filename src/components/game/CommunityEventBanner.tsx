"use client";

import { useEffect, useState } from "react";
import { getActiveEvent, type CommunityEvent } from "@/app/actions/community-events";
import { AlertTriangle, ShieldAlert, Zap, Flame, Compass } from "lucide-react";

/**
 * CommunityEventBanner — Mounted in the TopBar or main page flow.
 * Checks for server-active global events and renders a high-visibility, 
 * blinking glassmorphic status alert with countdowns and active game modifiers.
 */
export function CommunityEventBanner() {
  const [activeEvent, setActiveEvent] = useState<CommunityEvent | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const fetchEvent = async () => {
      const event = await getActiveEvent();
      setActiveEvent(event);
    };

    fetchEvent();

    // Poll every 30 seconds to catch schedule changes
    const pollInterval = setInterval(fetchEvent, 30000);
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    if (!activeEvent) return;

    const updateTimer = () => {
      const target = new Date(activeEvent.endsAt).getTime();
      const diff = target - Date.now();

      if (diff <= 0) {
        setTimeLeft("Event Ended");
        setActiveEvent(null); // Clear expired event
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const hourPad = String(hours).padStart(2, "0");
      const minPad = String(mins).padStart(2, "0");
      const secPad = String(secs).padStart(2, "0");

      setTimeLeft(`${hourPad}:${minPad}:${secPad}`);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [activeEvent]);

  if (!activeEvent) return null;

  const eventConfigs: Record<string, { icon: any; color: string; bg: string; border: string }> = {
    sector_blackout: {
      icon: ShieldAlert,
      color: "text-amber-400",
      bg: "bg-amber-950/20",
      border: "border-amber-500/30",
    },
    turret_malfunction: {
      icon: Zap,
      color: "text-rose-400",
      bg: "bg-rose-950/20",
      border: "border-rose-500/30",
    },
    double_scrap: {
      icon: Flame,
      color: "text-emerald-400",
      bg: "bg-emerald-950/20",
      border: "border-emerald-500/30",
    },
    scrap_frenzy: {
      icon: Compass,
      color: "text-cyan-400",
      bg: "bg-cyan-950/20",
      border: "border-cyan-500/30",
    }
  };

  const config = eventConfigs[activeEvent.eventType] || eventConfigs.sector_blackout;
  const EventIcon = config.icon;

  return (
    <div className={`relative flex items-center justify-between gap-3 px-3 py-2 border rounded-xl backdrop-blur ${config.bg} ${config.border} transition-all duration-500 shadow-md max-w-lg mx-auto sm:mx-0 select-none animate-in fade-in slide-in-from-top-2`}>
      {/* Blinking alert nodes */}
      <span className="flex h-2.5 w-2.5 shrink-0 relative">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
      </span>

      <div className="flex-1 flex gap-2 items-center text-left">
        <EventIcon className={`size-4 shrink-0 ${config.color} animate-pulse`} />
        <div>
          <h4 className="text-[11px] font-extrabold tracking-wide uppercase text-foreground leading-none flex items-center gap-1.5">
            District Operation Active
          </h4>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 max-w-sm line-clamp-1">
            {activeEvent.title}: {activeEvent.description}
          </p>
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-0.5 border-l border-border/40 pl-3">
        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider leading-none">
          Ends In
        </span>
        <span className={`text-[10px] font-mono font-bold leading-none mt-0.5 tabular-nums ${config.color} animate-pulse`}>
          {timeLeft}
        </span>
      </div>
    </div>
  );
}
