/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Map, ScanEye, User, ShieldAlert } from 'lucide-react';

export const metadata = {
  title: "Room Invaders - Recon Map",
};

export default async function MapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {targets && targets.length > 0 ? (
          targets.map((target: any) => {
            return (
              <Card key={target.id} className="border-primary/20 bg-card/40 backdrop-blur shadow-xl hover:border-primary/40 hover:bg-card/50 transition-all duration-300">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {target.username || 'Unknown Target'}
                    </CardTitle>
                    <div className="bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold">
                      Lv. {target.player_level || 1}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stronghold Level:</span>
                    <span className="font-bold text-foreground">Lvl {target.room_level || 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grid Dimensions:</span>
                    <span className="font-mono text-foreground">{target.grid_size}x{target.grid_size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Defense Rating:</span>
                    <span className="font-mono font-bold text-cyan-400">{target.defense_rating || 0}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 border-t border-border/50">
                  {/* Scout → raid. `/raid/[id]` resolves dynamically */}
                  <Link href={`/raid/${target.id}`} className="w-full">
                    <Button variant="default" className="w-full gap-2 text-xs font-bold h-8">
                      <ScanEye className="w-3.5 h-3.5" />
                      Scout Base
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            )
          })
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-muted-foreground bg-card/30 rounded-lg border border-dashed border-border/60 shadow-inner">
            <ShieldAlert className="w-12 h-12 mb-4 opacity-50 text-cyan-400 animate-pulse" />
            <h3 className="text-lg font-medium text-foreground">No Vulnerable Targets</h3>
            <p className="text-xs text-center max-w-sm mt-2 leading-relaxed text-muted-foreground">
              Every coordinate in your room bracket has active ceasefire protocols or shields. Check back as shields expire!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
