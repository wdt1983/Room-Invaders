import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PlayerStoreInitializer from "@/components/store/PlayerStoreInitializer";
import { ChatConsole } from "@/components/game/ChatConsole";
import { LevelUpOverlay } from "@/components/game/LevelUpOverlay";

/**
 * Game Layout — wraps all authenticated game routes in the (game) route group.
 *
 * Structure: TopBar → scrollable main content → BottomNav + global Toaster
 *
 * Uses h-screen + overflow-hidden so the Phaser game canvas can manage
 * its own internal scrolling without the web page scrolling.
 */
export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Authoritatively fetch or auto-create the profiles row first.
  // This is critical because foreign keys in inventories, player_squad, etc. reference profiles(id).
  const profileResult = await (supabase.from('profiles') as any)
    .select('username, player_level, xp, safe_mode_until, tech_points, created_at, active_badge, active_border, active_room_skin')
    .eq('id', user.id)
    .maybeSingle();

  let profile = profileResult.data;
  const profError = profileResult.error;

  if (!profile && !profError) {
    console.warn(`[GameLayout] Missing profile row for user ${user.id} — auto-creating defaults.`);
    const username = user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.substring(0, 8)}`;
    const display_name = user.user_metadata?.username || user.email?.split('@')[0] || `Survivor`;
    const { data: createdProf, error: createProfError } = await (supabase.from('profiles') as any)
      .insert({
        id: user.id,
        username,
        display_name,
      })
      .select('username, player_level, xp, safe_mode_until, tech_points, created_at, active_badge, active_border, active_room_skin')
      .maybeSingle();

    if (createProfError) {
      console.error("[GameLayout] Failed to auto-create profile row:", JSON.stringify(createProfError));
    } else if (createdProf) {
      profile = createdProf;
    }
  }

  // 2. Fetch or auto-create inventories row
  const { data: initialInventory, error: invError } = await supabase
    .from('inventories')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();

  let inventory = initialInventory;

  if (!inventory && !invError) {
    console.warn(`[GameLayout] Missing inventory row for user ${user.id} — auto-creating defaults.`);
    const { data: createdInv, error: createInvError } = await (supabase.from('inventories') as any)
      .insert({ owner_id: user.id })
      .select('*')
      .maybeSingle();

    if (createInvError) {
      console.error("[GameLayout] Failed to auto-create inventory row:", JSON.stringify(createInvError));
    } else if (createdInv) {
      inventory = createdInv;
    }
  }

  // 3. Fetch tech tree unlocks
  const { data: techUnlocks, error: techError } = await supabase
    .from('player_tech')
    .select('node_id')
    .eq('owner_id', user.id);
  const unlockedNodes = (techUnlocks || []).map((t: any) => t.node_id);

  // 4. Fetch squad loadout
  const { data: squadRows, error: squadError } = await supabase
    .from('player_squad')
    .select('*')
    .eq('owner_id', user.id)
    .order('slot_number');

  // 5. Fetch active tutorial quest
  const { data: activeTutQuests } = await (supabase.from('player_quests') as any)
    .select('quest_id')
    .eq('player_id', user.id)
    .eq('status', 'active')
    .like('quest_id', 'tut-%');
  const activeQuestId = activeTutQuests && activeTutQuests.length > 0 ? activeTutQuests[0].quest_id : null;

  // 6. Fetch active district ID if user belongs to one
  const { data: currentMember } = await (supabase.from('district_members') as any)
    .select('district_id')
    .eq('profile_id', user.id)
    .maybeSingle();
  const districtId = currentMember?.district_id || null;

  if (invError || profError || techError || squadError) {
    console.error("[GameLayout] Core state fetch errors:", { 
      invError: invError ? JSON.stringify(invError) : null, 
      profError: profError ? JSON.stringify(profError) : null, 
      techError: techError ? JSON.stringify(techError) : null, 
      squadError: squadError ? JSON.stringify(squadError) : null 
    });
  }

  // Standard fallback to prevent empty initializations
  const finalInventory = inventory || {
    scrap: 200,
    components: 50,
    credits: 100,
    intel: 10,
    contraband: 0,
    storage_capacity: 500,
  };

  const finalProfile = profile || {
    username: "You",
    player_level: 1,
    xp: 0,
    safe_mode_until: null,
    tech_points: 1,
    created_at: new Date().toISOString(),
  };

  // If squadRows is empty, dynamically seed the database with 4 default squad members
  let squad = squadRows || [];
  if (squad.length === 0) {
    const { data: seededSquad, error: seedError } = await (supabase
      .from('player_squad') as any)
      .insert([
        { owner_id: user.id, slot_number: 1, name: 'Vanguard' },
        { owner_id: user.id, slot_number: 2, name: 'Support' },
        { owner_id: user.id, slot_number: 3, name: 'Breacher' },
        { owner_id: user.id, slot_number: 4, name: 'Recon' },
      ])
      .select();

    if (seedError) {
      console.error("[GameLayout] Failed to seed default squad slots:", JSON.stringify(seedError));
    } else if (seededSquad) {
      squad = seededSquad;
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <PlayerStoreInitializer
        inventory={finalInventory as any}
        playerLevel={finalProfile.player_level}
        xp={finalProfile.xp}
        safeModeUntil={finalProfile.safe_mode_until}
        techPoints={(finalProfile as any).tech_points ?? 1}
        unlockedTechs={unlockedNodes}
        squad={squad}
        activeQuestId={activeQuestId}
        createdAt={(finalProfile as any).created_at}
        activeBadge={(finalProfile as any).active_badge ?? null}
        activeBorder={(finalProfile as any).active_border ?? null}
        activeRoomSkin={(finalProfile as any).active_room_skin ?? null}
      />
      <TopBar />
      <main className="relative flex-1 overflow-hidden">
        {children}
      </main>
      <BottomNav />
      <ChatConsole 
        playerProfile={{ 
          id: user.id, 
          username: (finalProfile as any).username || "You", 
          player_level: finalProfile.player_level 
        }} 
        districtId={districtId} 
        mode="floating" 
      />
      <LevelUpOverlay />
      {/* Global toast surface for every server-action outcome — placement /
          removal / rotation / level-up success+failure are all funneled
          through here so the player gets explicit feedback instead of silent
          console errors. See GameBridge + TopBar upgrade handler. */}
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
