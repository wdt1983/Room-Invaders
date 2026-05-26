/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Target, Zap, Users, Home, Swords, Share2, Compass, Plus, MessageSquare, LogOut, Lock, Vault } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";

// Import Server Actions
import { createDistrict, joinDistrict, leaveDistrict } from "@/app/actions/district";
import { ChatConsole } from "@/components/game/ChatConsole";
import { DistrictTreasury } from "@/components/game/DistrictTreasury";
import { JointRaidLobby } from "@/components/game/JointRaidLobby";

export const metadata = {
  title: "Stronghold Districts - Room Invaders",
};

export default async function StrongholdDistrictPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch player's profile
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("id, username, player_level")
    .eq("id", user.id)
    .maybeSingle();

  const playerProfile = {
    id: user.id,
    username: profile?.username || "You",
    player_level: profile?.player_level || 1
  };

  // Check if user belongs to a district
  const { data: currentMember } = await (supabase.from("district_members") as any)
    .select("district_id, grid_x, grid_y")
    .eq("profile_id", user.id)
    .maybeSingle();

  // Revalidate form actions
  async function handleCreateDistrict(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const res = await createDistrict(name);
    if (res.success) {
      revalidatePath("/map/district");
    }
  }

  async function handleJoinDistrict(formData: FormData) {
    "use server";
    const districtId = formData.get("districtId") as string;
    const x = parseInt(formData.get("grid_x") as string, 10);
    const y = parseInt(formData.get("grid_y") as string, 10);
    const res = await joinDistrict(districtId, x, y);
    if (res.success) {
      revalidatePath("/map/district");
    }
  }

  async function handleLeaveDistrict() {
    "use server";
    const res = await leaveDistrict();
    if (res.success) {
      revalidatePath("/map/district");
    }
  }

  if (!currentMember) {
    // --- CREATE OR JOIN VIEW ---
    // Fetch all active districts with member counts
    const { data: activeDistricts } = await supabase.rpc("get_districts_with_members" as any) as any;
    
    // In case RPC isn't loaded, fallback select
    let districtsFallback = [];
    if (!activeDistricts) {
      const { data: allDistricts } = await (supabase.from("districts") as any).select(`
        id,
        name,
        created_at,
        district_members ( id )
      `);
      districtsFallback = (allDistricts || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        created_at: d.created_at,
        member_count: d.district_members?.length || 0
      }));
    }

    const districtsList = activeDistricts || districtsFallback;

    return (
      <div className="container mx-auto p-6 max-w-5xl h-full overflow-y-auto pb-20 select-none">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2 text-cyan-400">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Cooperative Districts</h1>
            <p className="text-xs text-muted-foreground">Cluster your rooms with allies, share boundary power grids, and defend adjacent entryways.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create District */}
          <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-2xl rounded-2xl flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                Establish Faction District
              </CardTitle>
              <CardDescription className="text-xs">
                Erect a new collaborative district sector. You will be seated in the central slot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={handleCreateDistrict} className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">District Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Enter district name..."
                    className="bg-black/60 border border-primary/20 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-muted-foreground/60 font-mono focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
                <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-xs font-bold h-10 rounded-xl uppercase">
                  Establish Faction
                </Button>
              </form>
            </CardContent>
            <CardFooter className="pt-0 pb-6">
              <p className="text-[10px] text-muted-foreground leading-normal italic">
                District builders automatically occupy grid slot (1, 1). Safe Mode rules and defenses propagate outwards to neighboring nodes.
              </p>
            </CardFooter>
          </Card>

          {/* Join District */}
          <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-2xl rounded-2xl flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                Scan Active Districts
              </CardTitle>
              <CardDescription className="text-xs">
                Settle coordinates in an existing alliance cluster. Max 9 rooms per district (3x3 grid).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-2">
              {districtsList.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground/60 italic uppercase">
                  No active faction districts detected.
                </div>
              ) : (
                districtsList.map((dist: any) => {
                  const slotsLeft = Math.max(0, 9 - dist.member_count);
                  return (
                    <div
                      key={dist.id}
                      className="border border-primary/10 bg-background/30 rounded-xl p-3.5 flex items-center justify-between hover:border-cyan-500/30 transition-all duration-300"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-black text-white uppercase">{dist.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase font-mono">
                          {dist.member_count} of 9 coordinates occupied
                        </span>
                      </div>

                      {slotsLeft > 0 ? (
                        <form action={handleJoinDistrict} className="flex gap-2">
                          <input type="hidden" name="districtId" value={dist.id} />
                          {/* Pick first open grid slot automatically for simplicity in MVP form */}
                          <input type="hidden" name="grid_x" value={dist.member_count % 3} />
                          <input type="hidden" name="grid_y" value={Math.floor(dist.member_count / 3) % 3} />
                          <Button size="sm" className="bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/30 text-[10px] font-bold uppercase rounded-lg px-3 py-1">
                            Settle Grid
                          </Button>
                        </form>
                      ) : (
                        <span className="text-[9px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          District Full
                        </span>
                      )}
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

  // --- DISTRICT ACTIVE VIEW ---
  // Fetch district details
  const { data: district } = await (supabase.from("districts") as any)
    .select("id, name, created_at")
    .eq("id", currentMember.district_id)
    .single();

  // Fetch all district members + joined profiles + joined rooms
  const { data: members } = await (supabase.from("district_members") as any)
    .select(`
      grid_x,
      grid_y,
      joined_at,
      profile_id,
      profiles ( username, player_level ),
      rooms ( room_level, defense_rating, shield_until )
    `)
    .eq("district_id", currentMember.district_id);

  const districtMembers = members || [];

  // Query all placed Defense Power Nodes within the entire district
  const memberIds = districtMembers.map((m: any) => m.profile_id);
  const { data: placedPowerNodes } = await (supabase.from("player_items") as any)
    .select("owner_id, grid_position")
    .eq("placed_in_room", true)
    .in("owner_id", memberIds)
    .eq("items.sprite_key", "turret_power_node" as any); // Filter nodes

  const activeNodesCount = placedPowerNodes?.length || 0;
  const rofMultiplier = 1.0 + (activeNodesCount * 0.15); // +15% ROF per active node in district

  // Map district members into a 3x3 layout
  const districtGrid = Array(3).fill(null).map(() => Array(3).fill(null));
  districtMembers.forEach((m: any) => {
    const room = Array.isArray(m.rooms) ? m.rooms[0] : m.rooms;
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    districtGrid[m.grid_y][m.grid_x] = {
      username: prof?.username || "Ally",
      level: prof?.player_level || 1,
      roomLevel: room?.room_level || 1,
      defenseRating: room?.defense_rating || 0,
      isMe: m.profile_id === user.id
    };
  });

  // ─── VAULT DATA FETCHING ───
  // 1. Fetch district vault balances
  const { data: vaultRow } = await (supabase.from("district_vaults") as any)
    .select("scrap, components, credits")
    .eq("district_id", currentMember.district_id)
    .maybeSingle();

  const vaultBalances = {
    scrap: vaultRow?.scrap ?? 0,
    components: vaultRow?.components ?? 0,
    credits: vaultRow?.credits ?? 0,
  };

  // 2. Fetch player's personal inventory balances
  const { data: invRow } = await (supabase.from("inventories") as any)
    .select("scrap, components, credits")
    .eq("owner_id", user.id)
    .maybeSingle();

  const inventoryBalances = {
    scrap: invRow?.scrap ?? 0,
    components: invRow?.components ?? 0,
    credits: invRow?.credits ?? 0,
  };

  // 3. Fetch recent vault transactions (last 15) with joined profile usernames
  const { data: txRows } = await (supabase.from("district_vault_transactions") as any)
    .select("id, type, resource, amount, created_at, profile_id, profiles ( username )")
    .eq("district_id", currentMember.district_id)
    .order("created_at", { ascending: false })
    .limit(15);

  const recentTransactions = (txRows || []).map((tx: any) => {
    const prof = Array.isArray(tx.profiles) ? tx.profiles[0] : tx.profiles;
    return {
      id: tx.id,
      type: tx.type,
      resource: tx.resource,
      amount: tx.amount,
      created_at: tx.created_at,
      username: prof?.username || "Unknown",
    };
  });

  // 4. Check if user is the leader (coordinate 1,1)
  const isLeader = currentMember.grid_x === 1 && currentMember.grid_y === 1;

  // 5. Calculate user's withdrawals in the last 24 hours for daily cap enforcement
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: scrapWithdrawn } = await (supabase.from("district_vault_transactions") as any)
    .select("amount")
    .eq("district_id", currentMember.district_id)
    .eq("profile_id", user.id)
    .eq("type", "withdrawal")
    .eq("resource", "scrap")
    .gte("created_at", twentyFourHoursAgo);

  const { data: compsWithdrawn } = await (supabase.from("district_vault_transactions") as any)
    .select("amount")
    .eq("district_id", currentMember.district_id)
    .eq("profile_id", user.id)
    .eq("type", "withdrawal")
    .eq("resource", "components")
    .gte("created_at", twentyFourHoursAgo);

  const { data: creditsWithdrawn } = await (supabase.from("district_vault_transactions") as any)
    .select("amount")
    .eq("district_id", currentMember.district_id)
    .eq("profile_id", user.id)
    .eq("type", "withdrawal")
    .eq("resource", "credits")
    .gte("created_at", twentyFourHoursAgo);

  const withdrawn24h = {
    scrap: (scrapWithdrawn || []).reduce((sum: number, r: any) => sum + r.amount, 0),
    components: (compsWithdrawn || []).reduce((sum: number, r: any) => sum + r.amount, 0),
    credits: (creditsWithdrawn || []).reduce((sum: number, r: any) => sum + r.amount, 0),
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl h-full overflow-y-auto pb-20 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2 text-cyan-400">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">District: {district.name}</h1>
            <p className="text-xs text-muted-foreground">Coordinates establish security loops across adjacent room sectors.</p>
          </div>
        </div>

        <form action={handleLeaveDistrict}>
          <Button type="submit" variant="destructive" className="bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-400 hover:text-white font-bold text-xs tracking-wider rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 uppercase">
            <LogOut className="w-4 h-4" />
            Abandon Faction
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* District Dashboard and 3x3 Visual Matrix */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-2xl rounded-2xl p-6">
            <h2 className="text-sm font-black text-white tracking-wider uppercase mb-5">Tactical District Settle Map</h2>

            {/* 3x3 Isometric Matrix Visualizer */}
            <div className="flex justify-center py-10 relative bg-black/35 rounded-2xl border border-primary/10 overflow-hidden shadow-inner">
              {/* Background HUD elements */}
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
                          {/* Pulsing indicator corner beacon */}
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
                      // Render empty grid coordinate slot
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
                {districtMembers.length} Members
              </span>
              <span className="text-[9px] text-muted-foreground uppercase leading-normal mt-0.5">
                Loot plundered proportionally upon breaches.
              </span>
            </Card>
          </div>

          {/* ─── Cooperative Joint Raids ─── */}
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
              districtId={currentMember.district_id}
              userId={user.id}
              username={playerProfile.username}
            />
          </div>

          {/* ─── Faction Shared Treasury ─── */}
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
        </div>

        {/* Global Recon Chat Panel (Desktop Sidebar) */}
        <div className="lg:col-span-1 h-full">
          <ChatConsole playerProfile={playerProfile} districtId={district.id} mode="inline" />
        </div>
      </div>
    </div>
  );
}
