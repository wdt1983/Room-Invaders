import { create } from "zustand";

export interface SquadMember {
  id: string; // database player_squad primary key uuid
  slotNumber: number; // 1 to 4
  name: string;
  activeAbility: string | null; // e.g. 'medkit', 'breaching_charge', 'emp_grenade'
  passiveGear: string | null;    // e.g. 'reinforced_vests' (Utility/Gear slot)
  weapon: string | null;         // e.g. 'heavy_machete', 'demo_hammer'
  armor: string | null;          // e.g. 'reinforced_vest', 'tactical_armor'
  selectedEntryPoint: { wall: string; type: string; position: number } | null;
}

interface SquadState {
  members: SquadMember[];
  isLocked: (slot: number, playerLevel: number) => boolean;
  setMembers: (members: SquadMember[]) => void;
  updateMember: (slot: number, data: Partial<SquadMember>) => void;
  assignEntryPoint: (slot: number, ep: SquadMember["selectedEntryPoint"]) => void;
  resetEntryPoints: () => void;
}

export const useSquadStore = create<SquadState>((set) => ({
  members: [],
  isLocked: (slot, level) => {
    if (slot === 1) return false;
    if (slot === 2) return level < 10;
    if (slot === 3) return level < 25;
    if (slot === 4) return level < 30;
    return true;
  },
  setMembers: (members) => set({ members }),
  updateMember: (slot, data) => set((state) => ({
    members: state.members.map((m) => m.slotNumber === slot ? { ...m, ...data } : m)
  })),
  assignEntryPoint: (slot, ep) => set((state) => ({
    members: state.members.map((m) => m.slotNumber === slot ? { ...m, selectedEntryPoint: ep } : m)
  })),
  resetEntryPoints: () => set((state) => ({
    members: state.members.map((m) => ({ ...m, selectedEntryPoint: null }))
  }))
}));
