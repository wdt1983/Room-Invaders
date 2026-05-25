/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { entryTileFor, entryPointsForLevel } from "@/lib/game/entryPoints";
import type { EntryPoint } from "@/lib/store/useRoomStore";
import {
  defenseValueFor,
  slotCategoryFor,
  slotsForLevel,
  roomUpgradeCost,
  MAX_ROOM_LEVEL,
} from "@/lib/game/defense";
import { trackQuestProgress } from "@/lib/game/quests";
import * as Sentry from "@sentry/nextjs";
import { trackEvent } from "@/lib/game/analytics";


const VALID_WALLS = new Set(['north', 'south', 'east', 'west']);
const VALID_TYPES = new Set(['door', 'window', 'vent']);

function coerceEntryPoints(raw: unknown, gridSize: number): EntryPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((ep: any) =>
    ep &&
    typeof ep === 'object' &&
    VALID_WALLS.has(ep.wall) &&
    VALID_TYPES.has(ep.type) &&
    Number.isInteger(ep.position) &&
    ep.position >= 0 &&
    ep.position < gridSize,
  );
}

/**
 * Recompute every per-room defense-derived value from ground truth
 * (`player_items` joined to `items`) and persist the new
 * `rooms.defense_rating`. Returns the fresh stats so callers can pipe them
 * straight back to the client.
 *
 * Runs after every placement / removal — simple full-recompute rather than
 * incremental maintenance. N+1 is trivial at MVP room sizes (tens of
 * items) and the approach self-heals against bad state.
 */
async function recomputeDefenseState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  roomLevel: number,
): Promise<{ defenseRating: number; defenseSlotsUsed: number; defenseSlotsCap: number }> {
  const { data: placedRows } = await (supabase.from('player_items') as any)
    .select('items ( type, stats )')
    .eq('owner_id', userId)
    .eq('placed_in_room', true);

  let defenseRating = 0;
  let defenseSlotsUsed = 0;

  for (const row of placedRows ?? []) {
    const itemData = Array.isArray(row.items) ? row.items[0] : row.items;
    const type = itemData?.type as string | undefined;
    const stats = itemData?.stats;
    defenseRating += defenseValueFor(type, stats);
    if (slotCategoryFor(type) === 'defense') {
      defenseSlotsUsed += 1;
    }
  }

  await (supabase.from('rooms') as any)
    .update({ defense_rating: defenseRating })
    .eq('owner_id', userId);

  return {
    defenseRating,
    defenseSlotsUsed,
    defenseSlotsCap: slotsForLevel(roomLevel).defense,
  };
}

