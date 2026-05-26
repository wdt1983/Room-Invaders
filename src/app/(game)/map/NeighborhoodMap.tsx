// src/app/(game)/map/NeighborhoodMap.tsx
//
// Phase 6 Tasks 6.0.1, 6.0.2, 6.0.3, 6.0.4, 6.0.5, 6.0.6, 6.0.7, 6.0.10, 6.0.11 — Interactive Neighborhood Map Grid.
// Renders an instanced 5x5 neighborhood block centering the player's base.
// Places active friends on residential coordinates, PvP opponents in mid-slots, and procedurally generated Tiers 1-10 PvE targets in outer slots.
// Supports drag-to-pan, pinch/wheel zoom, dynamic hover sweeps, and detailed scouting dialogs.

"use client";

import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, WheelEvent } from "react";
import Link from "next/link";
import { 
  Home, Users, Store, Building, Warehouse, ShieldAlert, Shield, 
  Swords, Target, Eye, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Lock
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PvPScoutTarget {
  id: string;
  username: string;
  player_level: number;
  room_level: number;
  grid_size: number;
  defense_rating: number;
  scrap_overflow: number;
  components_overflow: number;
}

interface FriendProfile {
  id: string;
  username: string;
  player_level: number;
  room_level?: number;
  defense_rating?: number;
}

interface NeighborhoodMapProps {
  playerProfile: {
    id: string;
    username: string;
    player_level: number;
  };
  pvpTargets: PvPScoutTarget[];
  friends: FriendProfile[];
}

// Deterministic Seeded PRNG for Neighborhood layout randomization
function seedRandom(seedStr: string) {
  let h = 5381;
  for (let i = 0; i < seedStr.length; i++) {
    h = (h * 33) ^ seedStr.charCodeAt(i);
  }
  let state = h >>> 0;
  return function() {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Building details by type
interface BuildingConfig {
  icon: any;
  label: string;
  colorClass: string;
  pulseClass: string;
  bgGlow: string;
  description: string;
}

const BUILDING_THEMES: Record<string, BuildingConfig> = {
  player: {
    icon: Home,
    label: "My Stronghold",
    colorClass: "border-emerald-500 text-emerald-400 bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]",
    pulseClass: "bg-emerald-500",
    bgGlow: "rgba(16, 185, 129, 0.08)",
    description: "Your home base. Safe zone signals are active."
  },
  friend: {
    icon: Users,
    label: "Friend Sanctuary",
    colorClass: "border-cyan-500 text-cyan-400 bg-cyan-950/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]",
    pulseClass: "bg-cyan-500",
    bgGlow: "rgba(6, 182, 212, 0.08)",
    description: "An active ally's room. Click to visit and inspect their defenses."
  },
  house: {
    icon: Building,
    label: "Cottage Ruins",
    colorClass: "border-teal-500/60 text-teal-400 bg-teal-950/30 shadow-[0_0_15px_rgba(20,184,166,0.15)] hover:border-teal-400 hover:shadow-[0_0_25px_rgba(20,184,166,0.3)]",
    pulseClass: "bg-teal-400",
    bgGlow: "rgba(20, 184, 166, 0.06)",
    description: "Low-security residential base. Moderate barricades, light traps."
  },
  apartment: {
    icon: Building,
    label: "Shattered Apartment",
    colorClass: "border-blue-500/60 text-blue-400 bg-blue-950/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:border-blue-400 hover:shadow-[0_0_25px_rgba(59,130,246,0.3)]",
    pulseClass: "bg-blue-400",
    bgGlow: "rgba(59, 130, 246, 0.06)",
    description: "Standard urban apartment. Multi-room layouts with pressure sensors."
  },
  store: {
    icon: Store,
    label: "Corner Bodega",
    colorClass: "border-pink-500/60 text-pink-400 bg-pink-950/30 shadow-[0_0_15px_rgba(236,72,153,0.15)] hover:border-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.3)]",
    pulseClass: "bg-pink-400",
    bgGlow: "rgba(236, 72, 153, 0.06)",
    description: "Commercial convenience point. Locked inventory gates and alarm nodes."
  },
  warehouse: {
    icon: Warehouse,
    label: "Seeded Depot",
    colorClass: "border-amber-500/70 text-amber-400 bg-amber-950/35 shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:border-amber-400 hover:shadow-[0_0_25px_rgba(245,158,11,0.35)]",
    pulseClass: "bg-amber-400",
    bgGlow: "rgba(245, 158, 11, 0.07)",
    description: "Industrial storage warehouse. Heavy barricades and taser fortifications."
  },
  outpost: {
    icon: ShieldAlert,
    label: "Military Outpost",
    colorClass: "border-red-500/80 text-red-400 bg-red-950/40 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:border-red-400 hover:shadow-[0_0_30px_rgba(239,68,68,0.45)]",
    pulseClass: "bg-red-500 animate-ping",
    bgGlow: "rgba(239, 68, 68, 0.08)",
    description: "A heavily fortified military stronghold. Multi-use shock coils and active sentry arrays."
  },
  pvp: {
    icon: Swords,
    label: "Vulnerable Survivor",
    colorClass: "border-purple-500/70 text-purple-400 bg-purple-950/35 shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:border-purple-400 hover:shadow-[0_0_25px_rgba(168,85,247,0.35)] animate-pulse",
    pulseClass: "bg-purple-400",
    bgGlow: "rgba(168, 85, 247, 0.07)",
    description: "A ceasefire-expired active player coordinate. Plunder their scrap overflow!"
  }
};

interface GridNode {
  row: number;
  col: number;
  type: "player" | "friend" | "house" | "apartment" | "store" | "warehouse" | "outpost" | "pvp";
  id: string; // procedural-tier-X-Y or profile ID
  username?: string;
  level: number;
  defenseRating?: number;
  scrapOverflow?: number;
  componentsOverflow?: number;
  cooldownRemaining?: number; // mock or computed cooldown
}

export function NeighborhoodMap({ playerProfile, pvpTargets, friends }: NeighborhoodMapProps) {
  // Navigation / Pan & Zoom State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // Selected Target Dialog Overlay
  const [selectedNode, setSelectedNode] = useState<GridNode | null>(null);

  // Instanced Grid Map data (5x5)
  const [gridNodes, setGridNodes] = useState<GridNode[]>([]);

  // Daily seed initialization based on user + current day
  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const seedKey = `${playerProfile.id}:${todayStr}`;
    const rng = seedRandom(seedKey);

    const nodes: GridNode[] = [];
    let pvpIndex = 0;
    let friendIndex = 0;

    // Build the 5x5 grid
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        // Player Base is always center (2, 2)
        if (r === 2 && c === 2) {
          nodes.push({
            row: r,
            col: c,
            type: "player",
            id: playerProfile.id,
            username: playerProfile.username,
            level: playerProfile.player_level,
            defenseRating: 120 // mock defense rating for home
          });
          continue;
        }

        const dx = Math.abs(r - 2);
        const dy = Math.abs(c - 2);
        const distance = dx + dy; // Manhattan distance

        // Adjacent residential spots (distance === 1): high probability of friends
        const isResidential = distance === 1;
        
        if (isResidential && friendIndex < friends.length) {
          // Place Friend
          const friend = friends[friendIndex++];
          nodes.push({
            row: r,
            col: c,
            type: "friend",
            id: friend.id,
            username: friend.username,
            level: friend.player_level,
            defenseRating: friend.defense_rating ?? 30
          });
          continue;
        }

        // Mid-to-outer coordinates: chance of active PvP opponents
        const canPlacePvP = distance >= 2 && pvpIndex < pvpTargets.length;
        // 40% chance of placing PvP target if available
        if (canPlacePvP && rng() > 0.6) {
          const pvp = pvpTargets[pvpIndex++];
          nodes.push({
            row: r,
            col: c,
            type: "pvp",
            id: pvp.id,
            username: pvp.username,
            level: pvp.player_level,
            defenseRating: pvp.defense_rating,
            scrapOverflow: pvp.scrap_overflow,
            componentsOverflow: pvp.components_overflow
          });
          continue;
        }

        // Fill remaining tiles with procedurally generated NPC bases
        // Map Manhattan distance to NPC Difficulty Tier (1 to 10)
        let tier = 1;
        let bType: "house" | "apartment" | "store" | "warehouse" | "outpost" = "house";

        if (distance === 1) {
          tier = rng() > 0.5 ? 2 : 1;
          bType = "house";
        } else if (distance === 2) {
          tier = rng() > 0.6 ? 5 : rng() > 0.3 ? 4 : 3;
          bType = rng() > 0.5 ? "apartment" : "house";
        } else if (distance === 3) {
          tier = rng() > 0.7 ? 8 : rng() > 0.3 ? 7 : 6;
          bType = rng() > 0.6 ? "warehouse" : rng() > 0.3 ? "store" : "apartment";
        } else {
          // corners (distance === 4)
          tier = rng() > 0.5 ? 10 : 9;
          bType = rng() > 0.5 ? "outpost" : "warehouse";
        }

        nodes.push({
          row: r,
          col: c,
          type: bType,
          id: `procedural-tier-${tier}-${r}-${c}`,
          level: tier,
          defenseRating: tier * 15 + Math.floor(rng() * 10),
        });
      }
    }

    setGridNodes(nodes);
  }, [playerProfile, pvpTargets, friends]);

  // Pan / Drag handlers
  const handlePointerDown = (e: ReactMouseEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handlePointerMove = (e: ReactMouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Imperative non-passive wheel event listener to allow preventDefault for zooming
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const preventZoom = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.05;
      setScale(prev => {
        const nextScale = prev + (e.deltaY < 0 ? zoomFactor : -zoomFactor);
        return Math.max(0.6, Math.min(1.6, nextScale));
      });
    };

    viewport.addEventListener("wheel", preventZoom, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", preventZoom);
    };
  }, []);

  // Recenter controls
  const handleRecenter = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => setScale(prev => Math.min(1.6, prev + 0.1));
  const handleZoomOut = () => setScale(prev => Math.max(0.6, prev - 0.1));

  // Tapping a node selects it
  const handleNodeClick = (node: GridNode) => {
    setSelectedNode(node);
  };

  // Resolve current active theme settings
  const activeTheme = selectedNode ? BUILDING_THEMES[selectedNode.type] : null;

  return (
    <div className="relative w-full h-[620px] rounded-2xl border border-primary/20 bg-background/50 backdrop-blur-md overflow-hidden select-none shadow-2xl">
      {/* Floating Canvas Controls */}
      <div className="absolute top-4 left-4 z-20 flex gap-1.5 bg-background/80 border border-border/60 p-1.5 rounded-xl shadow-lg backdrop-blur">
        <Button size="icon" variant="ghost" onClick={handleZoomIn} className="w-8 h-8 rounded-lg">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleZoomOut} className="w-8 h-8 rounded-lg">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleRecenter} className="w-8 h-8 rounded-lg gap-1">
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-background/80 border border-border/60 px-3 py-1 rounded-xl shadow-lg backdrop-blur">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Instanced Neighborhood Grid</span>
      </div>

      {/* Viewing Draggable Viewport Canvas */}
      <div 
        ref={viewportRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        className={`w-full h-full relative cursor-grab active:cursor-grabbing flex items-center justify-center`}
        style={{ perspective: "1000px" }}
      >
        {/* Seeded Street Network Grid Canvas */}
        <div 
          className="transition-transform duration-75 ease-out select-none flex items-center justify-center p-20"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformStyle: "preserve-3d"
          }}
        >
          {/* Neon street path overlays */}
          <svg className="absolute w-[600px] h-[600px] pointer-events-none opacity-40 z-0 select-none">
            {/* Draw diagonal connecting pipelines/roads */}
            <defs>
              <linearGradient id="neon-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0891b2" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#ec4899" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            {/* Main axis routes */}
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="url(#neon-glow)" strokeWidth="3" strokeDasharray="6,4" />
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="url(#neon-glow)" strokeWidth="3" strokeDasharray="6,4" />
            
            {/* Circular perimeter tracks */}
            <circle cx="50%" cy="50%" r="120" fill="none" stroke="#374151" strokeWidth="1" />
            <circle cx="50%" cy="50%" r="220" fill="none" stroke="#1f2937" strokeWidth="1.5" strokeDasharray="10,8" />
          </svg>

          {/* Isometric board grid container */}
          <div 
            className="grid grid-cols-5 gap-7 p-6 relative z-10"
            style={{ transform: "rotateX(30deg) rotateZ(-45deg)" }}
          >
            {gridNodes.map((node) => {
              const theme = BUILDING_THEMES[node.type];
              const Icon = theme.icon;
              const isSelf = node.type === "player";
              const isAlly = node.type === "friend";

              return (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  className={`w-24 h-24 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center relative group cursor-pointer border-dashed overflow-hidden select-none ${theme.colorClass}`}
                  style={{
                    transform: "translateZ(0px)",
                    transformStyle: "preserve-3d"
                  }}
                >
                  {/* Holographic scanner sweep light overlay */}
                  <div className="absolute inset-0 w-full h-[3px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent top-0 opacity-0 group-hover:opacity-100 group-hover:translate-y-24 transition-all duration-[1000ms] ease-out pointer-events-none"></div>
                  
                  {/* Glowing background matrix */}
                  <div 
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-20 group-hover:opacity-40"
                    style={{ backgroundColor: theme.bgGlow }}
                  ></div>

                  {/* Pulsing indicator corner beacon */}
                  <div className="absolute top-2.5 right-2.5 flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.pulseClass}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.pulseClass}`}></span>
                  </div>

                  {/* Visual Category Icon */}
                  <div className="transform transition-transform duration-300 group-hover:scale-110 group-hover:translate-z-6 select-none">
                    <Icon className="w-7 h-7 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />
                  </div>

                  {/* Quick coordinates / tag */}
                  <div className="absolute bottom-2 text-[9px] font-bold font-mono tracking-wide opacity-80 group-hover:opacity-100 select-none">
                    {isSelf ? "MY BASE" : isAlly ? `LV.${node.level}` : node.type === "pvp" ? `RAID` : `TIER ${node.level}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scout Dialog Overlay */}
      <Dialog open={selectedNode !== null} onOpenChange={(open) => !open && setSelectedNode(null)}>
        {selectedNode && activeTheme && (
          <DialogContent className="sm:max-w-[480px] bg-card/95 border border-primary/30 backdrop-blur-md shadow-2xl p-6 rounded-2xl select-none">
            <DialogHeader className="space-y-1.5 pb-4 border-b border-border/50">
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <div className="relative flex h-3.5 w-3.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeTheme.pulseClass}`}></span>
                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${activeTheme.pulseClass}`}></span>
                </div>
                Scout File: {selectedNode.username ?? activeTheme.label}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Analyzing instanced grid coordinates: ({selectedNode.row}, {selectedNode.col})
              </DialogDescription>
            </DialogHeader>

            <div className="py-5 space-y-5">
              {/* Pulsing Radar Visual */}
              <div className="flex justify-center py-2 relative">
                <div className="w-24 h-24 rounded-full border border-primary/20 flex items-center justify-center relative animate-pulse bg-primary/5">
                  <activeTheme.icon className="w-10 h-10 text-primary animate-bounce duration-1000" />
                  <div className="absolute inset-0 rounded-full border border-dashed border-primary/35 animate-spin duration-[12000ms]"></div>
                </div>
              </div>

              {/* Theme descriptions */}
              <div className="bg-background/40 border border-border/50 p-3.5 rounded-xl text-xs leading-relaxed text-muted-foreground shadow-inner">
                {activeTheme.description}
              </div>

              {/* Defender Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-background/40 border border-border/40 p-3 rounded-xl flex flex-col gap-1 shadow-inner">
                  <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    Defense Cap
                  </span>
                  <span className="text-sm font-bold text-foreground">Rating: {selectedNode.defenseRating ?? 0}</span>
                </div>

                <div className="bg-background/40 border border-border/40 p-3 rounded-xl flex flex-col gap-1 shadow-inner">
                  <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                    <Target className="w-3.5 h-3.5 text-red-400" />
                    Layout Bracket
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {selectedNode.type === "player" || selectedNode.type === "friend" || selectedNode.type === "pvp"
                      ? "Custom Grid"
                      : `${selectedNode.level <= 3 ? "10x10" : selectedNode.level <= 7 ? "12x12" : "14x14"} Tiles`
                    }
                  </span>
                </div>
                
                <div className="bg-background/40 border border-border/40 p-3 rounded-xl flex flex-col gap-1 shadow-inner col-span-2">
                  <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                    Security Bracket
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {selectedNode.type === "player"
                      ? "Ceasefire Active (Friendly Base)"
                      : selectedNode.type === "friend"
                      ? "Sanctuary Coordinate (Friendly Base)"
                      : selectedNode.type === "pvp"
                      ? "Vulnerable Active Player"
                      : `Tier ${selectedNode.level} Procedural Hostile`
                    }
                  </span>
                </div>
              </div>

              {/* Raidable Overflow Assets (conditional for PvP vs NPC) */}
              {(selectedNode.type === "pvp" || (!["player", "friend"].includes(selectedNode.type))) && (
                <div className="bg-background/60 border border-primary/20 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                      Raidable Loot Pool
                    </h4>
                    <span className="text-[10px] text-muted-foreground">Victory payload estimate</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {selectedNode.type === "pvp" ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">⚙️ Scrap plundered:</span>
                          <span className="font-bold text-emerald-400">{selectedNode.scrapOverflow ?? 0} units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">🎛️ Components plundered:</span>
                          <span className="font-bold text-cyan-400">{selectedNode.componentsOverflow ?? 0} units</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">XP Value:</span>
                          <span className="font-bold text-yellow-400">+{45 + selectedNode.level * 15} XP</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Standard Loot:</span>
                          <span className="font-bold text-emerald-400">High Scrap & Component Scaling</span>
                        </div>
                        {selectedNode.level >= 4 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Intel Chance:</span>
                            <span className="font-bold text-purple-400">Low-Moderate</span>
                          </div>
                        )}
                        {selectedNode.level >= 7 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Contraband Chance:</span>
                            <span className="font-bold text-red-400">Low</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-row gap-3 pt-3 border-t border-border/50">
              <Button 
                onClick={() => setSelectedNode(null)}
                variant="outline" 
                className="flex-1 text-xs font-bold border-border/80 hover:bg-muted"
              >
                Close File
              </Button>
              {selectedNode.type === "player" ? (
                <Link href="/room" className="flex-1">
                  <Button className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    Enter Stronghold
                  </Button>
                </Link>
              ) : selectedNode.type === "friend" ? (
                <Link href={`/visit/${selectedNode.id}`} className="flex-1">
                  <Button className="w-full text-xs font-bold bg-cyan-600 hover:bg-cyan-500 border border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                    Visit Sanctuary
                  </Button>
                </Link>
              ) : (
                <Link href={`/raid/${selectedNode.id}`} className="flex-1">
                  <Button 
                    className="w-full text-xs font-bold bg-red-600 hover:bg-red-500 border border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)] animate-pulse"
                  >
                    Launch Raid
                  </Button>
                </Link>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
