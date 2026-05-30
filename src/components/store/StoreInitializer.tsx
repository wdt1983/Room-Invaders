"use client";

import { useEffect } from 'react';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { useRoomStore, PlacedItem, CatalogItem, EntryPoint } from '@/lib/store/useRoomStore';

export default function StoreInitializer({
    inventory,
    gridSize,
    roomSizeTier,
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
    roomSizeTier: number;
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
    useEffect(() => {
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
        usePlayerStore.getState().applyXpAndLevel(xp, playerLevel);
        useRoomStore.getState().setRoomState(gridSize, placedItems, roomSizeTier);
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
    }, [
        inventory,
        gridSize,
        roomSizeTier,
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
    ]);

    return null; // This component renders nothing
}
