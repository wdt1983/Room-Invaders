import { create } from 'zustand';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  gridX?: number;
  gridY?: number;
  entityId?: string;
  spriteKey?: string;
  isDamaged?: boolean;
}

export type UIMode = 'view' | 'edit' | 'defense-view';

interface UIState {
  /**
   * Current interaction mode:
   * - `view`          — default read-only room, pathfinding click-to-move active.
   * - `edit`          — RoomEditorScene awake, ghost placement, ItemPanel shown.
   * - `defense-view`  — read-only coverage map (task 2.0.11): all placed
   *                     defenses pulse and their range/trigger zones render
   *                     simultaneously. Pathfinding disabled.
   */
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  selectedItemKey: string | null;
  setSelectedItemKey: (key: string | null) => void;
  contextMenu: ContextMenuState | null;
  openContextMenu: (payload: { x: number; y: number; spriteKey?: string; entityId?: string; gridX?: number; gridY?: number; isDamaged?: boolean }) => void;
  closeContextMenu: () => void;
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  setSfxVolume: (vol: number) => void;
  setMusicVolume: (vol: number) => void;
  setMuted: (muted: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mode: 'view',
  setMode: (mode) => set({ mode }),
  selectedItemKey: null,
  setSelectedItemKey: (key) => set({ selectedItemKey: key }),
  contextMenu: null,
  openContextMenu: (payload) => set({ contextMenu: { visible: true, ...payload } }),
  closeContextMenu: () => set({ contextMenu: null }),
  sfxVolume: 0.7,
  musicVolume: 0.5,
  isMuted: false,
  setSfxVolume: (sfxVolume) => set({ sfxVolume }),
  setMusicVolume: (musicVolume) => set({ musicVolume }),
  setMuted: (isMuted) => set({ isMuted }),
}));

