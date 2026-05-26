/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GameWrapper } from "@/components/game/GameWrapper";
import { ItemPanel } from "@/components/game/ItemPanel";
import StoreInitializer from "@/components/store/StoreInitializer";
import { GameBridge } from "@/components/game/GameBridge";
import { TickManager } from "@/components/game/TickManager";
import { slotCategoryFor, slotsForLevel } from '@/lib/game/defense';

import { ContextMenu } from "@/components/game/ContextMenu";
import { PosterUploadDialog } from "@/components/game/PosterUploadDialog";
import { BaseDefenseMonitor } from "@/components/game/BaseDefenseMonitor";
import { seedInitialQuests, trackQuestProgress } from '@/lib/game/quests';

export const metadata = {
  title: "Room Invaders - Room",
};

export default async function RoomPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Seed onboarding quest and track view_room progress
  await seedInitialQuests(supabase, user.id);
  await trackQuestProgress(supabase, user.id, 'view_room', 1);

  const { data: inventory, error: invError } = await supabase
    .from('inventories')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();

  const { data: roomData, error: roomError } = await supabase
    .from('rooms')
    .select('grid_size, entry_points, room_level, defense_rating, cosmetics, room_size_tier')
    .eq('owner_id', user.id)
    .maybeSingle();

  const { data: placedItemsData, error: itemsError } = await supabase
    .from('player_items')
    .select(`
        id,
        grid_position,
        rotation,
        is_damaged,
        custom_image_url,
        moderation_status,
        moderation_error,
        items ( sprite_key, footprint, type )
    `)
    .eq('owner_id', user.id)
    .eq('placed_in_room', true);

  const { data: profileData } = await (supabase.from('profiles') as any)
    .select('player_level, xp, safe_mode_until')
    .eq('id', user.id)
    .maybeSingle();

  const { data: catalogData } = await (supabase.from('items') as any)
    .select('id, name, type, sprite_key, unlock_level, cost, stats, tech_tree_node')
    .order('unlock_level', { ascending: true });

  const playerLevel = profileData?.player_level ?? 1;
  const playerXp = profileData?.xp ?? 0;

  if (invError || roomError || itemsError) {
    console.error("Data Fetch Errors:", { invError, roomError, itemsError });
  }

  // Fetch player tech tree unlocks to apply passive economy tick modifiers
  const { data: techUnlocks } = await supabase
    .from('player_tech')
    .select('node_id')
    .eq('owner_id', user.id);
  const unlockedNodes = (techUnlocks || []).map((t: any) => t.node_id);
  
  const hasScrapMult = unlockedNodes.includes('util_econ_gen_1');
  const hasCompGen = unlockedNodes.includes('util_econ_passive_comp_1');
  const scrapMult = hasScrapMult ? 1.15 : 1.0;
  const compMult = hasCompGen ? 2.0 : 1.0;

  const finalInventory = inventory ? { ...(inventory as any) } : null;

  if (finalInventory) {
    const now = new Date();
    const lastUpdate = new Date(finalInventory.updated_at || now);
    const elapsedSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);

    if (elapsedSeconds > 60) {
      const cappedSeconds = Math.min(elapsedSeconds, 86400); // 24 hour cap

      // Apply Tick Rates: 5 scrap per 5s (1/s), 1 component per 5s (0.2/s) scaled by tech tree active effects
      const earnedScrap = Math.round(cappedSeconds * 1 * scrapMult);
      const earnedComponents = Math.floor(cappedSeconds * 0.2 * compMult);

      const maxScrap = playerLevel * 1000;
      const maxComponents = playerLevel * 250;

      finalInventory.scrap = Math.min(finalInventory.scrap + earnedScrap, maxScrap);
      finalInventory.components = Math.min(finalInventory.components + earnedComponents, maxComponents);
      finalInventory.updated_at = now.toISOString();

      await (supabase.from('inventories') as any).update({
        scrap: finalInventory.scrap,
        components: finalInventory.components,
        updated_at: finalInventory.updated_at
      }).eq('owner_id', user.id);
    }
  }

  // Parse placed item data
  const mappedItems = (placedItemsData || []).map((dbItem: any) => {
    // If supabase returns an array for single relationships or an object
    const itemData = Array.isArray(dbItem.items) ? dbItem.items[0] : dbItem.items;

    const storedRotation = Number.isInteger(dbItem.rotation) ? dbItem.rotation : 0;
    return {
      id: dbItem.id,
      spriteKey: itemData?.sprite_key || 'bed_basic',
      gridX: dbItem.grid_position?.x ?? 0,
      gridY: dbItem.grid_position?.y ?? 0,
      footprintW: itemData?.footprint?.w ?? 1,
      footprintH: itemData?.footprint?.h ?? 1,
      rotation: ((storedRotation % 4) + 4) % 4,
      isDamaged: !!dbItem.is_damaged,
      customImageUrl: dbItem.custom_image_url,
      moderationStatus: dbItem.moderation_status,
      moderationError: dbItem.moderation_error,
    };
  });

  // Count defense-category placed items — separate pass so the map stays pure
  // (react-compiler flags in-closure accumulator reassignment).
  const defenseSlotsUsed = (placedItemsData || []).reduce((count: number, dbItem: any) => {
    const itemData = Array.isArray(dbItem.items) ? dbItem.items[0] : dbItem.items;
    return count + (slotCategoryFor(itemData?.type) === 'defense' ? 1 : 0);
  }, 0);

  const gridSize = (roomData as any)?.grid_size ?? 10;
  const roomLevel = (roomData as any)?.room_level ?? 1;
  const roomSizeTier = (roomData as any)?.room_size_tier ?? 1;
  const defenseRating = (roomData as any)?.defense_rating ?? 0;
  const defenseSlotsCap = slotsForLevel(roomLevel).defense;
  const catalog = catalogData || [];

  const VALID_WALLS = new Set(['north', 'south', 'east', 'west']);
  const VALID_TYPES = new Set(['door', 'window', 'vent']);
  const rawEntryPoints = (roomData as any)?.entry_points ?? [];
  const entryPoints = (Array.isArray(rawEntryPoints) ? rawEntryPoints : [])
    .filter((ep: any) =>
      ep &&
      typeof ep === 'object' &&
      VALID_WALLS.has(ep.wall) &&
      VALID_TYPES.has(ep.type) &&
      Number.isInteger(ep.position) &&
      ep.position >= 0 &&
      ep.position < gridSize,
    )
    .map((ep: any) => ({ wall: ep.wall, type: ep.type, position: ep.position }));

  const rawCosmetics = (roomData as any)?.cosmetics;
  const cosmetics = {
    wallColor: typeof rawCosmetics?.wallColor === 'number' ? rawCosmetics.wallColor : 0x888888,
    floorType: (['wood', 'carpet', 'tile', 'concrete'].includes(rawCosmetics?.floorType) 
      ? rawCosmetics.floorType 
      : 'tile') as 'wood' | 'carpet' | 'tile' | 'concrete',
  };

  return (
    <div className="relative h-full w-full">
      {finalInventory && (
        <StoreInitializer
          inventory={finalInventory}
          gridSize={gridSize}
          roomSizeTier={roomSizeTier}
          placedItems={mappedItems}
          playerLevel={playerLevel}
          xp={playerXp}
          safeModeUntil={profileData?.safe_mode_until ?? null}
          catalog={catalog}
          entryPoints={entryPoints}
          roomLevel={roomLevel}
          defenseRating={defenseRating}
          defenseSlotsUsed={defenseSlotsUsed}
          defenseSlotsCap={defenseSlotsCap}
          cosmetics={cosmetics}
        />
      )}
      <GameBridge />
      <TickManager />
      <GameWrapper />
      <ItemPanel />
      <ContextMenu />
      <PosterUploadDialog />
      <BaseDefenseMonitor user={user} />
    </div>
  );
}
