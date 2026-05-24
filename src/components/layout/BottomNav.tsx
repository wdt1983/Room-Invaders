"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Map,
  Crosshair,
  ClipboardList,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  { href: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-50 shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-14 items-stretch">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase()}`}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
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
