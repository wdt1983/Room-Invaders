"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Map,
  Crosshair,
  ClipboardList,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/lib/store/usePlayerStore";

/**
 * Bottom Navigation — fixed 5-tab bar for the game shell.
 * Uses usePathname() to highlight the active route.
 * Designed for mobile-first thumb reachability with iOS safe area padding.
 */

const NAV_ITEMS = [
  { href: "/room", icon: Home, label: "Room" },
  { href: "/map", icon: Map, label: "Map" },
  { href: "/raid", icon: Crosshair, label: "Raid" },
  { href: "/quests", icon: ClipboardList, label: "Quests" },
  { href: "/social", icon: Users, label: "Social" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const activeQuestId = usePlayerStore((state) => state.activeQuestId);

  const shouldGlow = (label: string) => {
    if (!activeQuestId) return false;
    // Glow Room tab for building and placement tasks
    if (["tut-01", "tut-02", "tut-03", "tut-07"].includes(activeQuestId)) {
      return label === "Room";
    }
    // Glow Map tab for scouting and raiding target selection
    if (["tut-04", "tut-05"].includes(activeQuestId)) {
      return label === "Map";
    }
    // Glow Quests tab for final safe mode briefing
    if (activeQuestId === "tut-08") {
      return label === "Quests";
    }
    return false;
  };

  return (
    <nav className="sticky bottom-0 z-50 shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-14 items-stretch px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const isGlowing = shouldGlow(item.label);

          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase()}`}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-all duration-300",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
                isGlowing && "animate-tutorial-glow rounded-md mx-0.5 my-1"
              )}
            >
              <item.icon
                className={cn(
                  "size-5 transition-transform",
                  isActive && "scale-110"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
