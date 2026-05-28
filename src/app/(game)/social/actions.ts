/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Action to propose a new peer-to-peer barter trade.
 * Validates:
 *  1. User auth check.
 *  2. Target player must be different from sender.
 *  3. Passes offered raw materials and item arrays to propose_trade RPC procedure.
 */
export async function proposeTradeAction(
  receiverId: string,
  offerScrap: number,
  offerComponents: number,
  offerCredits: number,
  demandScrap: number,
  demandComponents: number,
  demandCredits: number,
  items: { item_id: string; quantity: number; direction: "offer" | "demand" }[]
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (user.id === receiverId) {
      return { success: false as const, error: "You cannot trade with yourself." };
    }

    // Call the plpgsql propose_trade transaction procedure
    const { data, error } = await (supabase as any).rpc("propose_trade", {
      p_sender_id: user.id,
      p_receiver_id: receiverId,
      p_offer_scrap: offerScrap,
      p_offer_components: offerComponents,
      p_offer_credits: offerCredits,
      p_demand_scrap: demandScrap,
      p_demand_components: demandComponents,
      p_demand_credits: demandCredits,
      p_items: items
    });

    if (error) {
      console.error("[proposeTradeAction] RPC execution failed:", error);
      return { success: false as const, error: error.message };
    }

    const result = data as any;
    if (!result || !result.success) {
      return { success: false as const, error: result?.error || "Transaction failed." };
    }

    revalidatePath("/social");
    return { success: true as const, tradeId: result.trade_id };
  } catch (err: any) {
    console.error("[proposeTradeAction] Exception caught:", err);
    return { success: false as const, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Server Action to accept a trade offer.
 * Triggers the atomic database transfer of items and currencies under FOR UPDATE row locks.
 */
export async function acceptTradeAction(tradeId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const { data, error } = await (supabase as any).rpc("accept_trade", {
      p_trade_id: tradeId,
      p_receiver_id: user.id
    });

    if (error) {
      console.error("[acceptTradeAction] RPC execution failed:", error);
      return { success: false as const, error: error.message };
    }

    const result = data as any;
    if (!result || !result.success) {
      return { success: false as const, error: result?.error || "Transaction failed." };
    }

    revalidatePath("/social");
    revalidatePath("/room"); // Revalidate room since player items change
    return { success: true as const };
  } catch (err: any) {
    console.error("[acceptTradeAction] Exception caught:", err);
    return { success: false as const, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Server Action to withdraw an outbound trade offer.
 * Releases escrowed assets back to the sender.
 */
export async function withdrawTradeAction(tradeId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const { data, error } = await (supabase as any).rpc("withdraw_trade", {
      p_trade_id: tradeId,
      p_sender_id: user.id
    });

    if (error) {
      console.error("[withdrawTradeAction] RPC execution failed:", error);
      return { success: false as const, error: error.message };
    }

    const result = data as any;
    if (!result || !result.success) {
      return { success: false as const, error: result?.error || "Transaction failed." };
    }

    revalidatePath("/social");
    return { success: true as const };
  } catch (err: any) {
    console.error("[withdrawTradeAction] Exception caught:", err);
    return { success: false as const, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Server Action to decline an inbound trade offer.
 * Releases escrowed assets back to the sender.
 */
export async function declineTradeAction(tradeId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const { data, error } = await (supabase as any).rpc("decline_trade", {
      p_trade_id: tradeId,
      p_receiver_id: user.id
    });

    if (error) {
      console.error("[declineTradeAction] RPC execution failed:", error);
      return { success: false as const, error: error.message };
    }

    const result = data as any;
    if (!result || !result.success) {
      return { success: false as const, error: result?.error || "Transaction failed." };
    }

    revalidatePath("/social");
    return { success: true as const };
  } catch (err: any) {
    console.error("[declineTradeAction] Exception caught:", err);
    return { success: false as const, error: err.message || "An unexpected error occurred." };
  }
}
