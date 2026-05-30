// supabase/functions/resolve-raid/replay/techTree.ts

export const DEFAULT_ACTIVE_EFFECTS = {
  squadHpMult: 1.0,
  squadSpeedMult: 1.0,
  squadMeleeDmgMult: 1.0,
  trapDamageMult: 1.0,
  trapUsesBonus: 0,
  trapStunBonus: 0.0,
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
};

export type ActiveEffects = typeof DEFAULT_ACTIVE_EFFECTS;

// Static mappings of node IDs to their respective adjustments
// extracted from tech-tree.json to remain completely self-contained in Deno.
const NODE_EFFECTS_MAPPING: Record<string, Partial<ActiveEffects>> = {
  // Offense
  "off_squad_hp_1": { squadHpMult: 1.15 },
  "off_squad_speed_1": { squadSpeedMult: 1.10 },
  "off_squad_dmg_1": { squadMeleeDmgMult: 1.50 },
  "off_squad_hp_2": { squadHpMult: 1.20 },

  // Defense
  "def_trap_dmg_1": { trapDamageMult: 1.20 },
  "def_trap_uses_1": { trapUsesBonus: 1 },
  "def_turret_range_1": { turretRangeBonus: 1 },
  "def_turret_ammo_1": { turretAmmoMult: 1.30 },
  "def_trap_stun_1": { trapStunBonus: 1.0 },

  // Utility
  "util_econ_gen_1": { passiveScrapMult: 1.15 },
  "util_econ_storage_1": { protectedStorageMult: 1.30 },
  "util_intel_scout_cost_1": { scoutCostMult: 0.75 },
  "util_intel_detail_1": { revealTraps: true },
  "util_econ_repair_cost_1": { repairCostMult: 0.80 },
  "util_econ_scrap_mult_1": { raidScrapMult: 1.15 },
  "util_intel_scout_cost_2": { scoutCostMult: 0.50 },
  "util_econ_storage_2": { protectedStorageMult: 1.30 },
  "util_econ_passive_comp_1": { passiveComponentsGen: 1 },
  "util_econ_contraband_mult_1": { raidContrabandMult: 1.25 }
};

/**
 * Compiles a set of active multipliers and effects from the list of unlocked tech nodes.
 */
export function compileActiveEffects(unlockedTechs: string[]): ActiveEffects {
  const effects = { ...DEFAULT_ACTIVE_EFFECTS };

  for (const nodeId of unlockedTechs) {
    const modifications = NODE_EFFECTS_MAPPING[nodeId];
    if (!modifications) continue;

    if (modifications.squadHpMult !== undefined) {
      effects.squadHpMult += (modifications.squadHpMult - 1.0);
    }
    if (modifications.squadSpeedMult !== undefined) {
      effects.squadSpeedMult += (modifications.squadSpeedMult - 1.0);
    }
    if (modifications.squadMeleeDmgMult !== undefined) {
      effects.squadMeleeDmgMult += (modifications.squadMeleeDmgMult - 1.0);
    }
    if (modifications.trapDamageMult !== undefined) {
      effects.trapDamageMult += (modifications.trapDamageMult - 1.0);
    }
    if (modifications.trapUsesBonus !== undefined) {
      effects.trapUsesBonus += modifications.trapUsesBonus;
    }
    if (modifications.trapStunBonus !== undefined) {
      effects.trapStunBonus += modifications.trapStunBonus;
    }
    if (modifications.turretRangeBonus !== undefined) {
      effects.turretRangeBonus += modifications.turretRangeBonus;
    }
    if (modifications.turretAmmoMult !== undefined) {
      effects.turretAmmoMult += (modifications.turretAmmoMult - 1.0);
    }
    if (modifications.passiveScrapMult !== undefined) {
      effects.passiveScrapMult += (modifications.passiveScrapMult - 1.0);
    }
    if (modifications.protectedStorageMult !== undefined) {
      effects.protectedStorageMult += (modifications.protectedStorageMult - 1.0);
    }
    if (modifications.scoutCostMult !== undefined) {
      effects.scoutCostMult *= modifications.scoutCostMult;
    }
    if (modifications.repairCostMult !== undefined) {
      effects.repairCostMult *= modifications.repairCostMult;
    }
    if (modifications.raidScrapMult !== undefined) {
      effects.raidScrapMult += (modifications.raidScrapMult - 1.0);
    }
    if (modifications.raidContrabandMult !== undefined) {
      effects.raidContrabandMult += (modifications.raidContrabandMult - 1.0);
    }
    if (modifications.revealTraps !== undefined) {
      effects.revealTraps = true;
    }
    if (modifications.passiveComponentsGen !== undefined) {
      effects.passiveComponentsGen += modifications.passiveComponentsGen;
    }
  }

  return effects;
}
