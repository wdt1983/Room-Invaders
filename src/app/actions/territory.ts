/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface TerritoryNode {
  id: string;
  q: number;
  r: number;
  name: string;
  resourceType: 'refinery' | 'vault' | 'intel_dish' | 'power_station';
  controllingDistrictId: string | null;
  controllingDistrictName: string | null;
  influencePoints: number;
  isLocked: boolean;
  lockedUntil: string | null;
}

export interface SkirmishLog {
  id: string;
  territoryName: string;
  districtName: string;
  playerName: string;
  influenceContributed: number;
  raidOutcome: 'victory' | 'defeat';
  createdAt: string;
}

/**
 * Fetch all nodes in the territory map, including controlling district names.
 */
export async function getTerritories(): Promise<TerritoryNode[]> {
  try {
    const supabase = await createClient();

    // Query district_territories and left join districts
    const { data, error } = await (supabase.from("district_territories") as any)
      .select(`
        *,
        controlling_district:districts(id, name)
      `)
      .order("name", { ascending: true });

    if (error) {
      console.error("[getTerritories] Error fetching outposts:", error);
      return [];
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      q: t.q,
      r: t.r,
      name: t.name,
      resourceType: t.resource_type,
      controllingDistrictId: t.controlling_district_id,
      controllingDistrictName: t.controlling_district?.name || null,
      influencePoints: t.influence_points,
      isLocked: t.is_locked,
      lockedUntil: t.locked_until,
    }));
  } catch (err) {
    console.error("[getTerritories] Exception caught:", err);
    return [];
  }
}

/**
 * Fetch the current user's district, if any.
 */
export async function getPlayerDistrict(): Promise<{ id: string; name: string } | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: member, error } = await (supabase.from("district_members") as any)
      .select(`
        district_id,
        district:districts(id, name)
      `)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (error || !member || !member.district) {
      return null;
    }

    return {
      id: member.district_id,
      name: member.district.name,
    };
  } catch (err) {
    console.error("[getPlayerDistrict] Exception caught:", err);
    return null;
  }
}

/**
 * Perform an authoritative skirmish resolution by updating territory control metrics in Postgres.
 */
export async function engageSkirmish(territoryId: string, outcome: 'victory' | 'defeat') {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Unauthorized: Active session not found." };
    }

    // 1. Fetch user's district ID
    const district = await getPlayerDistrict();
    if (!district) {
      return { success: false, error: "You must be a member of a Stronghold District to raid for territories." };
    }

    // 2. Call pg tug-of-war procedure
    const influenceChange = outcome === 'victory' ? 15 : 0;
    const { data, error } = await (supabase as any).rpc("record_skirmish_and_update_influence", {
      p_profile_id: user.id,
      p_territory_id: territoryId,
      p_district_id: district.id,
      p_outcome: outcome,
      p_influence_change: influenceChange,
    });

    if (error) {
      console.error("[engageSkirmish] RPC error:", error);
      return { success: false, error: error.message || "Failed to commit influence update." };
    }

    // 3. Achievements check: outposts_5 for all district members
    if (outcome === 'victory' && data && data.controlling_district_id === district.id) {
      try {
        const { count } = await (supabase.from("district_territories") as any)
          .select("id", { count: "exact", head: true })
          .eq("controlling_district_id", district.id);

        const currentCount = count ?? 0;

        const { data: members } = await (supabase.from("district_members") as any)
          .select("profile_id")
          .eq("district_id", district.id);

        if (members && members.length > 0) {
          const nowStr = new Date().toISOString();
          for (const member of members) {
            await (supabase.from("player_achievements") as any)
              .update({
                progress: Math.min(5, currentCount),
                is_unlocked: currentCount >= 5,
                unlocked_at: currentCount >= 5 ? nowStr : null,
                updated_at: nowStr
              })
              .eq("user_id", member.profile_id)
              .eq("achievement_id", "outposts_5");
          }
        }
      } catch (achErr) {
        console.error("[engageSkirmish] Failed to update outposts achievement:", achErr);
      }
    }

    revalidatePath("/map/district");
    return {
      success: true,
      message: outcome === 'victory'
        ? `Victory! Contributed 15 influence to district control.`
        : `Defeat. District failed to capture grid node.`,
      result: data,
    };
  } catch (err: any) {
    console.error("[engageSkirmish] Exception caught:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Fetch recent territory skirmishes across the map for news feed display.
 */
export async function getRecentSkirmishes(limit = 10): Promise<SkirmishLog[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase.from("territory_skirmishes") as any)
      .select(`
        id,
        influence_contributed,
        raid_outcome,
        created_at,
        territory:district_territories(name),
        district:districts(name),
        profile:profiles(username)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getRecentSkirmishes] Error fetching skirmishes:", error);
      return [];
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      territoryName: s.territory?.name || "Unknown Sector",
      districtName: s.district?.name || "Rogue Raider",
      playerName: s.profile?.username || "Operator",
      influenceContributed: s.influence_contributed,
      raidOutcome: s.raid_outcome,
      createdAt: s.created_at,
    }));
  } catch (err) {
    console.error("[getRecentSkirmishes] Exception caught:", err);
    return [];
  }
}
