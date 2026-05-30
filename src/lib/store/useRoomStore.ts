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
  tech_tree_node?: string | null;
  required_boss_clear?: string | null;
  footprint?: { w: number; h: number } | null;
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
  isDamaged?: boolean;
  customImageUrl?: string | null;
  moderationStatus?: 'pending' | 'approved' | 'rejected' | null;
  moderationError?: string | null;
  hologramSettings?: { color: string; flicker: number; scanlines: number; noise: number; boss?: string } | null;
}

export interface Cosmetics {
  wallColor: number;
  floorType: 'wood' | 'carpet' | 'tile' | 'concrete';
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
  roomSizeTier: number;
  placedItems: PlacedItem[];
  catalog: CatalogItem[];
  entryPoints: EntryPoint[];
  roomLevel: number;
  defenseRating: number;
  defenseSlotsUsed: number;
  defenseSlotsCap: number;
  cosmetics: Cosmetics;
  setRoomState: (gridSize: number, placedItems: PlacedItem[], roomSizeTier?: number) => void;
  setCatalog: (catalog: CatalogItem[]) => void;
  setEntryPoints: (entryPoints: EntryPoint[]) => void;
  setDefenseStats: (stats: Partial<DefenseStats>) => void;
  setCosmetics: (cosmetics: Partial<Cosmetics>) => void;
  removePlacedItemAt: (gridX: number, gridY: number) => void;
  rotatePlacedItemAt: (gridX: number, gridY: number, rotation: number) => void;
  repairPlacedItemAt: (gridX: number, gridY: number) => void;
  movePlacedItemAt: (oldX: number, oldY: number, newX: number, newY: number) => void;
  updateHologramSettingsAt: (gridX: number, gridY: number, settings: { color: string; flicker: number; scanlines: number; noise: number; boss?: string }) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  gridSize: 10,
  roomSizeTier: 1,
  placedItems: [],
  catalog: [],
  entryPoints: [],
  roomLevel: 1,
  defenseRating: 0,
  defenseSlotsUsed: 0,
  defenseSlotsCap: 8,
  cosmetics: {
    wallColor: 0x888888,
    floorType: 'tile',
  },
  setRoomState: (gridSize, placedItems, roomSizeTier) =>
    set((state) => ({
      gridSize,
      placedItems,
      roomSizeTier: roomSizeTier !== undefined ? roomSizeTier : state.roomSizeTier,
    })),
  setCatalog: (catalog) => set({ catalog }),
  setEntryPoints: (entryPoints) => set({ entryPoints }),
  setDefenseStats: (stats) => set((state) => ({ ...state, ...stats })),
  setCosmetics: (cosmetics) =>
    set((state) => ({
      cosmetics: { ...state.cosmetics, ...cosmetics },
    })),
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
  repairPlacedItemAt: (gridX, gridY) =>
    set((state) => ({
      placedItems: state.placedItems.map((p) =>
        p.gridX === gridX && p.gridY === gridY ? { ...p, isDamaged: false } : p,
      ),
    })),
  movePlacedItemAt: (oldX, oldY, newX, newY) =>
    set((state) => ({
      placedItems: state.placedItems.map((p) =>
        p.gridX === oldX && p.gridY === oldY ? { ...p, gridX: newX, gridY: newY } : p,
      ),
    })),
  updateHologramSettingsAt: (gridX, gridY, settings) =>
    set((state) => ({
      placedItems: state.placedItems.map((p) =>
        p.gridX === gridX && p.gridY === gridY ? { ...p, hologramSettings: settings } : p,
      ),
    })),
}));
