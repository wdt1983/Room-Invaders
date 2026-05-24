import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PlayerStoreInitializer from "@/components/store/PlayerStoreInitializer";

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

  // Authoritatively fetch core player resources & safe mode settings for all routes
  const { data: inventory, error: invError } = await supabase
    .from('inventories')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  const { data: profile, error: profError } = await (supabase.from('profiles') as any)
    .select('player_level, xp, safe_mode_until')
    .eq('id', user.id)
    .single();

  if (invError || profError) {
    console.error("[GameLayout] Core state fetch errors:", { invError, profError });
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
    player_level: 1,
    xp: 0,
    safe_mode_until: null,
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <PlayerStoreInitializer
        inventory={finalInventory as any}
        playerLevel={finalProfile.player_level}
        xp={finalProfile.xp}
        safeModeUntil={finalProfile.safe_mode_until}
      />
      <TopBar />
      <main className="relative flex-1 overflow-hidden">
        {children}
      </main>
      <BottomNav />
      {/* Global toast surface for every server-action outcome — placement /
          removal / rotation / level-up success+failure are all funneled
          through here so the player gets explicit feedback instead of silent
          console errors. See GameBridge + TopBar upgrade handler. */}
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
