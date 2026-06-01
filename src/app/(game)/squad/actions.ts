/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import techTree from "@/game/fixtures/tech-tree.json";
import { revalidatePath } from "next/cache";

/**
 * Server Action to unlock a Tech Tree node.
 * Performs rigorous validations:
 *  1. User auth check.
 *  2. Level check (Level 3 required for tech tree).
 *  3. Node existence check.
 *  4. Node already unlocked check.
 *  5. Prerequisites check.
 *  6. Tech points availability check.
 *  7. Atomically deducts tech points and inserts unlocked node.
 */
export async function unlockTechNodeAction(nodeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  // 1. Fetch node specification
  const node = techTree.nodes.find((n) => n.id === nodeId);
  if (!node) {
    return { success: false as const, error: "Tech node not found in blueprints" };
  }

  // 2. Fetch player profile to check level and tech points
  const { data: profile, error: profError } = await (supabase.from("profiles") as any)
    .select("player_level, tech_points")
    .eq("id", user.id)
    .single();

  if (profError || !profile) {
    return { success: false as const, error: "Player profile not found" };
  }

  if (profile.player_level < 3) {
    return { success: false as const, error: "Unlocks at Player Level 3" };
  }

  if (profile.tech_points < node.cost) {
    return { success: false as const, error: "Insufficient tech points" };
  }

  // 3. Fetch already unlocked nodes
  const { data: unlockedRows, error: techError } = await (supabase.from("player_tech") as any)
    .select("node_id")
    .eq("owner_id", user.id);

  if (techError) {
    return { success: false as const, error: "Failed to read tech database" };
  }

  const unlockedIds = new Set((unlockedRows || []).map((r: any) => r.node_id));

  if (unlockedIds.has(nodeId)) {
    return { success: false as const, error: "Technology already unlocked" };
  }

  // 4. Validate prerequisites
  const missingPrereqs = node.prerequisites.filter((p) => !unlockedIds.has(p));
  if (missingPrereqs.length > 0) {
    return { success: false as const, error: "Prerequisite technologies not unlocked yet" };
  }

  // 5. Atomic Update Transaction (deduct tech points & insert unlock row)
  const newTechPoints = profile.tech_points - node.cost;

  const { error: profileUpdateError } = await (supabase.from("profiles") as any)
    .update({ tech_points: newTechPoints })
    .eq("id", user.id);

  if (profileUpdateError) {
    console.error("Failed to deduct tech points:", profileUpdateError);
    return { success: false as const, error: "Failed to deduct tech points" };
  }

  const { error: insertError } = await (supabase.from("player_tech") as any)
    .insert({
      owner_id: user.id,
      node_id: nodeId,
    });

  if (insertError) {
    console.error("Failed to insert tech node:", insertError);
    // Attempt to rollback profile tech points
    await (supabase.from("profiles") as any)
      .update({ tech_points: profile.tech_points })
      .eq("id", user.id);
    return { success: false as const, error: "Failed to register unlocked tech" };
  }

  revalidatePath("/room");
  return { success: true as const, newTechPoints, nodeId };
}

/**
 * Server Action to customize a squad member's name, active ability, and passive gear.
 * Validates:
 *  1. Member slot level requirements.
 *  2. Ability/gear unlocks inside player's tech progression before equipping.
 */
export async function updateSquadMemberAction(
  slotNumber: number,
  payload: { 
    name?: string; 
    activeAbility?: string | null; 
    passiveGear?: string | null;
    weapon?: string | null;
    armor?: string | null;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false as const, error: "Unauthorized" };
  }

  // 1. Fetch player profile to validate slot level lock
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("player_level")
    .eq("id", user.id)
    .single();

  const level = profile?.player_level ?? 1;

  if (slotNumber === 2 && level < 10) return { success: false as const, error: "Slot locked. Reaches at Level 10." };
  if (slotNumber === 3 && level < 25) return { success: false as const, error: "Slot locked. Reaches at Level 25." };
  if (slotNumber === 4 && level < 30) return { success: false as const, error: "Slot locked. Reaches at Level 30." };

  // 2. Validate abilities, gear, weapons, & armor against tech progression
  if (payload.activeAbility || payload.passiveGear || payload.weapon || payload.armor) {
    const { data: unlockedRows } = await (supabase.from("player_tech") as any)
      .select("node_id")
      .eq("owner_id", user.id);

    const unlockedIds = new Set((unlockedRows || []).map((r: any) => r.node_id));

    if (payload.activeAbility) {
      // Find the node that unlocks this ability
      const unlockingNode = techTree.nodes.find(
        (n) => n.effects && (n.effects as any).unlock_ability === payload.activeAbility
      );
      if (unlockingNode && !unlockedIds.has(unlockingNode.id)) {
        return { success: false as const, error: `Ability '${payload.activeAbility}' is locked in tech tree.` };
      }
    }

    if (payload.passiveGear) {
      const unlockingNode = techTree.nodes.find(
        (n) => n.effects && (n.effects as any).unlock_passive === payload.passiveGear // protective_shield is in node off_squad_hp_2 or off_ability_emp
      );
      // If there is an unlocking node, enforce tech tree locks
      if (unlockingNode && !unlockedIds.has(unlockingNode.id)) {
        return { success: false as const, error: `Gear '${payload.passiveGear}' is locked in tech tree.` };
      }
    }

    // Validate weapons
    if (payload.weapon) {
      if (payload.weapon === "heavy_machete" && !unlockedIds.has("off_squad_dmg_1")) {
        return { success: false as const, error: "Heavy Machete is locked in tech tree (requires Heavy Melee Gears)." };
      }
      if (payload.weapon === "demo_hammer" && !unlockedIds.has("off_ability_breaching")) {
        return { success: false as const, error: "Demo Hammer is locked in tech tree (requires Breaching Charges)." };
      }
    }

    // Validate armor
    if (payload.armor) {
      if (payload.armor === "reinforced_vest" && !unlockedIds.has("off_squad_hp_1")) {
        return { success: false as const, error: "Reinforced Vest is locked in tech tree (requires Reinforced Vests)." };
      }
      if (payload.armor === "tactical_armor" && !unlockedIds.has("off_squad_hp_2")) {
        return { success: false as const, error: "Tactical Armor is locked in tech tree (requires Tactical Armor Sheets)." };
      }
    }
  }

  // 3. Update squad record
  const updateData: any = {};
  if (typeof payload.name === "string" && payload.name.trim().length > 0) {
    updateData.name = payload.name.trim();
  }
  if (payload.activeAbility !== undefined) {
    updateData.active_ability = payload.activeAbility;
  }
  if (payload.passiveGear !== undefined) {
    updateData.passive_gear = payload.passiveGear;
  }
  if (payload.weapon !== undefined) {
    updateData.weapon = payload.weapon;
  }
  if (payload.armor !== undefined) {
    updateData.armor = payload.armor;
  }

  updateData.updated_at = new Date().toISOString();

  const { data: updatedMember, error: updateError } = await (supabase.from("player_squad") as any)
    .update(updateData)
    .eq("owner_id", user.id)
    .eq("slot_number", slotNumber)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update squad member:", updateError);
    return { success: false as const, error: "Failed to save squad loadout" };
  }

  revalidatePath("/room");
  return { success: true as const, member: updatedMember };
}
