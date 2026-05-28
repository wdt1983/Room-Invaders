/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowRightLeft, 
  Wrench, 
  Cpu, 
  Coins, 
  Plus, 
  Minus, 
  User, 
  Shield, 
  Check, 
  X, 
  Trash2, 
  TrendingUp, 
  Package,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { 
  proposeTradeAction, 
  acceptTradeAction, 
  withdrawTradeAction, 
  declineTradeAction 
} from "@/app/(game)/social/actions";

interface Friend {
  friendshipId: string;
  id: string;
  username: string;
  player_level: number;
}

interface TradingTerminalProps {
  friends: Friend[];
  currentUserId: string;
}

export function TradingTerminal({ friends, currentUserId }: TradingTerminalProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "create" | "history">("pending");
  const [loading, setLoading] = useState(false);

  // Lists loaded from DB
  const [districtMates, setDistrictMates] = useState<any[]>([]);
  const [unplacedItems, setUnplacedItems] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any>({ scrap: 0, components: 0, credits: 0 });

  // Trade offer tracking lists
  const [pendingTrades, setPendingTrades] = useState<any[]>([]);
  const [historyTrades, setHistoryTrades] = useState<any[]>([]);

  // Creation State
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [offerScrap, setOfferScrap] = useState(0);
  const [offerComponents, setOfferComponents] = useState(0);
  const [offerCredits, setOfferCredits] = useState(0);
  const [demandScrap, setDemandScrap] = useState(0);
  const [demandComponents, setDemandComponents] = useState(0);
  const [demandCredits, setDemandCredits] = useState(0);

  // Selected items offered/demanded in creation
  const [offeredItemQuantities, setOfferedItemQuantities] = useState<{ [key: string]: number }>({});
  const [demandedItemsList, setDemandedItemsList] = useState<{ itemId: string; quantity: number }[]>([]);
  const [selectedDemandItemId, setSelectedDemandItemId] = useState("");
  const [selectedDemandQty, setSelectedDemandQty] = useState(1);

  const supabase = createClient();

  // Load resources & active lists
  const loadTradingData = async () => {
    if (!currentUserId) return;
    setLoading(true);

    try {
      // 1. Fetch Inventory Balances
      const { data: invData } = await supabase
        .from("inventories")
        .select("scrap, components, credits")
        .eq("owner_id", currentUserId)
        .single();
      if (invData) setInventory(invData);

      // 2. Fetch Unplaced Items (where placed_in_room = false)
      const { data: unplacedRows } = await supabase
        .from("player_items")
        .select(`
          id,
          quantity,
          item_id,
          items!inner ( id, name, type, sprite_key )
        `)
        .eq("owner_id", currentUserId)
        .eq("placed_in_room", false);

      const formattedUnplaced = (unplacedRows || []).map((row: any) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        return {
          playerItemId: row.id,
          itemId: item?.id,
          name: item?.name || "Unknown Item",
          type: item?.type || "furniture",
          spriteKey: item?.sprite_key,
          quantity: row.quantity
        };
      });
      setUnplacedItems(formattedUnplaced);

      // 3. Fetch Master Items Catalog (for demanding counter-offers)
      const { data: catRows } = await supabase
        .from("items")
        .select("id, name, type, sprite_key")
        .order("name");
      setCatalogItems(catRows || []);

      // 4. Fetch District Mates
      const { data: memberRow } = await (supabase
        .from("district_members") as any)
        .select("district_id")
        .eq("profile_id", currentUserId)
        .maybeSingle();

      if (memberRow?.district_id) {
        const { data: matesRows } = await supabase
          .from("district_members")
          .select(`
            profile_id,
            profile:profile_id ( id, username, player_level )
          `)
          .eq("district_id", memberRow.district_id)
          .neq("profile_id", currentUserId);

        const mappedMates = (matesRows || []).map((row: any) => {
          const prof = Array.isArray(row.profile) ? row.profile[0] : row.profile;
          return {
            id: prof?.id,
            username: prof?.username || "District Mate",
            player_level: prof?.player_level || 1
          };
        });
        setDistrictMates(mappedMates);
      } else {
        setDistrictMates([]);
      }

      // 5. Fetch Trades (pending and completed)
      await fetchTrades();
    } catch (err) {
      console.error("[TradingTerminal] Fetch error:", err);
      toast.error("Failed to load trading details");
    } finally {
      setLoading(false);
    }
  };

  const fetchTrades = async () => {
    // Select trade offers joined to trade items, sender profile, and receiver profile
    const { data: trades, error } = await supabase
      .from("trade_offers")
      .select(`
        *,
        sender:sender_id ( id, username, player_level ),
        receiver:receiver_id ( id, username, player_level ),
        trade_items (
          id,
          quantity,
          direction,
          item:item_id ( id, name, type, sprite_key )
        )
      `)
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[TradingTerminal] Trades fetch failed:", error);
      return;
    }

    const allTrades = (trades || []).map((t: any) => {
      const snd = Array.isArray(t.sender) ? t.sender[0] : t.sender;
      const rcv = Array.isArray(t.receiver) ? t.receiver[0] : t.receiver;
      return {
        ...t,
        sender: snd,
        receiver: rcv,
        items: (t.trade_items || []).map((ti: any) => {
          const baseItem = Array.isArray(ti.item) ? ti.item[0] : ti.item;
          return {
            id: ti.id,
            quantity: ti.quantity,
            direction: ti.direction,
            name: baseItem?.name || "Unknown Item",
            type: baseItem?.type || "furniture",
            spriteKey: baseItem?.sprite_key
          };
        })
      };
    });

    setPendingTrades(allTrades.filter((t: any) => t.status === "pending"));
    setHistoryTrades(allTrades.filter((t: any) => t.status !== "pending"));
  };

  useEffect(() => {
    loadTradingData();
  }, [currentUserId]);

  // Handle Increments offered items
  const adjustOfferedItem = (itemId: string, maxQty: number, amount: number) => {
    setOfferedItemQuantities(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, Math.min(maxQty, current + amount));
      return { ...prev, [itemId]: next };
    });
  };

  // Demanded Items Management
  const addDemandedItem = () => {
    if (!selectedDemandItemId) {
      toast.error("Please select an item to demand.");
      return;
    }

    const item = catalogItems.find(i => i.id === selectedDemandItemId);
    if (!item) return;

    // Check if already in list
    const existingIdx = demandedItemsList.findIndex(i => i.itemId === selectedDemandItemId);
    if (existingIdx !== -1) {
      setDemandedItemsList(prev => {
        const next = [...prev];
        next[existingIdx].quantity += selectedDemandQty;
        return next;
      });
    } else {
      setDemandedItemsList(prev => [
        ...prev,
        { itemId: selectedDemandItemId, quantity: selectedDemandQty }
      ]);
    }

    setSelectedDemandItemId("");
    setSelectedDemandQty(1);
    toast.success(`Added ${item.name} to counter-demand list!`);
  };

  const removeDemandedItem = (itemId: string) => {
    setDemandedItemsList(prev => prev.filter(i => i.itemId !== itemId));
  };

  // Submit Trade Proposal
  const handleProposeTrade = async () => {
    if (!targetPlayerId) {
      toast.error("Please select a trade partner.");
      return;
    }

    // offered items format
    const itemsPayload: any[] = [];
    
    // Add offered items
    Object.entries(offeredItemQuantities).forEach(([itemId, quantity]) => {
      if (quantity > 0) {
        itemsPayload.push({
          item_id: itemId,
          quantity,
          direction: "offer"
        });
      }
    });

    // Add demanded items
    demandedItemsList.forEach(item => {
      itemsPayload.push({
        item_id: item.itemId,
        quantity: item.quantity,
        direction: "demand"
      });
    });

    const hasOffer = offerScrap > 0 || offerComponents > 0 || offerCredits > 0 || itemsPayload.some(i => i.direction === "offer");
    const hasDemand = demandScrap > 0 || demandComponents > 0 || demandCredits > 0 || itemsPayload.some(i => i.direction === "demand");

    if (!hasOffer && !hasDemand) {
      toast.error("Trades cannot be empty! Please offer or demand assets.");
      return;
    }

    setLoading(true);
    const res = await proposeTradeAction(
      targetPlayerId,
      offerScrap,
      offerComponents,
      offerCredits,
      demandScrap,
      demandComponents,
      demandCredits,
      itemsPayload
    );

    setLoading(false);
    if (res.success) {
      toast.success("Barter trade proposal created and locked in escrow!");
      
      // Reset creation form
      setTargetPlayerId("");
      setOfferScrap(0);
      setOfferComponents(0);
      setOfferCredits(0);
      setDemandScrap(0);
      setDemandComponents(0);
      setDemandCredits(0);
      setOfferedItemQuantities({});
      setDemandedItemsList([]);
      
      // Reload Lists
      loadTradingData();
      setActiveTab("pending");
    } else {
      toast.error(res.error || "Failed to propose trade.");
    }
  };

  // Accept Trade
  const handleAcceptTrade = async (tradeId: string) => {
    setLoading(true);
    const res = await acceptTradeAction(tradeId);
    setLoading(false);
    if (res.success) {
      toast.success("Barter agreement completed! Balances updated atomically.");
      loadTradingData();
    } else {
      toast.error(res.error || "Failed to accept trade.");
    }
  };

  // Withdraw Trade
  const handleWithdrawTrade = async (tradeId: string) => {
    setLoading(true);
    const res = await withdrawTradeAction(tradeId);
    setLoading(false);
    if (res.success) {
      toast.success("Trade withdrawn. Escrow assets returned to your inventory!");
      loadTradingData();
    } else {
      toast.error(res.error || "Failed to withdraw trade.");
    }
  };

  // Decline Trade
  const handleDeclineTrade = async (tradeId: string) => {
    setLoading(true);
    const res = await declineTradeAction(tradeId);
    setLoading(false);
    if (res.success) {
      toast.success("Trade proposal declined. Escrow assets refunded to sender.");
      loadTradingData();
    } else {
      toast.error(res.error || "Failed to decline trade.");
    }
  };

  // Helpers to fetch potential partner lists
  const combinedPartners = [
    ...friends.map(f => ({ ...f, type: "Friend" })),
    ...districtMates
      .filter(dm => !friends.some(f => f.id === dm.id))
      .map(dm => ({ ...dm, type: "District Mate" }))
  ];

  return (
    <div className="space-y-6">
      {/* Sub tabs inside social page */}
      <div className="flex bg-background/50 border border-border/40 p-1 rounded-lg text-xs w-full max-w-md mx-auto shadow-md">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 py-1.5 rounded font-bold text-center transition-all ${activeTab === "pending" ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground"}`}
        >
          Barter Board ({pendingTrades.length})
        </button>
        <button
          onClick={() => setActiveTab("create")}
          className={`flex-1 py-1.5 rounded font-bold text-center transition-all ${activeTab === "create" ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground"}`}
        >
          Propose Barter
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-1.5 rounded font-bold text-center transition-all ${activeTab === "history" ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground"}`}
        >
          Log Archive
        </button>
      </div>

      <div className="flex justify-between items-center bg-card/10 border border-border/30 rounded-xl p-3 backdrop-blur max-w-md mx-auto">
        <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
          <div className="flex items-center gap-1 text-amber-500">
            <Wrench className="size-3.5" />
            <span>Scrap: {inventory.scrap}</span>
          </div>
          <div className="flex items-center gap-1 text-cyan-400">
            <Cpu className="size-3.5" />
            <span>Components: {inventory.components}</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-400">
            <Coins className="size-3.5" />
            <span>Credits: {inventory.credits}</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon-sm" 
          onClick={loadTradingData}
          disabled={loading}
          className="size-7 hover:bg-muted/40"
        >
          <RefreshCw className={`size-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Tab Contents */}
      {activeTab === "pending" && (
        <div className="space-y-6">
          {/* Incoming Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-primary rotate-180" /> Inbound Offers
            </h3>
            {pendingTrades.filter(t => t.receiver_id === currentUserId).length > 0 ? (
              pendingTrades
                .filter(t => t.receiver_id === currentUserId)
                .map(trade => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    role="receiver"
                    onAccept={() => handleAcceptTrade(trade.id)}
                    onDecline={() => handleDeclineTrade(trade.id)}
                    loading={loading}
                  />
                ))
            ) : (
              <div className="text-center py-6 border border-border/20 bg-background/10 rounded-xl text-muted-foreground text-[10.5px]">
                No inbound barter offers waiting for your signature.
              </div>
            )}
          </div>

          {/* Outgoing Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-primary" /> Outbound proposals
            </h3>
            {pendingTrades.filter(t => t.sender_id === currentUserId).length > 0 ? (
              pendingTrades
                .filter(t => t.sender_id === currentUserId)
                .map(trade => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    role="sender"
                    onWithdraw={() => handleWithdrawTrade(trade.id)}
                    loading={loading}
                  />
                ))
            ) : (
              <div className="text-center py-6 border border-border/20 bg-background/10 rounded-xl text-muted-foreground text-[10.5px]">
                No outbound barter proposals currently deployed in escrow.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "create" && (
        <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-xl max-w-2xl mx-auto">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ArrowRightLeft className="size-4 text-primary animate-pulse" />
              Propose Secure Barter Agreement
            </CardTitle>
            <CardDescription className="text-[10px]">
              Deducts offered items instantly into Supabase Escrow. Fully refunded on decline or withdrawal.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Trade Partner Choice */}
            <div className="space-y-2">
              <label className="text-[10.5px] font-bold text-foreground block">Select Partner</label>
              <select
                value={targetPlayerId}
                onChange={(e) => setTargetPlayerId(e.target.value)}
                className="w-full h-8 text-xs bg-background/60 border border-border/60 rounded px-2 text-foreground font-sans focus:outline-none"
              >
                <option value="">-- Choose friend or district mate --</option>
                {combinedPartners.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.username} (Lvl {p.player_level}) — [{p.type}]
                  </option>
                ))}
              </select>
            </div>

            {/* Split layout: What you give, what you receive */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Offering Side */}
              <div className="border border-border/40 bg-background/10 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 border-b border-border/30 pb-1.5">
                  <TrendingUp className="size-4" />
                  Your Assets (What You Give)
                </div>

                {/* Offer Currencies */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10.5px] text-muted-foreground font-semibold">
                    <span>Scrap (Max {inventory.scrap})</span>
                    <span className="font-bold text-amber-500">{offerScrap}</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max={inventory.scrap}
                    value={offerScrap}
                    onChange={(e) => setOfferScrap(Number(e.target.value))}
                    className="h-2 bg-muted/60 p-0 cursor-pointer"
                  />
                  
                  <div className="flex justify-between items-center text-[10.5px] text-muted-foreground font-semibold">
                    <span>Components (Max {inventory.components})</span>
                    <span className="font-bold text-cyan-400">{offerComponents}</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max={inventory.components}
                    value={offerComponents}
                    onChange={(e) => setOfferComponents(Number(e.target.value))}
                    className="h-2 bg-muted/60 p-0 cursor-pointer"
                  />

                  <div className="flex justify-between items-center text-[10.5px] text-muted-foreground font-semibold">
                    <span>Credits (Max {inventory.credits})</span>
                    <span className="font-bold text-emerald-400">{offerCredits}</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max={inventory.credits}
                    value={offerCredits}
                    onChange={(e) => setOfferCredits(Number(e.target.value))}
                    className="h-2 bg-muted/60 p-0 cursor-pointer"
                  />
                </div>

                {/* Offer Items */}
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Unplaced Blueprints to Offer
                  </label>
                  {unplacedItems.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto pr-1 space-y-1.5">
                      {unplacedItems.map(item => (
                        <div key={item.playerItemId} className="flex justify-between items-center bg-background/40 border border-border/30 rounded p-1.5 text-xs">
                          <div>
                            <p className="font-bold text-[10.5px] leading-tight">{item.name}</p>
                            <span className="text-[8.5px] text-muted-foreground/80 font-mono capitalize">{item.type}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 hover:bg-muted"
                              onClick={() => adjustOfferedItem(item.itemId, item.quantity, -1)}
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span className="font-mono text-xs w-8 text-center">
                              {offeredItemQuantities[item.itemId] || 0} <span className="text-[10px] text-muted-foreground">/{item.quantity}</span>
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 hover:bg-muted"
                              onClick={() => adjustOfferedItem(item.itemId, item.quantity, 1)}
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 border border-dashed border-border/30 rounded text-[9.5px] text-muted-foreground">
                      No unplaced items available in base storage.
                    </div>
                  )}
                </div>
              </div>

              {/* Counter-Demands Side */}
              <div className="border border-border/40 bg-background/10 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-500 border-b border-border/30 pb-1.5">
                  <TrendingUp className="size-4 rotate-180" />
                  Your Demands (What You Receive)
                </div>

                {/* Demand Currencies inputs */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 border border-border/50 bg-background/30 rounded p-1">
                    <Wrench className="size-4 text-amber-500 shrink-0 ml-1" />
                    <Input
                      type="number"
                      placeholder="Demand Scrap"
                      value={demandScrap || ""}
                      onChange={(e) => setDemandScrap(Math.max(0, Number(e.target.value)))}
                      className="h-6 text-xs bg-transparent border-0 p-0 focus-visible:ring-0"
                    />
                  </div>

                  <div className="flex items-center gap-2 border border-border/50 bg-background/30 rounded p-1">
                    <Cpu className="size-4 text-cyan-400 shrink-0 ml-1" />
                    <Input
                      type="number"
                      placeholder="Demand Components"
                      value={demandComponents || ""}
                      onChange={(e) => setDemandComponents(Math.max(0, Number(e.target.value)))}
                      className="h-6 text-xs bg-transparent border-0 p-0 focus-visible:ring-0"
                    />
                  </div>

                  <div className="flex items-center gap-2 border border-border/50 bg-background/30 rounded p-1">
                    <Coins className="size-4 text-emerald-400 shrink-0 ml-1" />
                    <Input
                      type="number"
                      placeholder="Demand Credits"
                      value={demandCredits || ""}
                      onChange={(e) => setDemandCredits(Math.max(0, Number(e.target.value)))}
                      className="h-6 text-xs bg-transparent border-0 p-0 focus-visible:ring-0"
                    />
                  </div>
                </div>

                {/* Demanded Item Selector */}
                <div className="space-y-2 pt-1 border-t border-border/30">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Demand Blueprint Blueprints
                  </label>
                  
                  <div className="flex gap-1">
                    <select
                      value={selectedDemandItemId}
                      onChange={(e) => setSelectedDemandItemId(e.target.value)}
                      className="flex-1 h-7 text-xs bg-background/60 border border-border/60 rounded px-1 text-foreground focus:outline-none"
                    >
                      <option value="">-- Choose item --</option>
                      {catalogItems.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                    
                    <Input
                      type="number"
                      min="1"
                      value={selectedDemandQty}
                      onChange={(e) => setSelectedDemandQty(Math.max(1, Number(e.target.value)))}
                      className="h-7 w-12 text-xs text-center border-border/60 bg-background/50"
                    />

                    <Button 
                      type="button" 
                      onClick={addDemandedItem}
                      size="sm" 
                      className="h-7 w-7 p-0 bg-primary/70 hover:bg-primary"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>

                  {/* Added demanded list */}
                  {demandedItemsList.length > 0 ? (
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1 pt-1.5">
                      {demandedItemsList.map(item => {
                        const base = catalogItems.find(c => c.id === item.itemId);
                        return (
                          <div key={item.itemId} className="flex justify-between items-center bg-background/40 border border-border/30 rounded p-1 text-xs">
                            <span className="text-[10.5px]">{base?.name} <span className="text-muted-foreground font-mono text-[9px]">(x{item.quantity})</span></span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => removeDemandedItem(item.itemId)}
                              className="size-5 hover:text-red-500"
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 border border-dashed border-border/30 rounded text-[9.5px] text-muted-foreground">
                      No item demands currently declared.
                    </div>
                  )}
                </div>
              </div>

            </div>

            <Button
              onClick={handleProposeTrade}
              disabled={loading || !targetPlayerId}
              className="w-full text-xs font-bold h-9 gap-1.5 shadow-xl bg-gradient-to-r from-cyan-600 via-primary to-emerald-600 hover:opacity-90 transition-opacity"
            >
              <Sparkles className="size-4 animate-spin-slow" />
              Propose Escrow Exchange Agreement
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
            <Package className="size-3.5 text-muted-foreground" /> Historic Log Archives
          </h3>
          {historyTrades.length > 0 ? (
            historyTrades.map(trade => (
              <TradeCard
                key={trade.id}
                trade={trade}
                role={trade.sender_id === currentUserId ? "sender" : "receiver"}
                loading={loading}
              />
            ))
          ) : (
            <div className="text-center py-12 border border-border/20 bg-background/10 rounded-xl text-muted-foreground text-xs">
              Trade log archives are currently empty.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inner helper card for trade listing
function TradeCard({ trade, role, onAccept, onDecline, onWithdraw, loading }: {
  trade: any;
  role: "sender" | "receiver";
  onAccept?: () => void;
  onDecline?: () => void;
  onWithdraw?: () => void;
  loading: boolean;
}) {
  const isSender = role === "sender";
  
  const statusStyles: any = {
    pending: "border-amber-500/30 bg-amber-500/5 text-amber-500",
    accepted: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
    withdrawn: "border-muted/50 bg-muted/5 text-muted-foreground",
    declined: "border-red-500/30 bg-red-500/5 text-red-500"
  };

  const partnerText = isSender 
    ? `Proposed to: ${trade.receiver?.username || "Survivor"} (Lvl ${trade.receiver?.player_level})`
    : `Proposed by: ${trade.sender?.username || "Survivor"} (Lvl ${trade.sender?.player_level})`;

  return (
    <Card className="border-border/60 bg-card/30 backdrop-blur rounded-xl overflow-hidden shadow-inner">
      <div className="border-b border-border/40 bg-muted/10 p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div>
          <span className="text-[10px] text-muted-foreground block font-mono">Barter ID: {trade.id.substring(0, 8)}</span>
          <span className="text-xs font-bold text-foreground">{partnerText}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className={`text-[9.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${statusStyles[trade.status]}`}>
            {trade.status}
          </span>
          <span className="text-[9px] text-muted-foreground font-semibold">
            {new Date(trade.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          
          {/* Offer side */}
          <div className="space-y-2 border-r border-border/20 pr-4">
            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
              <TrendingUp className="size-3.5" /> Offered Assets (From Sender)
            </span>
            <div className="space-y-1">
              {/* Materials */}
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-muted-foreground">
                {trade.offer_scrap > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                    <Wrench className="size-3" /> Scrap: {trade.offer_scrap}
                  </span>
                )}
                {trade.offer_components > 0 && (
                  <span className="flex items-center gap-0.5 text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded">
                    <Cpu className="size-3" /> Comp: {trade.offer_components}
                  </span>
                )}
                {trade.offer_credits > 0 && (
                  <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">
                    <Coins className="size-3" /> Coins: {trade.offer_credits}
                  </span>
                )}
                {trade.offer_scrap === 0 && trade.offer_components === 0 && trade.offer_credits === 0 && !trade.items.some((i: any) => i.direction === "offer") && (
                  <span className="text-muted-foreground/50">Nothing offered</span>
                )}
              </div>
              
              {/* Offered Items */}
              {trade.items.filter((i: any) => i.direction === "offer").length > 0 && (
                <div className="space-y-1 pt-1">
                  {trade.items
                    .filter((i: any) => i.direction === "offer")
                    .map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs bg-background/20 px-2 py-0.5 rounded border border-border/30 w-fit">
                        <Package className="size-3 text-emerald-500" />
                        <span>{item.name} <span className="font-mono text-[9px] text-muted-foreground font-bold">(x{item.quantity})</span></span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Demands side */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
              <TrendingUp className="size-3.5 rotate-180" /> Demanded Counter-Offer (To Sender)
            </span>
            <div className="space-y-1">
              {/* Materials */}
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-muted-foreground">
                {trade.demand_scrap > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                    <Wrench className="size-3" /> Scrap: {trade.demand_scrap}
                  </span>
                )}
                {trade.demand_components > 0 && (
                  <span className="flex items-center gap-0.5 text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded">
                    <Cpu className="size-3" /> Comp: {trade.demand_components}
                  </span>
                )}
                {trade.demand_credits > 0 && (
                  <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">
                    <Coins className="size-3" /> Coins: {trade.demand_credits}
                  </span>
                )}
                {trade.demand_scrap === 0 && trade.demand_components === 0 && trade.demand_credits === 0 && !trade.items.some((i: any) => i.direction === "demand") && (
                  <span className="text-muted-foreground/50">Free Gift / No counter-demand</span>
                )}
              </div>
              
              {/* Demanded Items */}
              {trade.items.filter((i: any) => i.direction === "demand").length > 0 && (
                <div className="space-y-1 pt-1">
                  {trade.items
                    .filter((i: any) => i.direction === "demand")
                    .map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs bg-background/20 px-2 py-0.5 rounded border border-border/30 w-fit">
                        <Package className="size-3 text-red-400" />
                        <span>{item.name} <span className="font-mono text-[9px] text-muted-foreground font-bold">(x{item.quantity})</span></span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Action Triggers */}
        {trade.status === "pending" && (
          <div className="mt-4 pt-3.5 border-t border-border/30 flex justify-end gap-2 text-xs">
            {isSender ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onWithdraw}
                disabled={loading}
                className="h-8 font-bold border-border hover:bg-muted text-muted-foreground"
              >
                Withdraw Offer
              </Button>
            ) : (
              <>
                <Button
                  onClick={onAccept}
                  disabled={loading}
                  size="sm"
                  className="h-8 font-bold bg-emerald-600 hover:bg-emerald-500 gap-1"
                >
                  <Check className="size-4" />
                  Accept Agreement
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDecline}
                  disabled={loading}
                  className="h-8 font-bold border-border/60 hover:bg-muted text-red-400 gap-1"
                >
                  <X className="size-4" />
                  Decline
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
