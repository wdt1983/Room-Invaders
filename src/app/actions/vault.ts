/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Action: depositToVault
 * Safely deposits a player's resource to their district vault.
 */
export async function depositToVault(resource: "scrap" | "components" | "credits", amount: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    if (amount <= 0) {
      throw new Error("Deposit amount must be positive.");
    }

    // Call the database function
    const { data, error } = await (supabase as any).rpc("deposit_to_vault", {
      p_profile_id: user.id,
      p_resource: resource,
      p_amount: amount,
    });

    if (error) {
      console.error("RPC deposit_to_vault failed:", error);
      throw new Error(error.message);
    }

    const result = data as any;
    if (!result.success) {
      throw new Error(result.error || "Deposit failed.");
    }

    revalidatePath("/map/district");
    return { success: true, message: result.message };
  } catch (err: any) {
    console.error("Exception in depositToVault Server Action:", err);
    return { success: false, error: err.message || "An unknown transmission failure occurred." };
  }
}

/**
 * Server Action: withdrawFromVault
 * Safely withdraws a resource from the district vault, enforcing role-based daily limits,
 * and broadcasting alerts to other members.
 */
export async function withdrawFromVault(resource: "scrap" | "components" | "credits", amount: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    if (amount <= 0) {
      throw new Error("Withdrawal amount must be positive.");
    }

    // Daily caps: 150 Scrap, 40 Components, 50 Credits/Coins
    const DAILY_CAPS = {
      scrap: 150,
      components: 40,
      credits: 50,
    };

    const cap = DAILY_CAPS[resource];

    // Call the database function
    const { data, error } = await (supabase as any).rpc("withdraw_from_vault", {
      p_profile_id: user.id,
      p_resource: resource,
      p_amount: amount,
      p_daily_cap: cap,
    });

    if (error) {
      console.error("RPC withdraw_from_vault failed:", error);
      throw new Error(error.message);
    }

    const result = data as any;
    if (!result.success) {
      throw new Error(result.error || "Withdrawal failed.");
    }

    // ─── ALERTS AND SYSTEM NOTIFICATIONS ───
    try {
      // 1. Fetch user's display profile name
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      const username = profile?.username || "A district member";

      // 2. Fetch the district name
      const { data: district } = await (supabase.from("districts") as any)
        .select("name")
        .eq("id", result.district_id)
        .single();
      const districtName = district?.name || "the faction";

      // 3. Find other members in the district to dispatch the alert to
      const { data: otherMembers } = await (supabase.from("district_members") as any)
        .select("profile_id")
        .eq("district_id", result.district_id)
        .neq("profile_id", user.id);

      if (otherMembers && otherMembers.length > 0) {
        const notifications = otherMembers.map((m: any) => ({
          user_id: m.profile_id,
          type: "vault_withdrawal",
          title: "Vault Withdrawal Alert",
          content: `${username} withdrew ${amount} ${resource} from "${districtName}" Shared Vault.`,
          metadata: {
            withdrawer_id: user.id,
            withdrawer_username: username,
            district_id: result.district_id,
            district_name: districtName,
            resource,
            amount,
          },
        }));

        const { error: notifErr } = await (supabase.from("notifications") as any).insert(notifications);
        if (notifErr) {
          console.error("Failed to insert withdrawal notifications:", notifErr);
        }
      }
    } catch (notifEx) {
      console.error("Error dispatching system notifications during withdrawal:", notifEx);
    }

    revalidatePath("/map/district");
    return { success: true, message: result.message };
  } catch (err: any) {
    console.error("Exception in withdrawFromVault Server Action:", err);
    return { success: false, error: err.message || "An unknown transmission failure occurred." };
  }
}
