import { create } from "zustand";
import { levelForXp } from "@/lib/game/progression";
import techTree from "@/game/fixtures/tech-tree.json";

export const DEFAULT_ACTIVE_EFFECTS = {
  squadHpMult: 1.0,
  squadSpeedMult: 1.0,
  squadMeleeDmgMult: 1.0,
  trapDamageMult: 1.0,
  trapUsesBonus: 0,
  trapStunBonus: 0,
  turretRangeBonus: 0,
  turretAmmoMult: 1.0,
  passiveScrapMult: 1.0,
  protectedStorageMult: 1.0,
  scoutCostMult: 1.0,
  repairCostMult: 1.0,
  raidScrapMult: 1.0,
  raidContrabandMult: 1.0,
  revealTraps: false,
  passiveComponentsGen: 0,
  unlockedAbilities: [] as string[],
  unlockedCatalogItems: [] as string[],
};

export function compileActiveEffects(unlockedTechs: string[]) {
  const effects = {
    ...DEFAULT_ACTIVE_EFFECTS,
    unlockedAbilities: [] as string[],
    unlockedCatalogItems: [] as string[],
  };

  for (const nodeId of unlockedTechs) {
    const node = techTree.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const nodeEffects = node.effects as any;
    if (!nodeEffects) continue;

    if (nodeEffects.squad_hp_mult) {
      effects.squadHpMult += (nodeEffects.squad_hp_mult - 1.0);
    }
    if (nodeEffects.squad_speed_mult) {
      effects.squadSpeedMult += (nodeEffects.squad_speed_mult - 1.0);
    }
    if (nodeEffects.squad_melee_dmg_mult) {
      effects.squadMeleeDmgMult += (nodeEffects.squad_melee_dmg_mult - 1.0);
    }
    if (nodeEffects.trap_damage_mult) {
      effects.trapDamageMult += (nodeEffects.trap_damage_mult - 1.0);
    }
    if (nodeEffects.trap_uses_bonus) {
      effects.trapUsesBonus += nodeEffects.trap_uses_bonus;
    }
    if (nodeEffects.trap_stun_bonus) {
      effects.trapStunBonus += nodeEffects.trap_stun_bonus;
    }
    if (nodeEffects.turret_range_bonus) {
      effects.turretRangeBonus += nodeEffects.turret_range_bonus;
    }
    if (nodeEffects.turret_ammo_mult) {
      effects.turretAmmoMult += (nodeEffects.turret_ammo_mult - 1.0);
    }
    if (nodeEffects.passive_scrap_mult) {
      effects.passiveScrapMult += (nodeEffects.passive_scrap_mult - 1.0);
    }
    if (nodeEffects.protected_storage_mult) {
      effects.protectedStorageMult += (nodeEffects.protected_storage_mult - 1.0);
    }
    if (nodeEffects.scout_cost_mult) {
      effects.scoutCostMult *= nodeEffects.scout_cost_mult;
    }
    if (nodeEffects.repair_cost_mult) {
      effects.repairCostMult *= nodeEffects.repair_cost_mult;
    }
    if (nodeEffects.raid_scrap_mult) {
      effects.raidScrapMult += (nodeEffects.raid_scrap_mult - 1.0);
    }
    if (nodeEffects.raid_contraband_mult) {
      effects.raidContrabandMult += (nodeEffects.raid_contraband_mult - 1.0);
    }
    if (nodeEffects.reveal_traps) {
      effects.revealTraps = true;
    }
    if (nodeEffects.passive_components_gen) {
      effects.passiveComponentsGen += nodeEffects.passive_components_gen;
    }
    if (nodeEffects.unlock_ability) {
      effects.unlockedAbilities.push(nodeEffects.unlock_ability);
    }
    if (nodeEffects.unlock_catalog_item) {
      effects.unlockedCatalogItems.push(nodeEffects.unlock_catalog_item);
    }
  }

  return effects;
}

export interface RaiderCosmetics {
  preset: string;
  gender: string;
  helmetColor: number;
  visorColor: number;
  vestColor: number;
  pantsColor: number;
  bootsColor: number;
  hairColor: number;
}

interface PlayerState {
  playerLevel: number;
  xp: number;
  maxScrap: number;
  maxComponents: number;
  scrap: number;
  components: number;
  credits: number;
  intel: number;
  contraband: number;
  storageCapacity: number;
  safeModeUntil: string | null;
  activeQuestId: string | null;
  
