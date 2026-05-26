/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Slot unlock conditions
function getActiveSquadCount(level: number, squadRows: any[]) {
  let count = 0;
  for (const m of squadRows) {
    const slot = m.slot_number;
    let locked = true;
    if (slot === 1) locked = false;
    else if (slot === 2) locked = level < 10;
    else if (slot === 3) locked = level < 25;
    else if (slot === 4) locked = level < 30;
    
    if (!locked) {
      count++;
    }
  }
  return count || 1; // At least 1 member
}

export async function createJointRaidLobby(
  targetId: string,
  targetName: string,
  targetDifficulty: 'easy' | 'medium' | 'hard'
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    // 1. Get user's district
    const { data: member, error: mErr } = await (supabase.from("district_members") as any)
      .select("district_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (mErr || !member) {
      throw new Error("You must belong to a cooperative district to initiate a joint raid.");
    }

    const districtId = member.district_id;

    // 2. Check if user already has an active or recruiting lobby
    const { data: existingLobby } = await (supabase.from("joint_raid_lobbies") as any)
      .select("id")
      .eq("host_id", user.id)
      .in("status", ["recruiting", "active"])
      .maybeSingle();

    if (existingLobby) {
      throw new Error("You already have an active joint raid lobby.");
    }

    // 3. Create the lobby
    const { data: lobby, error: lErr } = await (supabase.from("joint_raid_lobbies") as any)
      .insert({
        district_id: districtId,
        host_id: user.id,
        target_id: targetId,
        target_name: targetName,
        target_difficulty: targetDifficulty,
        status: "recruiting"
      })
      .select()
      .single();

    if (lErr || !lobby) {
      console.error("Failed to create joint raid lobby:", lErr);
      throw new Error("Failed to create joint raid lobby.");
    }

    // 4. Calculate squad stats for the host to insert as participant
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("player_level")
      .eq("id", user.id)
      .single();
    
    const { data: squad } = await (supabase.from("player_squad") as any)
      .select("*")
      .eq("owner_id", user.id);

    const level = profile?.player_level ?? 1;
    const squadCount = getActiveSquadCount(level, squad || []);
    const hpContribution = squadCount * 50;
    const damageBonus = squadCount * 10;

    // Join host as the first participant
    const { error: pErr } = await (supabase.from("joint_raid_participants") as any)
      .insert({
        lobby_id: lobby.id,
        profile_id: user.id,
        squad_hp_contribution: hpContribution,
        squad_damage_bonus: damageBonus,
        is_ready: true // Host is always ready
      });

    if (pErr) {
      console.error("Failed to add host to participants:", pErr);
      // rollback
      await (supabase.from("joint_raid_lobbies") as any).delete().eq("id", lobby.id);
      throw new Error("Failed to initialize lobby participants.");
    }

    revalidatePath("/map/district");
    return { success: true, lobbyId: lobby.id };
  } catch (err: any) {
    console.error("Exception in createJointRaidLobby:", err);
    return { success: false, error: err.message || "An unknown transmission failure occurred." };
  }
}

export async function joinJointRaidLobby(lobbyId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    // 1. Get lobby details
    const { data: lobby, error: lErr } = await (supabase.from("joint_raid_lobbies") as any)
      .select("*")
      .eq("id", lobbyId)
      .single();

    if (lErr || !lobby) {
      throw new Error("Target lobby not found.");
    }
    if (lobby.status !== "recruiting") {
      throw new Error("Raid lobby is no longer recruiting.");
    }

    // 2. Validate same district
    const { data: member } = await (supabase.from("district_members") as any)
      .select("district_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!member || member.district_id !== lobby.district_id) {
      throw new Error("You must belong to the same cooperative district to join this raid.");
    }

    // 3. Check current participants count
    const { count, error: cErr } = await (supabase.from("joint_raid_participants") as any)
      .select("id", { count: "exact", head: true })
      .eq("lobby_id", lobbyId);

    if (cErr) {
      throw new Error("Failed to verify participant capacity.");
    }
    if (count && count >= lobby.max_participants) {
      throw new Error("Target lobby is at maximum capacity.");
    }

    // 4. Calculate squad stats for participant
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("player_level")
      .eq("id", user.id)
      .single();
    
    const { data: squad } = await (supabase.from("player_squad") as any)
      .select("*")
      .eq("owner_id", user.id);

    const level = profile?.player_level ?? 1;
    const squadCount = getActiveSquadCount(level, squad || []);
    const hpContribution = squadCount * 50;
    const damageBonus = squadCount * 10;

    // 5. Add participant
    const { error: pErr } = await (supabase.from("joint_raid_participants") as any)
      .insert({
        lobby_id: lobbyId,
        profile_id: user.id,
        squad_hp_contribution: hpContribution,
        squad_damage_bonus: damageBonus,
        is_ready: false
      });

    if (pErr) {
      console.error("Failed to join lobby:", pErr);
      throw new Error("Already participating or failed to join.");
    }

    revalidatePath("/map/district");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in joinJointRaidLobby:", err);
    return { success: false, error: err.message || "An unknown transmission failure occurred." };
  }
}

