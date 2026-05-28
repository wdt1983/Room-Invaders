"use client";

import React, { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { 
  Zap, 
  Shield, 
  Radio, 
  Cpu, 
  Swords, 
  Lock, 
  Unlock, 
  Clock, 
  Award, 
  TrendingUp, 
  Terminal, 
  ChevronRight,
  Flame
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  getTerritories, 
  getPlayerDistrict, 
  engageSkirmish, 
  getRecentSkirmishes, 
  type TerritoryNode, 
  type SkirmishLog 
} from "@/app/actions/territory";

interface TerritoryMapProps {
  initialNodes: TerritoryNode[];
  initialSkirmishes: SkirmishLog[];
}

export function TerritoryMap({ initialNodes, initialSkirmishes }: TerritoryMapProps) {
  const [nodes, setNodes] = useState<TerritoryNode[]>(initialNodes);
  const [skirmishes, setSkirmishes] = useState<SkirmishLog[]>(initialSkirmishes);
  const [playerDistrict, setPlayerDistrict] = useState<{ id: string; name: string } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodes[0]?.id || null);
  const [isPending, startTransition] = useTransition();

  // Polling / refreshing state
  useEffect(() => {
    // Fetch player district once on mount
    getPlayerDistrict().then(setPlayerDistrict);

    const interval = setInterval(async () => {
      const updatedNodes = await getTerritories();
      if (updatedNodes && updatedNodes.length > 0) {
        setNodes(updatedNodes);
      }
      const updatedSkirmishes = await getRecentSkirmishes();
      if (updatedSkirmishes && updatedSkirmishes.length > 0) {
        setSkirmishes(updatedSkirmishes);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

  const handleSkirmish = (outcome: "victory" | "defeat") => {
    if (!selectedNode) return;
    if (!playerDistrict) {
      toast.error("You must belong to a District Stronghold first! Access the Stronghold Tab to join or establish one.");
      return;
    }
    if (selectedNode.isLocked) {
      toast.error("Sector is locked down after a recent capture. Attack is blocked.");
      return;
    }

    startTransition(async () => {
      const res = await engageSkirmish(selectedNode.id, outcome);
      if (res.success) {
        toast.success(res.message);
        
        // Refresh local data
        const updatedNodes = await getTerritories();
        if (updatedNodes) setNodes(updatedNodes);
        const updatedSkirmishes = await getRecentSkirmishes();
        if (updatedSkirmishes) setSkirmishes(updatedSkirmishes);
      } else {
        toast.error(res.error || "Raid attempt failed.");
      }
    });
  };

  // Hex Math config
  const hexSize = 45;
  const cx = 275;
  const cy = 225;

  const getHexCoords = (q: number, r: number) => {
    // Pointy-topped hex coordinates
    const x = hexSize * Math.sqrt(3) * (q + r / 2) + cx;
    const y = hexSize * 1.5 * r + cy;
    return { x, y };
  };

  const getHexPoints = (x: number, y: number, r: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = ((i * 60 + 30) * Math.PI) / 180;
      points.push(`${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`);
    }
    return points.join(" ");
  };

  const resourceMeta = {
    refinery: {
      label: "Component Refinery",
      color: "text-cyan-400",
      stroke: "stroke-cyan-500",
      fill: "fill-cyan-500/10",
      accent: "bg-cyan-500",
      icon: <Cpu className="w-4 h-4 text-cyan-400" />,
      dividend: "+50 Components / day"
    },
    vault: {
      label: "Scrap Vault",
      color: "text-amber-400",
      stroke: "stroke-amber-500",
      fill: "fill-amber-500/10",
      accent: "bg-amber-500",
      icon: <Shield className="w-4 h-4 text-amber-400" />,
      dividend: "+100 Scrap / day"
    },
    power_station: {
      label: "Power Grid Node",
      color: "text-yellow-400",
      stroke: "stroke-yellow-500",
      fill: "fill-yellow-500/10",
      accent: "bg-yellow-500",
      icon: <Zap className="w-4 h-4 text-yellow-400" />,
      dividend: "+150 Credits / day"
    },
    intel_dish: {
      label: "Satellite Intel Dish",
      color: "text-purple-400",
      stroke: "stroke-purple-500",
      fill: "fill-purple-500/10",
      accent: "bg-purple-500",
      icon: <Radio className="w-4 h-4 text-purple-400" />,
      dividend: "+50 Scrap & +50 Components / day"
    }
  };

  // Color helper based on controlling district
  const getDistrictFill = (node: TerritoryNode) => {
    if (!node.controllingDistrictId) {
      return "fill-zinc-900/40 hover:fill-zinc-800/60";
    }
    if (playerDistrict && node.controllingDistrictId === playerDistrict.id) {
      return "fill-emerald-500/15 hover:fill-emerald-500/25";
    }
    // Hostile District
    return "fill-red-500/15 hover:fill-red-500/25";
  };

  const getDistrictStroke = (node: TerritoryNode) => {
    if (selectedNodeId === node.id) {
      return "stroke-cyan-400 stroke-[3]";
    }
    if (!node.controllingDistrictId) {
      return "stroke-zinc-700 stroke-1 hover:stroke-zinc-500 hover:stroke-[1.5]";
    }
    if (playerDistrict && node.controllingDistrictId === playerDistrict.id) {
      return "stroke-emerald-500 stroke-[2]";
    }
    return "stroke-red-500 stroke-[2]";
  };

  const selectedMeta = selectedNode ? resourceMeta[selectedNode.resourceType] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* COLUMN 1 & 2: Interactive SVG Map & Selection Panel */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Territory Grid Card */}
        <Card className="border-primary/20 bg-card/30 backdrop-blur shadow-xl rounded-2xl overflow-hidden relative">
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Regional War Room Map
            </span>
            <span className="text-[8px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono text-zinc-400 max-w-[220px]">
              District: {playerDistrict ? playerDistrict.name : "None (Neutral)"}
            </span>
          </div>

          <div className="absolute top-4 right-4 z-10 flex gap-2 text-[8px] uppercase font-mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500"></span> Ally District</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500"></span> Rival Districts</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 border border-zinc-500 rounded"></span> Neutral</span>
          </div>

          <div className="flex items-center justify-center p-6 bg-black/40 min-h-[460px]">
            <svg 
              viewBox="0 0 550 450" 
              className="w-full max-w-[550px] aspect-[55/45] filter drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] select-none"
            >
              {/* Board grid lines / links */}
              {nodes.map(n => {
                const start = getHexCoords(n.q, n.r);
                return nodes.map(m => {
                  const dist = Math.max(Math.abs(n.q - m.q), Math.abs(n.r - m.r), Math.abs((n.q+n.r) - (m.q+m.r)));
                  if (dist === 1 && (n.q < m.q || (n.q === m.q && n.r < m.r))) {
                    const end = getHexCoords(m.q, m.r);
                    return (
                      <line
                        key={`link-${n.id}-${m.id}`}
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        className="stroke-zinc-800/60 stroke-[1]"
                        strokeDasharray="2, 4"
                      />
                    );
                  }
                  return null;
                });
              })}

              {/* Render hexagonal nodes */}
              {nodes.map(node => {
                const { x, y } = getHexCoords(node.q, node.r);
                const isSelected = selectedNodeId === node.id;
                const meta = resourceMeta[node.resourceType];

                return (
                  <g 
                    key={node.id} 
                    transform="scale(1)"
                    className="cursor-pointer transition-all duration-300"
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    {/* Glowing highlight outer ring for selected node */}
                    {isSelected && (
                      <polygon
                        points={getHexPoints(x, y, hexSize + 4)}
                        className="fill-none stroke-cyan-400/40 stroke-2 animate-pulse"
                      />
                    )}

                    {/* Main Hexagon Polygon */}
                    <polygon
                      points={getHexPoints(x, y, hexSize)}
                      className={`${getDistrictFill(node)} ${getDistrictStroke(node)} transition-all duration-200`}
                    />

                    {/* Center Icon */}
                    <g transform={`translate(${x - 8}, ${y - 12}) scale(0.9)`}>
                      {node.isLocked ? (
                        <foreignObject width="20" height="20">
                          <Lock className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                        </foreignObject>
                      ) : (
                        <foreignObject width="20" height="20">
                          {meta.icon}
                        </foreignObject>
                      )}
                    </g>

                    {/* Short Text overlay for owner district initials */}
                    {node.controllingDistrictName && (
                      <text
                        x={x}
                        y={y + 16}
                        className="fill-zinc-300 font-black text-[7px] text-center font-mono uppercase truncate max-w-[40px]"
                        textAnchor="middle"
                      >
                        {node.controllingDistrictName.slice(0, 3)}
                      </text>
                    )}

                    {/* Influence indicators */}
                    {node.controllingDistrictId && (
                      <text
                        x={x}
                        y={y - 18}
                        className="fill-zinc-500 font-bold text-[6px]"
                        textAnchor="middle"
                      >
                        {node.influencePoints}%
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </Card>

        {/* Selected Sector Details Box */}
        {selectedNode && selectedMeta && (
          <Card className="border-primary/20 bg-card/40 backdrop-blur rounded-2xl shadow-xl overflow-hidden p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border ${selectedMeta.stroke}/20 ${selectedMeta.fill}`}>
                  {selectedMeta.icon}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{selectedNode.name}</h3>
                  <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1.5 font-bold">
                    Coordinates: ({selectedNode.q}, {selectedNode.r}) • {selectedMeta.label}
                  </span>
                </div>
              </div>

              {/* Lockdown timer if locked */}
              {selectedNode.isLocked ? (
                <div className="flex items-center gap-2 border border-red-500/20 bg-red-500/5 px-3 py-1.5 rounded-xl self-start">
                  <Lock className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <div className="text-left font-mono">
                    <div className="text-[7px] uppercase font-bold text-red-400">Lockdown Active</div>
                    <div className="text-[9px] text-zinc-300 flex items-center gap-1 leading-none mt-0.5">
                      <Clock className="w-2.5 h-2.5" /> 1 hour capture guard
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 rounded-xl self-start">
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <div className="text-left font-mono">
                    <div className="text-[7px] uppercase font-bold text-emerald-400">Status Online</div>
                    <div className="text-[9px] text-zinc-300 leading-none mt-0.5">Open for Incursion</div>
                  </div>
                </div>
              )}
            </div>

            {/* Outpost Tug of War Status Gauge */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              
              <div className="md:col-span-2 space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-muted-foreground font-mono">
                  <span>Influence Tug of War Gauge</span>
                  <span className="text-white">
                    {selectedNode.controllingDistrictName 
                      ? `${selectedNode.controllingDistrictName} Hold: ${selectedNode.influencePoints}%`
                      : "Uncontrolled (Neutral) Outpost"}
                  </span>
                </div>

                <div className="w-full bg-black/60 rounded-full h-3.5 overflow-hidden flex border border-white/5 relative">
                  {selectedNode.controllingDistrictId ? (
                    <div
                      className={`h-full transition-all duration-500 ${
                        playerDistrict && selectedNode.controllingDistrictId === playerDistrict.id 
                          ? "bg-emerald-500" 
                          : "bg-red-500"
                      }`}
                      style={{ width: `${selectedNode.influencePoints}%` }}
                    ></div>
                  ) : (
                    <div className="w-full h-full bg-zinc-800 animate-pulse flex items-center justify-center">
                      <span className="text-[7px] text-muted-foreground uppercase font-black tracking-widest">NEUTRAL ZONE</span>
                    </div>
                  )}
                </div>
                
                <p className="text-[9px] text-zinc-400 leading-relaxed font-medium">
                  Raid this outpost to alter control! Successful raids inject <span className="text-white font-bold">+15 Influence</span> toward your District. Once hostile influence is ground to 0, ownership shifts.
                </p>
              </div>

              {/* Dividends Indicator card */}
              <div className="border border-white/5 bg-black/35 rounded-xl p-4 flex flex-col justify-between h-full min-h-[90px]">
                <span className="text-[8px] uppercase font-black text-muted-foreground tracking-wider flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-cyan-400" /> Passive Yield Dividends
                </span>
                <div className="mt-2 text-left">
                  <div className="text-xs font-bold text-zinc-100 font-mono">
                    {selectedMeta.dividend}
                  </div>
                  <span className="text-[7px] uppercase text-zinc-500 leading-normal block mt-1">
                    Deposited directly to Vault
                  </span>
                </div>
              </div>
            </div>

            {/* Raid Launchers Form CTAs */}
            <div className="border-t border-primary/10 pt-6">
              {!playerDistrict ? (
                <div className="text-center py-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-[10px] text-yellow-400 uppercase font-black tracking-wider flex items-center justify-center gap-2">
                  ⚠️ Faction Stronghold District Required to Launch Skirmish Raids!
                </div>
              ) : selectedNode.isLocked ? (
                <Button 
                  disabled 
                  className="w-full bg-red-800/10 text-red-500/40 border border-red-500/10 uppercase text-xs font-black tracking-widest h-12 rounded-xl flex items-center justify-center gap-2"
                >
                  🔒 Target Sector Locked Down (Protected by Shield)
                </Button>
              ) : (
                <div className="space-y-3">
                  <span className="text-[9px] uppercase font-black text-zinc-400 block tracking-wider font-mono">
                    Authorize Incursion Breach Vector:
                  </span>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Simulated Raid Outcome Triggers (100% full gameplay auth checks) */}
                    <Button
                      onClick={() => handleSkirmish("victory")}
                      disabled={isPending}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white uppercase text-xs font-black tracking-wider h-12 rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20"
                    >
                      {isPending ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      ) : (
                        <>
                          <Swords className="w-4 h-4 text-emerald-100" />
                          Launch Raid (Simulate Win)
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleSkirmish("defeat")}
                      disabled={isPending}
                      className="bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-500/20 uppercase text-xs font-black tracking-wider h-12 rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5"
                    >
                      {isPending ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      ) : (
                        <>
                          <Flame className="w-4 h-4 text-red-400" />
                          Launch Raid (Simulate Loss)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

          </Card>
        )}

      </div>

      {/* COLUMN 3: Live Skirmish Feeds Log */}
      <div className="space-y-6">
        <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-2xl rounded-2xl flex flex-col h-full min-h-[500px]">
          <CardHeader className="pb-3 border-b border-primary/10">
            <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-white">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Regional Skirmish Feed
            </CardTitle>
            <CardDescription className="text-[9px] uppercase tracking-wider font-mono">
              Live Battle Log Reports
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex-1 p-3 overflow-y-auto max-h-[460px] font-mono text-[10px] space-y-3.5 pr-2 custom-scrollbar">
            {skirmishes.length === 0 ? (
              <div className="text-center py-24 text-[9px] text-muted-foreground/60 italic uppercase tracking-wider">
                NO SECTOR ENGAGEMENTS REPORTED
              </div>
            ) : (
              skirmishes.map((sk) => {
                const isVictory = sk.raidOutcome === "victory";
                const dateStr = new Date(sk.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                });

                return (
                  <div
                    key={sk.id}
                    className="border border-white/5 bg-black/25 rounded-lg p-2.5 flex flex-col gap-1 transition-all duration-300 hover:border-white/10"
                  >
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>[{dateStr}]</span>
                      <span
                        className={`font-black uppercase px-1 rounded text-[8px] ${
                          isVictory
                            ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                            : "text-red-400 bg-red-500/10 border border-red-500/20"
                        }`}
                      >
                        {sk.raidOutcome}
                      </span>
                    </div>

                    <div className="text-[10px] text-zinc-300 leading-normal mt-1">
                      District <span className="text-cyan-400 font-bold">{sk.districtName}</span> raided{" "}
                      <span className="text-white font-bold">{sk.territoryName}</span>.
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[8px] text-zinc-500">
                      <span className="italic flex items-center gap-1 font-bold">
                        Raider: {sk.playerName}
                      </span>
                      {isVictory && (
                        <span className="text-emerald-400 font-black">
                          +{sk.influenceContributed}% Influence
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
