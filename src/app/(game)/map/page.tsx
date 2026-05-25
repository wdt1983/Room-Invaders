/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Map, ScanEye, User, ShieldAlert } from 'lucide-react';

import { MapDashboard } from './MapDashboard';

export const metadata = {
  title: "Room Invaders - Recon Map",
};

export default async function MapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch player's own profile for central base rendering
  const { data: ownProfile } = await (supabase.from("profiles") as any)
    .select("id, username, player_level")
    .eq("id", user.id)
    .maybeSingle();

  const playerProfile = {
    id: user.id,
    username: ownProfile?.username || "You",
    player_level: ownProfile?.player_level || 1
  };

  // Fetch accepted friends in a highly robust two-step lookup
  const { data: friendshipRows } = await (supabase.from("friendships") as any)
    .select("sender_id, receiver_id, status")
    .eq("status", "accepted")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  let friends: any[] = [];
  if (friendshipRows && friendshipRows.length > 0) {
    const friendIds = friendshipRows.map((r: any) => 
      r.sender_id === user.id ? r.receiver_id : r.sender_id
    );
    
    const { data: friendProfiles } = await (supabase.from("profiles") as any)
      .select("id, username, player_level")
      .in("id", friendIds);
      
    friends = friendProfiles || [];
  }

  // Fetch session access token to authorize the matchmaking edge function invoke
  const session = (await supabase.auth.getSession()).data.session;
  const authHeader = session ? `Bearer ${session.access_token}` : undefined;

  let targets = [];
  let bracketRange = "±1";
  let fallbackActive = false;

  // Authoritatively invoke matchmaking Edge Function
  const { data: matchData, error: matchError } = await supabase.functions.invoke("matchmaking", {
    body: {},
    headers: authHeader ? { Authorization: authHeader } : undefined,
  });

  if (!matchError && matchData && matchData.success) {
    targets = matchData.targets || [];
    bracketRange = matchData.bracketRange || "±1";
  } else {
    console.warn("[MapPage] Matchmaking Edge Function offline, using database fallback:", matchError || matchData?.error);
    fallbackActive = true;

    // Graceful Degradation Fallback: Select profiles directly if the Deno function isn't deployed
    const { data: fbTargets } = await (supabase.from('profiles') as any)
      .select(`
          id,
          username,
          player_level,
          rooms ( grid_size, room_level, defense_rating )
      `)
      .neq('id', user.id)
      .limit(10);

    targets = (fbTargets || []).map((t: any) => {
      const room = Array.isArray(t.rooms) ? t.rooms[0] : t.rooms;
      return {
        id: t.id,
        username: t.username || "Survivor",
        player_level: t.player_level || 1,
        room_level: room?.room_level || 1,
        grid_size: room?.grid_size || 10,
        defense_rating: room?.defense_rating || 0,
        scrap_overflow: 0,
        components_overflow: 0,
      };
    });
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl h-full overflow-y-auto pb-20">
      {/* Header with Search Status Indicators */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-2 text-primary">
            <Map className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Global Recon Map</h1>
            <p className="text-xs text-muted-foreground">Scout ceasefire-expired bases to raid overflow resources.</p>
          </div>
        </div>

        {/* Dynamic status badges */}
        <div className="flex gap-2">
          {fallbackActive ? (
            <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              Fallback Scanner Mode
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 animate-pulse">
              Scanner Scope: {bracketRange === "all" ? "All Levels" : `Room Lvl ${bracketRange}`}
            </span>
          )}
        </div>
      </div>

      <MapDashboard 
        targets={targets} 
        bracketRange={bracketRange} 
        fallbackActive={fallbackActive} 
        playerProfile={playerProfile}
        friends={friends}
      />
    </div>
  );
}
