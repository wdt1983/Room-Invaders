import { create } from 'zustand';

export interface CatalogItem {
  id: string;
  name: string;
  type: string;
  sprite_key: string;
  unlock_level: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cost: any;
  /** JSONB column from `items.stats`. Shape varies by type — `range`,
   *  `damage`, `alert_radius`, `hp`, etc. See seed.sql for the canonical set. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stats: Record<string, any> | null;
}

export interface PlacedItem {
  id: string;
  spriteKey: string;
  gridX: number;
  gridY: number;
  footprintW: number;
  footprintH: number;
  /** Discrete 90° rotation step: 0=0°, 1=90°, 2=180°, 3=270°. */
  rotation: number;
}

export type EntryPointWall = 'north' | 'south' | 'east' | 'west';
export type EntryPointType = 'door' | 'window' | 'vent';

export interface EntryPoint {
  wall: EntryPointWall;
  type: EntryPointType;
  position: number;
}

export interface DefenseStats {
  roomLevel: number;
  defenseRating: number;
  defenseSlotsUsed: number;
  defenseSlotsCap: number;
}

interface RoomState {
  gridSize: number;
  placedItems: PlacedItem[];
  catalog: CatalogItem[];
  entryPoints: EntryPoint[];
  roomLevel: number;
  defenseRating: number;
  defenseSlotsUsed: number;
  defenseSlotsCap: number;
  setRoomState: (gridSize: number, placedItems: PlacedItem[]) => void;
  setCatalog: (catalog: CatalogItem[]) => void;
  setEntryPoints: (entryPoints: EntryPoint[]) => void;
  setDefenseStats: (stats: Partial<DefenseStats>) => void;
  removePlacedItemAt: (gridX: number, gridY: number) => void;
  rotatePlacedItemAt: (gridX: number, gridY: number, rotation: number) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  gridSize: 10,
  placedItems: [],
  catalog: [],
  entryPoints: [],
  roomLevel: 1,
  defenseRating: 0,
  defenseSlotsUsed: 0,
  defenseSlotsCap: 8,
  setRoomState: (gridSize, placedItems) => set({ gridSize, placedItems }),
  setCatalog: (catalog) => set({ catalog }),
  setEntryPoints: (entryPoints) => set({ entryPoints }),
  setDefenseStats: (stats) => set((state) => ({ ...state, ...stats })),
  removePlacedItemAt: (gridX, gridY) =>
    set((state) => ({
      placedItems: state.placedItems.filter(
        (p) => !(p.gridX === gridX && p.gridY === gridY),
      ),
    })),
  rotatePlacedItemAt: (gridX, gridY, rotation) =>
    set((state) => ({
      placedItems: state.placedItems.map((p) =>
        p.gridX === gridX && p.gridY === gridY ? { ...p, rotation } : p,
      ),
    })),
}));
