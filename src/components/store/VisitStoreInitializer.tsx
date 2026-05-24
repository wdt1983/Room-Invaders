"use client";

import { useRef } from 'react';
import { useRoomStore, PlacedItem, CatalogItem, EntryPoint } from '@/lib/store/useRoomStore';

interface VisitStoreInitializerProps {
  gridSize: number;
  placedItems: PlacedItem[];
  entryPoints: EntryPoint[];
  roomLevel: number;
  defenseRating: number;
  catalog: CatalogItem[];
}

export default function VisitStoreInitializer({
  gridSize,
  placedItems,
  entryPoints,
  roomLevel,
  defenseRating,
  catalog,
}: VisitStoreInitializerProps) {
  const initialized = useRef(false);

  if (!initialized.current) {
    // Hydrate useRoomStore with the friend's base details
    useRoomStore.getState().setRoomState(gridSize, placedItems);
    useRoomStore.getState().setCatalog(catalog);
    useRoomStore.getState().setEntryPoints(entryPoints);
    useRoomStore.getState().setDefenseStats({
      roomLevel,
      defenseRating,
      defenseSlotsUsed: 0,
      defenseSlotsCap: 0,
    });
    initialized.current = true;
  }

  return null;
}
