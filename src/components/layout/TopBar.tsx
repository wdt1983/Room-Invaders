"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { upgradePlayerLevel } from "@/app/(game)/room/actions";
import { deactivateSafeMode } from "@/app/(game)/quests/actions";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { useRoomStore } from "@/lib/store/useRoomStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Cog,
  Cpu,
  Coins,
  ShieldAlert,
  Radio,
  LogOut,
  Edit,
  Eye,
  ChevronUp,
  Map,
  Home,
  Shield,
  Radar
} from "lucide-react";
import { useUIStore, type UIMode } from "@/lib/store/useUIStore";
import { EventBus } from "@/game/EventBus";
import { levelProgress } from "@/lib/game/progression";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { UpgradePanel } from "@/components/game/UpgradePanel";

/**
 * Top Bar — game header component.
 * Displays player resources and a compact logout button.
 * Fixed to top with backdrop blur for the game shell.
 */
export function TopBar() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000); // refresh every 10s is perfect for display countdowns
    return () => clearInterval(timer);
  }, []);

  const playerLevel = usePlayerStore((state) => state.playerLevel);
  const xp = usePlayerStore((state) => state.xp);
  const maxScrap = usePlayerStore((state) => state.maxScrap);
  const maxComponents = usePlayerStore((state) => state.maxComponents);
  const scrap = usePlayerStore((state) => state.scrap);
  const components = usePlayerStore((state) => state.components);
  const credits = usePlayerStore((state) => state.credits);
  const contraband = usePlayerStore((state) => state.contraband);
  const intel = usePlayerStore((state) => state.intel);
  const storageCapacity = usePlayerStore((state) => state.storageCapacity ?? 500); // Storage protected cap
  const safeModeUntil = usePlayerStore((state) => state.safeModeUntil);
  const defenseRating = useRoomStore((state) => state.defenseRating);
  const defenseSlotsUsed = useRoomStore((state) => state.defenseSlotsUsed);
  const defenseSlotsCap = useRoomStore((state) => state.defenseSlotsCap);

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

  const overflowScrap = Math.max(0, scrap - storageCapacity);
  const overflowComponents = Math.max(0, components - Math.floor(storageCapacity * 0.25));

  const resources = [
    { 
      icon: Cog, 
      label: "Scrap", 
      value: `${scrap} / ${maxScrap}`, 
      color: "text-amber-400",
      overflow: overflowScrap > 0,
      title: overflowScrap > 0 
        ? `Overflow: ${overflowScrap} scrap (Raidable! Cap: ${storageCapacity})` 
        : `Protected storage: ${scrap}/${storageCapacity} scrap (no overflow)`
    },
    { 
      icon: Cpu, 
      label: "Components", 
      value: `${components} / ${maxComponents}`, 
      color: "text-sky-400",
      overflow: overflowComponents > 0,
      title: overflowComponents > 0 
        ? `Overflow: ${overflowComponents} components (Raidable! Cap: ${Math.floor(storageCapacity * 0.25)})` 
        : `Protected storage: ${components}/${Math.floor(storageCapacity * 0.25)} components (no overflow)`
    },
    { icon: Coins, label: "Credits", value: credits.toLocaleString(), color: "text-emerald-400", overflow: false, title: "Credits" },
    { icon: ShieldAlert, label: "Contraband", value: contraband.toLocaleString(), color: "text-purple-400", overflow: false, title: "Contraband" },
    { icon: Radio, label: "Intel", value: intel.toLocaleString(), color: "text-rose-400", overflow: false, title: "Intel" },
  ];

  const slotsAtCap = defenseSlotsUsed >= defenseSlotsCap;

  const upgradeCost = playerLevel * 500;

  // Task 3.0.19: XP progress bar on the level button. `levelProgress`
  // returns `xpIntoLevel / xpForNext` for the current level; clamps to
  // 1.0 at MAX_PLAYER_LEVEL so the bar visibly fills at the cap.
  const { xpIntoLevel, xpForNext, progress01 } = levelProgress(xp);
  const xpTitle =
    xpForNext > 0
      ? `XP: ${xpIntoLevel.toLocaleString()} / ${xpForNext.toLocaleString()} to Lvl ${playerLevel + 1}`
      : `XP: ${xp.toLocaleString()} (max level)`;

  const mode = useUIStore((state) => state.mode);
  const setMode = useUIStore((state) => state.setMode);
  const pathname = usePathname();

  // Each toggle "owns" a specific mode. Clicking it enters that mode if we're
  // not in it, otherwise it returns to the default `view`. This makes every
  // transition reachable without multi-step clicks — e.g., from `defense-view`
  // tapping Edit flips straight to edit mode (exiting defense-view en route).
  const applyMode = (next: UIMode) => {
    setMode(next);
    EventBus.emit("change-mode", next);
  };

  const toggleEditMode = () => applyMode(mode === "edit" ? "view" : "edit");
  const toggleDefenseView = () =>
    applyMode(mode === "defense-view" ? "view" : "defense-view");

  const isEditMode = mode === "edit";
  const isDefenseView = mode === "defense-view";

  const isMap = pathname === "/map";

  return (
    <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Game title and primary navigation */}
      <div className="flex items-center gap-2 mr-2">
        <span className="hidden text-sm font-bold tracking-tight sm:inline-block">
          Room Invaders
        </span>
        <div className="h-4 w-px bg-border hidden sm:block mx-1"></div>
        {isMap ? (
          <Link href="/room">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <Home className="mr-1.5 size-3.5" />
              Home Base
            </Button>
          </Link>
        ) : (
          <Link href="/map">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <Map className="mr-1.5 size-3.5" />
              Global Map
            </Button>
          </Link>
        )}
      </div>

      {/* Resource bar */}
      <div className="flex flex-1 items-center gap-3 overflow-x-auto sm:gap-4">
        {resources.map((res) => (
          <div
            key={res.label}
            className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-all duration-300 ${
              res.overflow 
                ? "bg-amber-500/10 border border-amber-500/30 text-amber-300 animate-pulse font-semibold" 
                : "border border-transparent"
            }`}
            title={res.title}
          >
            <res.icon className={`size-3.5 shrink-0 ${res.color}`} />
            <span className="font-mono font-medium tabular-nums">
              {res.value}
            </span>
            {res.overflow && (
              <span className="hidden md:inline-block text-[9px] px-1 bg-amber-500 text-black font-extrabold rounded select-none uppercase tracking-wider scale-90">
                Raidable
              </span>
            )}
          </div>
        ))}
        <div
          className="flex shrink-0 items-center gap-1 text-xs"
          title={`Defense Rating · Defense Slots ${defenseSlotsUsed}/${defenseSlotsCap}${slotsAtCap ? ' (full)' : ''}`}
        >
          <Shield className={`size-3.5 shrink-0 ${slotsAtCap ? 'text-destructive' : 'text-cyan-400'}`} />
          <span className="font-mono font-medium tabular-nums">
            {defenseRating}
          </span>
          <span className="font-mono text-muted-foreground tabular-nums">
            · {defenseSlotsUsed}/{defenseSlotsCap}
          </span>
        </div>
      </div>

      {/* Edit Mode & Logout */}
      <div className="ml-2 flex shrink-0 items-center gap-2">
        <UpgradePanel />

        {isSafeMode ? (
          <Dialog>
            <DialogTrigger render={
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs border-cyan-500/40 text-cyan-300 bg-cyan-400/10 shadow-lg shadow-cyan-500/10 animate-pulse hover:bg-cyan-400/20"
                title={safeModeUntil ? `Ceasefire active until ${new Date(safeModeUntil).toLocaleString()}` : "Ceasefire active"}
              >
                <Shield className="mr-1.5 size-3.5 text-cyan-400" />
                {safeModeUntil ? formatTimeRemaining(safeModeUntil) : "Active"}
              </Button>
            } />
            <DialogContent className="max-w-md border-cyan-500/30 bg-card/95 text-foreground shadow-2xl">
              <DialogHeader className="flex flex-row items-center gap-3 pb-2 border-b border-border/50">
                <div className="rounded bg-cyan-500/15 p-2 text-cyan-400">
                  <Shield className="size-6" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">Ceasefire Shield</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">Security Protocol 09-Ceasefire</DialogDescription>
                </div>
              </DialogHeader>
              <div className="py-2 space-y-3 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Your base coordinates are under a secure Network ceasefire. Other survivors <strong className="text-foreground">cannot scout or raid your room</strong> to loot your overflow resources.
                </p>
                <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/15 p-3 space-y-1">
                  <div className="flex justify-between text-xs font-bold text-foreground">
                    <span>Ceasefire Expiration:</span>
                    <span className="text-cyan-400 font-mono">{safeModeUntil ? new Date(safeModeUntil).toLocaleString() : "Unknown"}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Time Remaining:</span>
                    <span className="font-mono font-medium">{safeModeUntil ? formatTimeRemaining(safeModeUntil) : "N/A"}</span>
                  </div>
                </div>
                <p>
                  Ceasefire <strong className="text-foreground">automatically expires at Player Level 5</strong>. You can manually deactivate it earlier to engage in PvP scouting and raiding.
                </p>
                <p className="text-amber-500 font-medium bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg flex items-start gap-2">
                  <ShieldAlert className="size-4 shrink-0 text-amber-500 mt-0.5" />
                  <span>
                    <strong>WARNING:</strong> Deactivating ceasefire is permanent. Once disabled, other players can raid your overflow scrap and components!
                  </span>
                </p>
              </div>
              <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <DialogClose render={<Button size="sm" variant="ghost" />}>
                  Close
                </DialogClose>
                <Button
                  size="sm"
                  variant="destructive"
                  className="font-bold"
                  disabled={isPending}
                  onClick={async () => {
                    startTransition(async () => {
                      const res = await deactivateSafeMode();
                      if (res.success) {
                        usePlayerStore.getState().setInventory({ safeModeUntil: res.safeModeUntil });
                        toast.success("Ceasefire deactivated permanently!", {
                          description: "Your base is now vulnerable to raids once matchmaking unlocks."
                        });
                        router.refresh();
                      } else {
                        toast.error("Failed to deactivate ceasefire", { description: res.error });
                      }
                    });
                  }}
                >
                  {isPending ? "Disabling..." : "Disable Ceasefire"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs border-muted-foreground/30 text-muted-foreground hover:bg-muted/10 cursor-not-allowed opacity-60"
            title="Ceasefire deactivated (Player Level 5+ or manually disabled). Your base overflow resources are vulnerable to raids once matchmaking unlocks."
            disabled
          >
            <ShieldAlert className="mr-1.5 size-3.5 text-muted-foreground/80" />
            Shield Down
          </Button>
        )}

        <Button
          onClick={async () => {
            const res = await upgradePlayerLevel(playerLevel);
            if (res.success) {
              usePlayerStore.getState().setPlayerState({ playerLevel: res.newLevel });
              usePlayerStore.getState().setInventory({ scrap: res.newScrap });
              toast.success(`Upgraded to Lvl ${res.newLevel}`, {
                description: `−${upgradeCost} Scrap`,
              });
            } else {
              toast.error("Upgrade failed", { description: res.error });
            }
          }}
          disabled={scrap < upgradeCost}
          variant="outline"
          size="sm"
          title={xpTitle}
          className="relative h-8 overflow-hidden px-2 text-xs border-primary text-primary hover:bg-primary/20"
        >
          {/* XP progress fill — sits behind the label, clipped to the
              current level's progress toward the next threshold. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 bg-primary/20 transition-[width] duration-300"
            style={{ width: `${Math.round(progress01 * 100)}%` }}
          />
          <span className="relative z-10 flex items-center">
            <ChevronUp className="mr-1.5 size-3.5" />
            Lvl {playerLevel} (Cost: {upgradeCost})
          </span>
        </Button>
        <Button
          onClick={toggleDefenseView}
          variant="outline"
          size="sm"
          className={`h-8 px-2 text-xs ${
            isDefenseView ? 'border-cyan-400 text-cyan-300 bg-cyan-400/10' : ''
          }`}
          title={isDefenseView ? 'Exit defense coverage view' : 'Show range / trigger zones for every placed defense'}
        >
          <Radar className="mr-1.5 size-3.5" />
          {isDefenseView ? 'Exit Scan' : 'Defense View'}
        </Button>
        <Button
          onClick={toggleEditMode}
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
        >
          {isEditMode ? (
            <>
              <Eye className="mr-1.5 size-3.5" />
              Exit Edit
            </>
          ) : (
            <>
              <Edit className="mr-1.5 size-3.5" />
              Edit Room
            </>
          )}
        </Button>
        <form action={logout}>
          <Button
            id="logout-button"
            type="submit"
            variant="ghost"
            size="icon-sm"
            title="Logout"
            className="size-8"
          >
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
