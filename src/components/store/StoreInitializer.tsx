"use client";
import { useRef } from 'react';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { useRoomStore, PlacedItem, CatalogItem, EntryPoint } from '@/lib/store/useRoomStore';

export default function StoreInitializer({
    inventory,
    gridSize,
    placedItems,
    playerLevel,
    xp,
    safeModeUntil,
    catalog,
    entryPoints,
    roomLevel,
    defenseRating,
    defenseSlotsUsed,
    defenseSlotsCap,
    cosmetics,
}: {
    inventory: {
        scrap: number;
        components: number;
        credits: number;
        intel: number;
        contraband: number;
        storage_capacity: number;
    };
    gridSize: number;
    placedItems: PlacedItem[];
    playerLevel: number;
    xp: number;
    safeModeUntil: string | null;
    catalog: CatalogItem[];
    entryPoints: EntryPoint[];
    roomLevel: number;
    defenseRating: number;
    defenseSlotsUsed: number;
    defenseSlotsCap: number;
    cosmetics?: {
        wallColor: number;
        floorType: 'wood' | 'carpet' | 'tile' | 'concrete';
    };
}) {
    const initialized = useRef(false);
    if (!initialized.current) {
        usePlayerStore.getState().setInventory({
            scrap: inventory.scrap,
            components: inventory.components,
            credits: inventory.credits,
            intel: inventory.intel,
            contraband: inventory.contraband,
            storageCapacity: inventory.storage_capacity,
            safeModeUntil,
        });
        usePlayerStore.getState().setPlayerState({ playerLevel });
        // Hydrate last-known XP total from `profiles.xp` so the TopBar
        // progress bar + RaidResolver level-up check (3.0.19) have a
        // baseline before the first post-raid resolve call.
        usePlayerStore.getState().applyXpAndLevel(xp, playerLevel);
        useRoomStore.getState().setRoomState(gridSize, placedItems);
        useRoomStore.getState().setCatalog(catalog);
        useRoomStore.getState().setEntryPoints(entryPoints);
        useRoomStore.getState().setDefenseStats({
            roomLevel,
            defenseRating,
            defenseSlotsUsed,
            defenseSlotsCap,
        });
        if (cosmetics) {
            useRoomStore.getState().setCosmetics(cosmetics);
        }
        initialized.current = true;
    }
    return null; // This component renders nothing
}