export async function buyAndPlaceFurniture(spriteKey: string, gridX: number, gridY: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false as const, error: 'Unauthorized' };
    }

    // Get item — need id, cost, type (2.0.6 placement rules) AND stats (2.0.8 defense rating)
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, cost, type, stats, tech_tree_node')
      .eq('sprite_key', spriteKey)
      .single();

    if (itemError || !item) {
      return { success: false as const, error: 'Item not found' };
    }

    // --- Tech Tree validation (Task 7.0.4) ---
    if ((item as any).tech_tree_node) {
      const { data: techUnlocks, error: techError } = await supabase
        .from('player_tech')
        .select('node_id')
        .eq('owner_id', user.id)
        .eq('node_id', (item as any).tech_tree_node)
        .maybeSingle();

      if (techError || !techUnlocks) {
        return { success: false as const, error: 'Research required in Squad Core to unlock this item.' };
      }
    }

    // Get room — need grid_size + entry_points for placement validation,
    // room_level for slot-cap enforcement (2.0.7)
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('grid_size, entry_points, room_level')
      .eq('owner_id', user.id)
      .single();

    if (roomError || !room) {
      return { success: false as const, error: 'Room not found' };
    }

    const gridSize = (room as any).grid_size ?? 10;
    const roomLevel = (room as any).room_level ?? 1;

    // --- Placement validation (mirror of client-side `RoomScene.isPlaceableFor`) ---

    if (!Number.isInteger(gridX) || !Number.isInteger(gridY)) {
      return { success: false as const, error: 'Invalid grid coordinates' };
    }
    if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) {
      return { success: false as const, error: 'Out of bounds' };
    }

    const entryPoints = coerceEntryPoints((room as any).entry_points, gridSize);
    const onEntryPoint = entryPoints.some((ep) => {
      const tile = entryTileFor(ep, gridSize);
      return tile !== null && tile.x === gridX && tile.y === gridY;
    });
    if (onEntryPoint) {
      return { success: false as const, error: 'Cannot place on an entry point' };
    }

    const itemType = (item as any).type as string;
    if (itemType === 'turret') {
      const max = gridSize - 1;
      const onPerimeter = gridX === 0 || gridX === max || gridY === 0 || gridY === max;
      if (!onPerimeter) {
        return { success: false as const, error: 'Turrets must be placed against a wall' };
      }
    }

    // Double-placement guard — another row already occupies this tile
    const { data: existing } = await (supabase.from('player_items') as any)
      .select('id')
      .eq('owner_id', user.id)
      .eq('placed_in_room', true)
      .contains('grid_position', { x: gridX, y: gridY })
      .limit(1);

    if (Array.isArray(existing) && existing.length > 0) {
      return { success: false as const, error: 'Tile already occupied' };
    }

    // --- Slot cap enforcement (2.0.7) ---
    // Only defense-category items (traps / turrets / barricades / guards) count
    // against the defense slot cap. Furniture cap is not yet enforced.
    let currentDefenseCount = 0;
    if (slotCategoryFor(itemType) === 'defense') {
      const { data: defenseRows } = await (supabase.from('player_items') as any)
        .select('items!inner ( type )')
        .eq('owner_id', user.id)
        .eq('placed_in_room', true)
        .in('items.type', ['trap', 'turret', 'barricade', 'guard']);

      currentDefenseCount = Array.isArray(defenseRows) ? defenseRows.length : 0;
      const cap = slotsForLevel(roomLevel).defense;
      if (currentDefenseCount + 1 > cap) {
        return { success: false as const, error: `Defense slots full (${cap} max at room level ${roomLevel})` };
      }
    }

    const isFirstDefense = slotCategoryFor(itemType) === 'defense' && currentDefenseCount === 0;

    // --- Economy: scrap check + deduct ---

    const { data: inventory, error: invError } = await supabase
      .from('inventories')
      .select('scrap')
      .eq('owner_id', user.id)
      .single();

    if (invError || !inventory) {
      return { success: false as const, error: 'Inventory not found' };
    }

    const scrapCost = (((item as any).cost as any)?.scrap as number) || 0;

    if ((inventory as any).scrap < scrapCost) {
      return { success: false as const, error: 'Not enough scrap' };
    }

    const newScrap = (inventory as any).scrap - scrapCost;

    const { error: updateError } = await (supabase.from('inventories') as any)
      .update({ scrap: newScrap })
      .eq('owner_id', user.id);

    if (updateError) {
      console.error('Failed to deduct scrap:', updateError);
      return { success: false as const, error: 'Failed to deduct resources' };
    }

    const { error: insertError } = await (supabase.from('player_items') as any)
      .insert({
        owner_id: user.id,
        item_id: (item as any).id,
        placed_in_room: true,
        grid_position: { x: gridX, y: gridY },
      });

    if (insertError) {
      console.error('Failed to place item in DB:', insertError);
      return { success: false as const, error: 'Failed to place item' };
    }

    // Track first defense placement event cleanly
    if (isFirstDefense) {
      trackEvent("first_defense_placed", {
        userId: user.id,
        item_id: (item as any).id,
        spriteKey,
        itemType,
      });
    }

    // Recompute defense_rating + slot usage after insert, persist, and return fresh stats
    const defenseState = await recomputeDefenseState(supabase, user.id, roomLevel);

    // Track quest progress for placing items
    if (itemType === 'furniture') {
      await trackQuestProgress(supabase, user.id, 'place_furniture', 1);
    } else if (['trap', 'turret', 'barricade', 'guard'].includes(itemType)) {
      await trackQuestProgress(supabase, user.id, 'place_defense', 1);
    }

    // Track quest progress for reaching defense rating
    if (defenseState.defenseRating >= 50) {
      await trackQuestProgress(supabase, user.id, 'reach_defense_rating', defenseState.defenseRating, true);
    }

    return { success: true as const, newScrap, ...defenseState };
  } catch (err: any) {
    console.error("[buyAndPlaceFurniture] Exception caught:", err);
    Sentry.captureException(err, {
      tags: { action: "buyAndPlaceFurniture", spriteKey },
      extra: { gridX, gridY },
    });
    return { success: false as const, error: err.message || 'An unexpected error occurred placing item.' };
  }
}