  // Tech Tree extensions
  techPoints: number;
  unlockedTechs: string[];
  activeEffects: ReturnType<typeof compileActiveEffects>;
  clearedBosses: string[];

  // Cosmetics
  activeBadge: string | null;
  activeBorder: string | null;
  activeRoomSkin: string | null;
  raiderCosmetics: RaiderCosmetics | null;

  addScrap: (amount: number) => void;
  setInventory: (data: Partial<PlayerState>) => void;
  setPlayerState: (data: Partial<PlayerState>) => void;
  setCosmeticsState: (data: { activeBadge: string | null; activeBorder: string | null; activeRoomSkin: string | null }) => void;
  setRaiderCosmetics: (cosmetics: RaiderCosmetics) => void;
  applyXpAndLevel: (
    xp: number,
    level?: number,
  ) => { previousLevel: number; newLevel: number; leveledUp: boolean };
  generateTick: () => void;
  hydrateTech: (techPoints: number, unlockedTechs: string[]) => void;
  unlockTechNode: (nodeId: string, cost: number) => void;
}

const maxScrapFor = (level: number) => Math.max(1, level) * 1000;
const maxComponentsFor = (level: number) => Math.max(1, level) * 250;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  playerLevel: 1,
  xp: 0,
  maxScrap: 1000,
  maxComponents: 250,
  scrap: 200,
  components: 50,
  credits: 100,
  intel: 10,
  contraband: 0,
  storageCapacity: 500,
  safeModeUntil: null,
  activeQuestId: null,
  
  // Tech defaults
  techPoints: 1,
  unlockedTechs: [],
  activeEffects: DEFAULT_ACTIVE_EFFECTS,
  clearedBosses: [],

  // Cosmetic defaults
  activeBadge: null,
  activeBorder: null,
  activeRoomSkin: null,
  raiderCosmetics: null,

  addScrap: (amount) => set((state) => ({ scrap: Math.min(state.scrap + amount, state.maxScrap) })),
  setInventory: (data) => set((state) => {
    const updated = { ...state, ...data };
    if (data.unlockedTechs) {
      updated.activeEffects = compileActiveEffects(data.unlockedTechs);
    }
    return updated;
  }),
  setPlayerState: (data) => set((state) => {
    const nextLevel = data.playerLevel ?? state.playerLevel;
    const updated = {
      ...state,
      ...data,
      maxScrap: maxScrapFor(nextLevel),
      maxComponents: maxComponentsFor(nextLevel),
    };
    if (data.unlockedTechs) {
      updated.activeEffects = compileActiveEffects(data.unlockedTechs);
    }
    return updated;
  }),
  setCosmeticsState: (data) => set(() => ({
    activeBadge: data.activeBadge,
    activeBorder: data.activeBorder,
    activeRoomSkin: data.activeRoomSkin,
  })),
  setRaiderCosmetics: (cosmetics) => set(() => ({ raiderCosmetics: cosmetics })),
  applyXpAndLevel: (xp, level) => {
    const prev = get();
    const previousLevel = prev.playerLevel;
    const serverLevel = typeof level === "number" ? level : levelForXp(xp);
    const newLevel = Math.max(previousLevel, serverLevel);
    set({
      xp,
      playerLevel: newLevel,
      maxScrap: maxScrapFor(newLevel),
      maxComponents: maxComponentsFor(newLevel),
    });
    return { previousLevel, newLevel, leveledUp: newLevel > previousLevel };
  },
  generateTick: () => set((state) => {
    // Apply economny passive modifiers
    const scrapGen = Math.round(5 * state.activeEffects.passiveScrapMult);
    const compGen = state.activeEffects.passiveComponentsGen > 0 ? 1 : 0;
    
    return {
      scrap: Math.min(state.scrap + scrapGen, state.maxScrap),
      components: Math.min(state.components + 1 + compGen, state.maxComponents)
    };
  }),
  hydrateTech: (techPoints, unlockedTechs) => set(() => ({
    techPoints,
    unlockedTechs,
    activeEffects: compileActiveEffects(unlockedTechs)
  })),
  unlockTechNode: (nodeId, cost) => set((state) => {
    const nextUnlocked = [...state.unlockedTechs, nodeId];
    return {
      techPoints: Math.max(0, state.techPoints - cost),
      unlockedTechs: nextUnlocked,
      activeEffects: compileActiveEffects(nextUnlocked)
    };
  })
}));

