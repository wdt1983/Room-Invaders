/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Action: createDistrict
 * Establishes a new cooperative stronghold district and joins the player at coordinate (1, 1).
 */
export async function createDistrict(name: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    if (!name || name.trim().length < 3) {
      throw new Error("District name must be at least 3 characters long.");
    }

    // 1. Check if user already belongs to a district
    const { data: existingMember } = await (supabase.from("district_members") as any)
      .select("district_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (existingMember) {
      throw new Error("You already belong to a district. You must leave it before establishing a new one.");
    }

    // 2. Insert the district
    const { data: district, error: dErr } = await (supabase.from("districts") as any)
      .insert({ name: name.trim() })
      .select("id")
      .single();

    if (dErr || !district) {
      console.error("Database insert failed for district:", dErr);
      throw new Error(`Failed to establish district: Name might already be taken.`);
    }

    // 3. Join the player as member at coordinates (1,1) (Center of the 3x3 district block)
    const { error: mErr } = await (supabase.from("district_members") as any)
      .insert({
        district_id: district.id,
        profile_id: user.id,
        grid_x: 1,
        grid_y: 1
      });

    if (mErr) {
      console.error("Database insert failed for district member:", mErr);
      // Rollback district insertion
      await (supabase.from("districts") as any).delete().eq("id", district.id);
      throw new Error("Failed to join established district.");
    }

    revalidatePath("/map/district");
    return { success: true, message: `District "${name}" established successfully.` };
  } catch (err: any) {
    console.error("Exception in createDistrict Server Action:", err);
    return { success: false, error: err.message || "An unknown transmission failure occurred." };
  }
}

/**
 * Server Action: joinDistrict
 * Joins the player to an existing district at a chosen coordinate (grid_x, grid_y).
 */
export async function joinDistrict(districtId: string, x: number, y: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    if (x < 0 || x > 2 || y < 0 || y > 2) {
      throw new Error("Invalid district coordinate slots (must be between 0 and 2).");
    }

    // 1. Check if user already belongs to a district
    const { data: existingMember } = await (supabase.from("district_members") as any)
      .select("district_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (existingMember) {
      throw new Error("You already belong to a district. Leave your current district first.");
    }

    // 2. Try to insert member in selected slot (DB enforces unique constraint)
    const { error: joinErr } = await (supabase.from("district_members") as any)
      .insert({
        district_id: districtId,
        profile_id: user.id,
        grid_x: x,
        grid_y: y
      });

    if (joinErr) {
      console.error("Database join failed for district member:", joinErr);
      throw new Error("Target coordinate slot is occupied or unavailable.");
    }

    revalidatePath("/map/district");
    return { success: true, message: "Joined cooperative district successfully." };
  } catch (err: any) {
    console.error("Exception in joinDistrict Server Action:", err);
    return { success: false, error: err.message || "An unknown transmission failure occurred." };
  }
}

/**
 * Server Action: leaveDistrict
 * Removes the player from their current district. If they were the last member, auto-deletes the district.
 */
export async function leaveDistrict() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    // 1. Find player's current district
    const { data: member, error: mErr } = await (supabase.from("district_members") as any)
      .select("district_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (mErr || !member) {
      throw new Error("You are not part of any cooperative district.");
    }

    const districtId = member.district_id;

    // 2. Remove the member row
    const { error: leaveErr } = await (supabase.from("district_members") as any)
      .delete()
      .eq("profile_id", user.id);

    if (leaveErr) {
      console.error("Failed to leave district:", leaveErr);
      throw new Error("Failed to execute leave request.");
    }

    // 3. Count remaining members in district; delete district if empty
    const { count, error: countErr } = await (supabase.from("district_members") as any)
      .select("id", { count: "exact", head: true })
      .eq("district_id", districtId);

    if (!countErr && count === 0) {
      console.log(`[leaveDistrict] District ${districtId} is empty. Auto-deleting district...`);
      await (supabase.from("districts") as any).delete().eq("id", districtId);
    }

    revalidatePath("/map/district");
    return { success: true, message: "Left district successfully." };
  } catch (err: any) {
    console.error("Exception in leaveDistrict Server Action:", err);
    return { success: false, error: err.message || "An unknown transmission failure occurred." };
  }
}