export async function removePlacedItem(gridX: number, gridY: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false as const, error: 'Unauthorized' };
    }

    const { data: placed, error: findError } = await (supabase.from('player_items') as any)
      .select('id, item_id, items ( cost )')
      .eq('owner_id', user.id)
      .eq('placed_in_room', true)
      .contains('grid_position', { x: gridX, y: gridY })
      .limit(1)
      .single();

    if (findError || !placed) {
      return { success: false as const, error: 'Placed item not found' };
    }

    const itemData = Array.isArray(placed.items) ? placed.items[0] : placed.items;
    const scrapCost = (itemData?.cost?.scrap as number) || 0;
    const refund = Math.floor(scrapCost * 0.5);

    const { error: deleteError } = await (supabase.from('player_items') as any)
      .delete()
      .eq('id', placed.id)
      .eq('owner_id', user.id);

    if (deleteError) {
      console.error('Failed to delete placed item:', deleteError);
      return { success: false as const, error: 'Failed to remove item' };
    }

    // Fetch room_level once so the downstream recompute can report fresh caps
    const { data: room } = await (supabase.from('rooms') as any)
      .select('room_level')
      .eq('owner_id', user.id)
      .single();
    const roomLevel = (room as any)?.room_level ?? 1;

    let newScrap: number | null = null;
    if (refund > 0) {
      const { data: inv } = await (supabase.from('inventories') as any)
        .select('scrap')
        .eq('owner_id', user.id)
        .single();

      const updatedScrap = (inv?.scrap ?? 0) + refund;

      const { error: updateError } = await (supabase.from('inventories') as any)
        .update({ scrap: updatedScrap })
        .eq('owner_id', user.id);

      if (!updateError) {
        newScrap = updatedScrap;
      } else {
        console.error('Failed to credit refund:', updateError);
      }
    }

    // Recompute defense_rating + slot usage after delete, persist, return fresh stats
    const defenseState = await recomputeDefenseState(supabase, user.id, roomLevel);

    return {
      success: true as const,
      refund: newScrap === null ? 0 : refund,
      newScrap,
      ...defenseState,
    };
  } catch (err: any) {
    console.error("[removePlacedItem] Exception caught:", err);
    Sentry.captureException(err, {
      tags: { action: "removePlacedItem" },
      extra: { gridX, gridY },
    });
    return { success: false as const, error: err.message || 'An unexpected error occurred removing item.' };
  }
}

export async function rotatePlacedItem(gridX: number, gridY: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false as const, error: 'Unauthorized' };
    }

    const { data: placed, error: findError } = await (supabase.from('player_items') as any)
      .select('id, rotation')
      .eq('owner_id', user.id)
      .eq('placed_in_room', true)
      .contains('grid_position', { x: gridX, y: gridY })
      .limit(1)
      .single();

    if (findError || !placed) {
      return { success: false as const, error: 'Placed item not found' };
    }

    const current = Number.isInteger(placed.rotation) ? placed.rotation : 0;
    const nextRotation = (current + 1) % 4;

    const { error: updateError } = await (supabase.from('player_items') as any)
      .update({ rotation: nextRotation })
      .eq('id', placed.id)
      .eq('owner_id', user.id);

    if (updateError) {
      console.error('Failed to rotate placed item:', updateError);
      return { success: false as const, error: 'Failed to rotate item' };
    }

    return { success: true as const, rotation: nextRotation };
  } catch (err: any) {
    console.error("[rotatePlacedItem] Exception caught:", err);
    Sentry.captureException(err, {
      tags: { action: "rotatePlacedItem" },
      extra: { gridX, gridY },
    });
    return { success: false as const, error: err.message || 'An unexpected error occurred rotating item.' };
  }
}

export async function syncInventoryState(payload: { scrap: number, components: number, credits: number, intel: number, contraband: number }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: 'Unauthorized' };
  }

  const { error } = await (supabase.from('inventories') as any).update({
    scrap: payload.scrap,
    components: payload.components,
    credits: payload.credits,
    intel: payload.intel,
    contraband: payload.contraband,
    updated_at: new Date().toISOString()
  }).eq('owner_id', user.id);

  if (error) {
    console.error('Failed to sync inventory:', error);
    return { success: false as const, error: 'Sync failed' };
  }

  return { success: true };
}