export async function readyUpForJointRaid(lobbyId: string, isReady: boolean) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    // Update ready state
    const { error } = await (supabase.from("joint_raid_participants") as any)
      .update({ is_ready: isReady })
      .eq("lobby_id", lobbyId)
      .eq("profile_id", user.id);

    if (error) {
      console.error("Failed to toggle ready state:", error);
      throw new Error("Failed to update readiness.");
    }

    revalidatePath("/map/district");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in readyUpForJointRaid:", err);
    return { success: false, error: err.message || "Failed to update readiness." };
  }
}

export async function launchJointRaid(lobbyId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    // 1. Get lobby details
    const { data: lobby, error: lErr } = await (supabase.from("joint_raid_lobbies") as any)
      .select("*")
      .eq("id", lobbyId)
      .single();

    if (lErr || !lobby) {
      throw new Error("Lobby not found.");
    }
    if (lobby.host_id !== user.id) {
      throw new Error("Only the host can launch the raid.");
    }
    if (lobby.status !== "recruiting") {
      throw new Error("Lobby is not in recruiting status.");
    }

    // 2. Verify all participants are ready and at least 2 players
    const { data: participants, error: pErr } = await (supabase.from("joint_raid_participants") as any)
      .select("profile_id, is_ready")
      .eq("lobby_id", lobbyId);

    if (pErr || !participants) {
      throw new Error("Failed to verify participants.");
    }
    if (participants.length < 2) {
      throw new Error("Raid requires at least 2 participants.");
    }
    
    const allReady = participants.every((p: any) => p.is_ready);
    if (!allReady) {
      throw new Error("Not all players are ready.");
    }

    // 3. Launch lobby (set active and started_at)
    const { error: uErr } = await (supabase.from("joint_raid_lobbies") as any)
      .update({
        status: "active",
        started_at: new Date().toISOString()
      })
      .eq("id", lobbyId);

    if (uErr) {
      console.error("Failed to launch raid:", uErr);
      throw new Error("Failed to activate raid lobby.");
    }

    revalidatePath("/map/district");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in launchJointRaid:", err);
    return { success: false, error: err.message || "Failed to launch raid." };
  }
}

export async function cancelJointRaidLobby(lobbyId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    // Only host can cancel
    const { error } = await (supabase.from("joint_raid_lobbies") as any)
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", lobbyId)
      .eq("host_id", user.id);

    if (error) {
      console.error("Failed to cancel lobby:", error);
      throw new Error("Failed to cancel lobby.");
    }

    revalidatePath("/map/district");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in cancelJointRaidLobby:", err);
    return { success: false, error: err.message || "Failed to cancel lobby." };
  }
}

export async function leaveJointRaidLobby(lobbyId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: Active session not found.");
    }

    // 1. Check if user is host
    const { data: lobby } = await (supabase.from("joint_raid_lobbies") as any)
      .select("host_id")
      .eq("id", lobbyId)
      .single();

    if (!lobby) {
      throw new Error("Lobby not found.");
    }

    if (lobby.host_id === user.id) {
      // If host leaves, auto-cancel the lobby
      const { error } = await (supabase.from("joint_raid_lobbies") as any)
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", lobbyId);
      if (error) {
        throw new Error("Failed to cancel lobby on host departure.");
      }
    } else {
      // Otherwise just remove participant row
      const { error } = await (supabase.from("joint_raid_participants") as any)
        .delete()
        .eq("lobby_id", lobbyId)
        .eq("profile_id", user.id);
      if (error) {
        throw new Error("Failed to leave lobby.");
      }
    }

    revalidatePath("/map/district");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in leaveJointRaidLobby:", err);
    return { success: false, error: err.message || "Failed to leave lobby." };
  }
}
