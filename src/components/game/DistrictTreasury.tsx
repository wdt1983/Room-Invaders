"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Hammer, 
  Package, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Terminal, 
  Info,
  ChevronRight
} from "lucide-react";
import { depositToVault, withdrawFromVault } from "@/app/actions/vault";

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal";
  resource: "scrap" | "components" | "credits";
  amount: number;
  created_at: string;
  username: string;
}

interface DistrictTreasuryProps {
  vaultBalances: { scrap: number; components: number; credits: number };
  inventoryBalances: { scrap: number; components: number; credits: number };
  recentTransactions: Transaction[];
  isLeader: boolean;
  withdrawn24h: { scrap: number; components: number; credits: number };
}

const DAILY_CAPS = {
  scrap: 150,
  components: 40,
  credits: 50,
};

export function DistrictTreasury({
  vaultBalances,
  inventoryBalances,
  recentTransactions,
  isLeader,
  withdrawn24h,
}: DistrictTreasuryProps) {
  const [activeTab, setActiveTab] = useState<"deposit" | "withdrawal">("deposit");
  const [selectedResource, setSelectedResource] = useState<"scrap" | "components" | "credits">("scrap");
  const [amount, setAmount] = useState<number>(0);
  const [isPending, startTransition] = useTransition();

  const handleMaxAmount = () => {
    if (activeTab === "deposit") {
      setAmount(inventoryBalances[selectedResource]);
    } else {
      const remainingQuota = DAILY_CAPS[selectedResource] - withdrawn24h[selectedResource];
      const maxAllowed = isLeader 
        ? vaultBalances[selectedResource] 
        : Math.min(vaultBalances[selectedResource], Math.max(0, remainingQuota));
      setAmount(maxAllowed);
    }
  };

  const handleTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast.error("Please enter a valid amount greater than zero.");
      return;
    }

    startTransition(async () => {
      let res;
      if (activeTab === "deposit") {
        if (amount > inventoryBalances[selectedResource]) {
          toast.error(`Insufficient inventory resources. You only have ${inventoryBalances[selectedResource]} ${selectedResource}.`);
          return;
        }
        res = await depositToVault(selectedResource, amount);
      } else {
        if (amount > vaultBalances[selectedResource]) {
          toast.error(`Insufficient vault resources. The vault only has ${vaultBalances[selectedResource]} ${selectedResource}.`);
          return;
        }
        if (!isLeader) {
          const remainingQuota = DAILY_CAPS[selectedResource] - withdrawn24h[selectedResource];
          if (amount > remainingQuota) {
            toast.error(`Exceeds daily withdrawal limit. You can only withdraw ${remainingQuota} more ${selectedResource} today.`);
            return;
          }
        }
        res = await withdrawFromVault(selectedResource, amount);
      }

      if (res.success) {
        toast.success(res.message);
        setAmount(0);
      } else {
        toast.error(res.error || "Vault operation failed.");
      }
    });
  };

  // Remaining Cap math
  const getQuotaStatus = (resource: "scrap" | "components" | "credits") => {
    const withdrawn = withdrawn24h[resource];
    const cap = DAILY_CAPS[resource];
    const remaining = Math.max(0, cap - withdrawn);
    const percent = Math.min(100, Math.round((withdrawn / cap) * 100));
    return { withdrawn, cap, remaining, percent };
  };

  const currentQuota = getQuotaStatus(selectedResource);

  const resourceLabels = {
    scrap: "Scrap Metal",
    components: "Components",
    credits: "Credits/Coins",
  };

  const resourceIcons = {
    scrap: <Hammer className="w-4 h-4" />,
    components: <Package className="w-4 h-4" />,
    credits: <Coins className="w-4 h-4" />,
  };

  const resourceColors = {
    scrap: {
      text: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
      accent: "bg-amber-500",
      accentBorder: "focus:border-amber-500/60",
    },
    components: {
      text: "text-cyan-400",
      border: "border-cyan-500/20",
      bg: "bg-cyan-500/5",
      accent: "bg-cyan-500",
      accentBorder: "focus:border-cyan-500/60",
    },
    credits: {
      text: "text-yellow-400",
      border: "border-yellow-500/20",
      bg: "bg-yellow-500/5",
      accent: "bg-yellow-500",
      accentBorder: "focus:border-yellow-500/60",
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* COLUMN 1 & 2: Treasury Balances & Interactive Forms */}
      <div className="md:col-span-2 space-y-6">
        {/* Treasury Cards Grid */}
        <div className="grid grid-cols-3 gap-4">
          {(["scrap", "components", "credits"] as const).map((res) => {
            const colors = resourceColors[res];
            const icon = resourceIcons[res];
            const label = resourceLabels[res];
            const balance = vaultBalances[res];
            const myInv = inventoryBalances[res];

            return (
              <div
                key={res}
                className={`border border-primary/20 bg-card/30 backdrop-blur rounded-2xl p-4 flex flex-col justify-between hover:border-cyan-500/30 transition-all duration-300 shadow-lg`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                    <span className={colors.text}>{icon}</span>
                    {label}
                  </span>
                  <span className="text-[8px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono text-muted-foreground">
                    Inv: {myInv}
                  </span>
                </div>
                <div className="mt-3">
                  <div className={`text-2xl font-black font-mono ${colors.text}`}>
                    {balance}
                  </div>
                  <span className="text-[8px] text-muted-foreground uppercase leading-normal">
                    Shared District Stockpile
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive Transaction Form Panel */}
        <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-2xl rounded-2xl overflow-hidden">
          <div className="flex border-b border-primary/10 bg-black/25">
            <button
              onClick={() => {
                setActiveTab("deposit");
                setAmount(0);
              }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${
                activeTab === "deposit"
                  ? "bg-cyan-600/10 text-cyan-400 border-b-2 border-cyan-500 font-bold"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Deposit to Treasury
            </button>
            <button
              onClick={() => {
                setActiveTab("withdrawal");
                setAmount(0);
              }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${
                activeTab === "withdrawal"
                  ? "bg-cyan-600/10 text-cyan-400 border-b-2 border-cyan-500 font-bold"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Withdraw from Treasury
            </button>
          </div>

          <CardContent className="p-6">
            <form onSubmit={handleTransaction} className="space-y-6">
              {/* Resource Selection */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Select Resource Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["scrap", "components", "credits"] as const).map((res) => {
                    const active = selectedResource === res;
                    const colors = resourceColors[res];
                    return (
                      <button
                        key={res}
                        type="button"
                        onClick={() => {
                          setSelectedResource(res);
                          setAmount(0);
                        }}
                        className={`flex items-center justify-center gap-2 border rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                          active
                            ? `border-cyan-500/50 bg-cyan-500/10 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]`
                            : "border-primary/10 bg-background/20 text-muted-foreground hover:text-white hover:border-primary/30"
                        }`}
                      >
                        <span className={active ? colors.text : "text-muted-foreground"}>
                          {resourceIcons[res]}
                        </span>
                        {res}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Inputs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Transaction Amount
                  </label>
                  <button
                    type="button"
                    onClick={handleMaxAmount}
                    className="text-[9px] font-black uppercase text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Set Max Allowed
                  </button>
                </div>

                <div className="relative flex items-center bg-black/60 border border-primary/20 rounded-xl px-3 py-2">
                  <span className="text-muted-foreground mr-2">{resourceIcons[selectedResource]}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={amount === 0 ? "" : amount}
                    onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="Enter amount..."
                    className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-muted-foreground/40 font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-muted-foreground uppercase font-black font-mono ml-2">
                    {selectedResource}
                  </span>
                </div>

                {/* Amount Slider */}
                <div className="pt-2">
                  <input
                    type="range"
                    min="0"
                    max={
                      activeTab === "deposit"
                        ? inventoryBalances[selectedResource]
                        : isLeader
                        ? vaultBalances[selectedResource]
                        : Math.min(
                            vaultBalances[selectedResource],
                            Math.max(0, DAILY_CAPS[selectedResource] - withdrawn24h[selectedResource])
                          )
                    }
                    value={amount}
                    onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
                    className="w-full h-1 bg-black/60 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              </div>

              {/* Dynamic Info / Safe Cap Details */}
              {activeTab === "withdrawal" && (
                <div className="border border-cyan-500/20 bg-cyan-950/20 rounded-xl p-4 flex gap-3 items-start">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-muted-foreground leading-none">
                      <span>Daily Safety Cap Limit Quota</span>
                      {isLeader ? (
                        <span className="text-emerald-400 font-extrabold tracking-wider">
                          Leader Bypass Active
                        </span>
                      ) : (
                        <span>
                          {currentQuota.withdrawn} / {currentQuota.cap} {selectedResource} Used
                        </span>
                      )}
                    </div>

                    {!isLeader && (
                      <>
                        <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${resourceColors[selectedResource].accent}`}
                            style={{ width: `${currentQuota.percent}%` }}
                          ></div>
                        </div>
                        <p className="text-[9px] text-muted-foreground leading-normal">
                          Normal members are capped at withdrawing a maximum of{" "}
                          <span className="text-white font-mono">{currentQuota.cap} {selectedResource}</span> per 24 hours to prevent rogue district plundering. Faction Leaders bypass this cap.
                        </p>
                      </>
                    )}
                    {isLeader && (
                      <p className="text-[9px] text-muted-foreground leading-normal">
                        As District Faction Leader (central coordinate <span className="font-mono text-white">1, 1</span>), you have full unlimited withdrawal access to all vault balances.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button
                type="submit"
                disabled={isPending || amount <= 0}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-xs font-black tracking-wider uppercase h-11 rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5"
              >
                {isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                ) : activeTab === "deposit" ? (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    Authorize Deposit ({amount})
                  </>
                ) : (
                  <>
                    <ArrowDownLeft className="w-4 h-4" />
                    Authorize Withdrawal ({amount})
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* COLUMN 3: Transaction Ledgers */}
      <div className="space-y-6">
        <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-2xl rounded-2xl flex flex-col h-full min-h-[400px]">
          <CardHeader className="pb-3 border-b border-primary/10">
            <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-white">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Shared Vault Ledger
            </CardTitle>
            <CardDescription className="text-[9px] uppercase tracking-wider font-mono">
              Live Faction Action Logs
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-3 overflow-y-auto max-h-[420px] font-mono text-[10px] space-y-3.5 pr-2 custom-scrollbar">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-20 text-[9px] text-muted-foreground/60 italic uppercase tracking-wider">
                NO ACTIONS RECORDED ON LEDGER
              </div>
            ) : (
              recentTransactions.map((tx) => {
                const isDeposit = tx.type === "deposit";
                const dateStr = new Date(tx.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                return (
                  <div
                    key={tx.id}
                    className="border border-white/5 bg-black/25 rounded-lg p-2.5 flex flex-col gap-1 transition-all duration-300 hover:border-white/10"
                  >
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>[{dateStr}]</span>
                      <span
                        className={`font-black uppercase px-1 rounded text-[8px] ${
                          isDeposit
                            ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                            : "text-orange-400 bg-orange-500/10 border border-orange-500/20"
                        }`}
                      >
                        {tx.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-zinc-300 font-bold uppercase">
                      <span className="text-white truncate max-w-[100px]">
                        {tx.username}
                      </span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className={isDeposit ? "text-emerald-400" : "text-orange-400"}>
                        {isDeposit ? "+" : "-"}{tx.amount}
                      </span>
                      <span className="text-zinc-500 text-[8px] tracking-wide">
                        {tx.resource}
                      </span>
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