export async function upgradePlayerLevel(currentLevel: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: 'Unauthorized' };
  }

  const cost = currentLevel * currentLevel * 50 + currentLevel * 450;

  // fetch inventory
  const { data: inventory } = await (supabase.from('inventories') as any)
    .select('scrap')
    .eq('owner_id', user.id)
    .single();

  if (!inventory || (inventory as any).scrap < cost) {
    return { success: false as const, error: 'Insufficient scrap' };
  }

  const newScrap = (inventory as any).scrap - cost;
  const newLevel = currentLevel + 1;

  const { error: invError } = await (supabase.from('inventories') as any)
    .update({ scrap: newScrap })
    .eq('owner_id', user.id);

  if (invError) return { success: false as const, error: 'Failed to update scrap' };

  const { error: profError } = await (supabase.from('profiles') as any)
    .update({ player_level: newLevel })
    .eq('id', user.id);

  if (profError) {
    return { success: false as const, error: 'Failed to upgrade level' };
  }

  // Track quest progress for player level-up
  await trackQuestProgress(supabase, user.id, 'upgrade_level', 1);

  return { success: true as const, newLevel, newScrap };
}

export async function upgradeRoomLevel(currentRoomLevel: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false as const, error: 'Unauthorized' };
    }

    if (currentRoomLevel >= MAX_ROOM_LEVEL) {
      return { success: false as const, error: 'Already at maximum room level' };
    }

    const { scrap: scrapCost, components: componentsCost } = roomUpgradeCost(currentRoomLevel);

    // fetch inventory
    const { data: inventory, error: invError } = await (supabase.from('inventories') as any)
      .select('scrap, components')
      .eq('owner_id', user.id)
      .single();

    if (invError || !inventory) {
      return { success: false as const, error: 'Inventory not found' };
    }

    if (inventory.scrap < scrapCost || inventory.components < componentsCost) {
      return { success: false as const, error: 'Insufficient resources' };
    }

    const newScrap = inventory.scrap - scrapCost;
    const newComponents = inventory.components - componentsCost;
    const newRoomLevel = currentRoomLevel + 1;

    const caps = slotsForLevel(newRoomLevel);
    const newGridSize = caps.grid;
    const newEntryPoints = entryPointsForLevel(newRoomLevel, newGridSize);
    const newStorageCapacity = newRoomLevel * 500;

    // Deduct cost and update storage capacity
    const { error: invUpdateError } = await (supabase.from('inventories') as any)
      .update({ 
        scrap: newScrap, 
        components: newComponents,
        storage_capacity: newStorageCapacity,
        updated_at: new Date().toISOString()
      })
      .eq('owner_id', user.id);

    if (invUpdateError) {
      console.error('Failed to update inventory:', invUpdateError);
      return { success: false as const, error: 'Failed to update resources' };
    }

    // Update room level, grid size, and entry points in rooms table
    const { error: roomUpdateError } = await (supabase.from('rooms') as any)
      .update({
        room_level: newRoomLevel,
        grid_size: newGridSize,
        entry_points: newEntryPoints,
        updated_at: new Date().toISOString()
      })
      .eq('owner_id', user.id);

    if (roomUpdateError) {
      console.error('Failed to update room:', roomUpdateError);
      return { success: false as const, error: 'Failed to upgrade room level' };
    }

    // Recompute defense stats for the new room level
    const defenseState = await recomputeDefenseState(supabase, user.id, newRoomLevel);

    // Track quest progress for spending resources
    await trackQuestProgress(supabase, user.id, 'spend_resources', scrapCost + componentsCost);

    return {
      success: true as const,
      newRoomLevel,
      newGridSize,
      newEntryPoints,
      newScrap,
      newComponents,
      newStorageCapacity,
      newDefenseSlotsCap: caps.defense,
      ...defenseState,
    };
  } catch (err: any) {
    console.error("[upgradeRoomLevel] Exception caught:", err);
    Sentry.captureException(err, {
      tags: { action: "upgradeRoomLevel" },
      extra: { currentRoomLevel },
    });
    return { success: false as const, error: err.message || 'An unexpected error occurred upgrading room level.' };
  }
}

export async function saveRoomCosmetics(cosmetics: { wallColor: number; floorType: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: 'Unauthorized' };
  }

  const { error } = await (supabase.from('rooms') as any)
    .update({ cosmetics })
    .eq('owner_id', user.id);

  if (error) {
    console.error('Failed to save cosmetics:', error);
    return { success: false as const, error: 'Failed to save cosmetics' };
  }

  return { success: true as const };
}
