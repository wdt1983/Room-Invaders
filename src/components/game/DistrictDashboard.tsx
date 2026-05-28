"use client";

import React, { useState } from "react";
import { 
  Home, 
  Vault, 
  Map, 
  Zap, 
  Target, 
  Shield, 
  Swords 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { DistrictTreasury } from "./DistrictTreasury";
import { JointRaidLobby } from "./JointRaidLobby";
import { TerritoryMap } from "./TerritoryMap";

interface DistrictDashboardProps {
  district: { id: string; name: string };
  districtGrid: any[][];
  activeNodesCount: number;
  rofMultiplier: number;
  memberCount: number;
  vaultBalances: { scrap: number; components: number; credits: number };
  inventoryBalances: { scrap: number; components: number; credits: number };
  recentTransactions: any[];
  isLeader: boolean;
  withdrawn24h: { scrap: number; components: number; credits: number };
  playerProfile: { id: string; username: string; player_level: number };
  territories: any[];
  recentSkirmishes: any[];
}

export function DistrictDashboard({
  district,
  districtGrid,
  activeNodesCount,
  rofMultiplier,
  memberCount,
  vaultBalances,
  inventoryBalances,
  recentTransactions,
  isLeader,
  withdrawn24h,
  playerProfile,
  territories,
  recentSkirmishes,
}: DistrictDashboardProps) {
  const [activeTab, setActiveTab] = useState<"stronghold" | "treasury" | "territory">("stronghold");

  return (
    <div className="space-y-6">
      
      {/* Premium Cyberpunk Tab Switcher */}
      <div className="flex bg-black/45 border border-primary/20 rounded-2xl p-1.5 shadow-xl max-w-xl mx-auto">
        <button
          onClick={() => setActiveTab("stronghold")}
          className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider transition-all duration-300 rounded-xl flex items-center justify-center gap-2 ${
            activeTab === "stronghold"
              ? "bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <Home className="w-4 h-4" />
          Stronghold sector
        </button>

        <button
          onClick={() => setActiveTab("treasury")}
          className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider transition-all duration-300 rounded-xl flex items-center justify-center gap-2 ${
            activeTab === "treasury"
              ? "bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <Vault className="w-4 h-4" />
          Vault treasury
        </button>

        <button
          onClick={() => setActiveTab("territory")}
          className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider transition-all duration-300 rounded-xl flex items-center justify-center gap-2 ${
            activeTab === "territory"
              ? "bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <Map className="w-4 h-4" />
          War Room Map
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "stronghold" && (
        <div className="space-y-6">
          <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-2xl rounded-2xl p-6">
            <h2 className="text-sm font-black text-white tracking-wider uppercase mb-5">Tactical District Settle Map</h2>

            {/* 3x3 Isometric Matrix Visualizer */}
            <div className="flex justify-center py-10 relative bg-black/35 rounded-2xl border border-primary/10 overflow-hidden shadow-inner">
              <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#0891b2_1px,transparent_1px)] [background-size:16px_16px]"></div>

              <div 
                className="grid grid-cols-3 gap-6 p-8 relative z-10"
                style={{ transform: "rotateX(35deg) rotateZ(-45deg)", transformStyle: "preserve-3d" }}
              >
                {Array(3).fill(null).map((_, y) => 
                  Array(3).fill(null).map((_, x) => {
                    const node = districtGrid[y][x];
                    
                    if (node) {
                      return (
                        <div
                          key={`${x}-${y}`}
                          className={`w-28 h-28 border-2 rounded-2xl flex flex-col items-center justify-center relative p-2 transition-all duration-300 ${
                            node.isMe
                              ? "border-emerald-500 text-emerald-400 bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                              : "border-cyan-500 text-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                          }`}
                          style={{ transform: "translateZ(10px)", transformStyle: "preserve-3d" }}
                        >
                          <div className="absolute top-2.5 right-2.5 flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${node.isMe ? "bg-emerald-500" : "bg-cyan-500"}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${node.isMe ? "bg-emerald-500" : "bg-cyan-500"}`}></span>
                          </div>

                          <Home className="w-6 h-6 mb-1 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />
                          <span className="text-[9px] font-black text-white tracking-wide truncate max-w-full uppercase">
                            {node.username}
                          </span>
                          <span className="text-[8px] text-muted-foreground uppercase font-mono mt-0.5">
                            Lvl {node.roomLevel} Room
                          </span>
                          <span className="absolute bottom-2 text-[8px] font-bold text-cyan-400 font-mono">
                            🛡️ {node.defenseRating}
                          </span>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={`${x}-${y}`}
                          className="w-28 h-28 border border-dashed border-primary/20 bg-background/10 rounded-2xl flex flex-col items-center justify-center text-muted-foreground/40 hover:border-cyan-500/40 hover:text-cyan-400/80 transition-all duration-300"
                        >
                          <span className="text-[10px] font-black tracking-wider font-mono">({x}, {y})</span>
                          <span className="text-[8px] font-bold mt-1 uppercase">EMPTY SLOT</span>
                        </div>
                      );
                    }
                  })
                )}
              </div>
            </div>
          </Card>

          {/* District Power Matrix details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-primary/20 bg-card/40 backdrop-blur rounded-2xl p-4 flex flex-col gap-1 shadow-xl">
              <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
                Active Power Nodes
              </span>
              <span className="text-2xl font-black text-white font-mono mt-1">
                {activeNodesCount} Nodes
              </span>
              <span className="text-[9px] text-muted-foreground uppercase leading-normal mt-0.5">
                Placed across district boundaries.
              </span>
            </Card>

            <Card className="border-primary/20 bg-card/40 backdrop-blur rounded-2xl p-4 flex flex-col gap-1 shadow-xl">
              <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center gap-1.5">
                <Target className="w-4 h-4 text-cyan-400 shrink-0" />
                Grid Rate of Fire Boost
              </span>
              <span className="text-2xl font-black text-cyan-400 font-mono mt-1">
                +{Math.round((rofMultiplier - 1.0) * 100)}% Boost
              </span>
              <span className="text-[9px] text-muted-foreground uppercase leading-normal mt-0.5">
                Applies to all allied turrets.
              </span>
            </Card>

            <Card className="border-primary/20 bg-card/40 backdrop-blur rounded-2xl p-4 flex flex-col gap-1 shadow-xl">
              <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                District Security Bracket
              </span>
              <span className="text-2xl font-black text-white font-mono mt-1">
                {memberCount} Members
              </span>
              <span className="text-[9px] text-muted-foreground uppercase leading-normal mt-0.5">
                Loot plundered proportionally upon breaches.
              </span>
            </Card>
          </div>

          {/* Joint Operations */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2 text-cyan-400">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Joint Operations</h2>
                <p className="text-[10px] text-muted-foreground">Collaborate with allied district members to launch high-stake team breaches.</p>
              </div>
            </div>
            <JointRaidLobby
              districtId={district.id}
              userId={playerProfile.id}
              username={playerProfile.username}
            />
          </div>
        </div>
      )}

      {activeTab === "treasury" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2 text-amber-400">
              <Vault className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Faction Shared Treasury</h2>
              <p className="text-[10px] text-muted-foreground">Pool resources, coordinate upgrades, and manage district operations.</p>
            </div>
          </div>
          <DistrictTreasury
            vaultBalances={vaultBalances}
            inventoryBalances={inventoryBalances}
            recentTransactions={recentTransactions}
            isLeader={isLeader}
            withdrawn24h={withdrawn24h}
          />
        </div>
      )}

      {activeTab === "territory" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2 text-cyan-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground uppercase">Regional War Room Map</h2>
              <p className="text-[10px] text-muted-foreground">Coordinate coordinate conquests and establish territory control bounds.</p>
            </div>
          </div>
          <TerritoryMap
            initialNodes={territories}
            initialSkirmishes={recentSkirmishes}
          />
        </div>
      )}

    </div>
  );
}
