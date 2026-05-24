/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GameWrapper } from "@/components/game/GameWrapper";
import VisitStoreInitializer from "@/components/store/VisitStoreInitializer";
import { ArrowLeft, Users, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = {
  title: "Room Invaders - Visit Friend's Stronghold",
};

interface PageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function VisitFriendPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { userId } = await params;

  // Prevent self-visiting
  if (userId === user.id) {
    redirect('/room');
  }

  // 1. Verify friendship exists and is accepted
  const { data: friendshipRows } = await (supabase
    .from("friendships") as any)
    .select("sender_id, receiver_id")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq("status", "accepted");

  const isFriend = (friendshipRows || []).some(
    (row: any) => row.sender_id === userId || row.receiver_id === userId
  );

  // 2. Fetch friend's profile details
  const { data: friendProfile, error: profileErr } = await (supabase
    .from("profiles") as any)
    .select("username, player_level")
    .eq("id", userId)
    .single();

  // 3. Fetch friend's room config
  const { data: roomData, error: roomError } = await (supabase
    .from("rooms") as any)
    .select("grid_size, entry_points, room_level, defense_rating")
    .eq("owner_id", userId)
    .single();

  // Handle errors or unauthorized visitations
  if (!isFriend || profileErr || roomError || !friendProfile || !roomData) {
    console.error("Visitation checks failed:", { isFriend, profileErr, roomError });
    return (
      <div className="flex h-full w-full items-center justify-center bg-background/90 p-6 select-none">
        <div className="max-w-md w-full border border-red-500/20 bg-card/40 backdrop-blur rounded-2xl p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto rounded-full bg-red-500/10 border border-red-500/20 p-4 w-16 h-16 flex items-center justify-center text-red-500 mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground font-sans mb-2">Unauthorized Access</h2>
          <p className="text-sm text-muted-foreground mb-6">
            You must be active friends with this survivor to explore their coordinates.
          </p>
          <Link href="/social" className="w-full">
            <Button className="w-full font-bold bg-primary/80 hover:bg-primary gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Social
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 4. Fetch friend's placed items
  const { data: placedItemsData, error: itemsError } = await (supabase
    .from("player_items") as any)
    .select(`
        id,
        grid_position,
        rotation,
        items ( sprite_key, footprint, type )
    `)
    .eq("owner_id", userId)
    .eq("placed_in_room", true);

  if (itemsError) {
    console.error("Visitee items fetch error:", itemsError);
  }

  // 5. Fetch catalog for item metadata validation
  const { data: catalogData } = await (supabase
    .from("items") as any)
    .select("id, name, type, sprite_key, unlock_level, cost, stats")
    .order("unlock_level", { ascending: true });

  const gridSize = (roomData as any).grid_size ?? 10;
  const roomLevel = (roomData as any).room_level ?? 1;
  const defenseRating = (roomData as any).defense_rating ?? 0;
  const catalog = catalogData || [];

  const VALID_WALLS = new Set(["north", "south", "east", "west"]);
  const VALID_TYPES = new Set(["door", "window", "vent"]);
  const rawEntryPoints = (roomData as any).entry_points ?? [];
  const entryPoints = (Array.isArray(rawEntryPoints) ? rawEntryPoints : [])
    .filter((ep: any) =>
      ep &&
      typeof ep === "object" &&
      VALID_WALLS.has(ep.wall) &&
      VALID_TYPES.has(ep.type) &&
      Number.isInteger(ep.position) &&
      ep.position >= 0 &&
      ep.position < gridSize
    )
    .map((ep: any) => ({ wall: ep.wall, type: ep.type, position: ep.position }));

  // Map and filter placed items to completely filter out traps and turrets
  const mappedItems = (placedItemsData || [])
    .filter((dbItem: any) => {
      const itemData = Array.isArray(dbItem.items) ? dbItem.items[0] : dbItem.items;
      return itemData?.type !== "trap" && itemData?.type !== "turret";
    })
    .map((dbItem: any) => {
      const itemData = Array.isArray(dbItem.items) ? dbItem.items[0] : dbItem.items;
      const storedRotation = Number.isInteger(dbItem.rotation) ? dbItem.rotation : 0;
      return {
        id: dbItem.id,
        spriteKey: itemData?.sprite_key || "bed_basic",
        gridX: dbItem.grid_position?.x ?? 0,
        gridY: dbItem.grid_position?.y ?? 0,
        footprintW: itemData?.footprint?.w ?? 1,
        footprintH: itemData?.footprint?.h ?? 1,
        rotation: ((storedRotation % 4) + 4) % 4,
      };
    });

  return (
    <div className="relative h-full w-full select-none">
      {/* Floating Premium Visiting Header Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-primary/20 bg-background/50 backdrop-blur-md px-5 py-4 rounded-xl shadow-lg animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 text-primary">
            <Users className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-foreground font-sans">
              Visitee: <span className="text-cyan-400">{friendProfile.username}</span>
            </h2>
            <p className="text-[10px] text-muted-foreground font-medium">
              Stronghold Tier {roomLevel} • Defense Rating: {defenseRating}
            </p>
          </div>
        </div>

        <Link href="/social">
          <Button size="sm" variant="outline" className="h-8 text-[11px] font-extrabold gap-1.5 border-cyan-500/20 hover:border-cyan-500/40 bg-background/40 hover:bg-background/80 text-cyan-400">
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Social
          </Button>
        </Link>
      </div>

      {/* Initialize state for Phaser */}
      <VisitStoreInitializer
        gridSize={gridSize}
        placedItems={mappedItems}
        entryPoints={entryPoints}
        roomLevel={roomLevel}
        defenseRating={defenseRating}
        catalog={catalog}
      />

      {/* Render Phaser Canvas */}
      <GameWrapper />
    </div>
  );
}
