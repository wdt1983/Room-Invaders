// supabase/functions/process-quest/index.ts
//
// Phase 4 task 4.0.10 — server-authoritative quest reward processing.
// Receives a completed quest ID, verifies validity, transitions status to 'claimed',
// and issues authoritative resource and XP payouts, handling player level promotion.
//
// Runtime: Deno. Deploy with `supabase functions deploy process-quest`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { levelForXp } from "../resolve-raid/progression.ts";
import questsData from "./quests.json" with { type: "json" };

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface QuestProcessRequest {
  questId: string;
}

interface QuestDefinition {
  id: string;
  title: string;
  category: string;
  targetValue: number;
  xpReward: number;
  rewards: {
    scrap?: number;
    components?: number;
    credits?: number;
    intel?: number;
    contraband?: number;
  };
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function findQuestDefinition(questId: string): QuestDefinition | null {
  const categories = [questsData.tutorial, questsData.daily, questsData.weekly];
  for (const list of categories) {
    const found = list.find((q) => q.id === questId);
    if (found) return found;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    console.error("[process-quest] SUPABASE_SERVICE_ROLE_KEY missing from env");
    return json({ success: false, error: "Server misconfigured" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    console.warn("[process-quest] getUser failed:", userErr);
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Parse body ---
  let body: QuestProcessRequest;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  if (!body.questId) {
    return json({ success: false, error: "Missing questId" }, 400);
  }

  const questDef = findQuestDefinition(body.questId);
  if (!questDef) {
    return json({ success: false, error: `Unknown quest: ${body.questId}` }, 400);
  }

  // --- Fetch player's quest state ---
  // deno-lint-ignore no-explicit-any
  const { data: playerQuest, error: pqError } = await (supabase.from("player_quests") as any)
    .select("id, status")
    .eq("player_id", user.id)
    .eq("quest_id", body.questId)
    .maybeSingle();

  if (pqError) {
    console.error("[process-quest] Quest select error:", pqError);
    return json({ success: false, error: "Database error fetching quest state" }, 500);
  }

  if (!playerQuest) {
    return json({ success: false, error: "Player has not unlocked this quest" }, 400);
  }

  if (playerQuest.status === "claimed") {
    return json({ success: false, error: "Rewards for this quest have already been claimed" }, 400);
  }

  if (playerQuest.status !== "completed") {
    return json({ success: false, error: "Quest is not completed yet" }, 400);
  }

  // --- Claim rewards ---
  // Transition status to 'claimed'
  // deno-lint-ignore no-explicit-any
  const { error: claimError } = await (supabase.from("player_quests") as any)
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerQuest.id);

  if (claimError) {
    console.error("[process-quest] Quest claim update error:", claimError);
    return json({ success: false, error: "Failed to claim quest" }, 500);
  }

  // --- Credit Loot ---
  // deno-lint-ignore no-explicit-any
  const { data: inventory, error: invError } = await (supabase.from("inventories") as any)
    .select("scrap, components, credits, intel, contraband")
    .eq("owner_id", user.id)
    .single();

  if (invError || !inventory) {
    console.error("[process-quest] Inventory lookup failed:", invError);
    return json({ success: false, error: "Inventory not found" }, 500);
  }

  const rewardScrap      = questDef.rewards.scrap      ?? 0;
  const rewardComponents = questDef.rewards.components ?? 0;
  const rewardCredits    = questDef.rewards.credits    ?? 0;
  const rewardIntel      = questDef.rewards.intel      ?? 0;
  const rewardContraband = questDef.rewards.contraband ?? 0;

  const newScrap      = (inventory.scrap      ?? 0) + rewardScrap;
  const newComponents = (inventory.components ?? 0) + rewardComponents;
  const newCredits    = (inventory.credits    ?? 0) + rewardCredits;
  const newIntel      = (inventory.intel      ?? 0) + rewardIntel;
  const newContraband = (inventory.contraband ?? 0) + rewardContraband;

  // deno-lint-ignore no-explicit-any
  const { error: invErrorUpdate } = await (supabase.from("inventories") as any)
    .update({
      scrap: newScrap,
      components: newComponents,
      credits: newCredits,
      intel: newIntel,
      contraband: newContraband,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", user.id);

  if (invErrorUpdate) {
    console.error("[process-quest] Failed to update inventory:", invErrorUpdate);
    return json({ success: false, error: "Failed to distribute resource rewards" }, 500);
  }

  // --- Credit XP & Handle Level Promotion ---
  // deno-lint-ignore no-explicit-any
  const { data: profile, error: profError } = await (supabase.from("profiles") as any)
    .select("xp, player_level")
    .eq("id", user.id)
    .single();

  if (profError || !profile) {
    console.error("[process-quest] Profile fetch failed:", profError);
    return json({ success: false, error: "Player profile not found" }, 500);
  }

  const currentXp = profile.xp ?? 0;
  const previousPlayerLevel = Math.max(1, profile.player_level ?? 1);
  const newXp = currentXp + questDef.xpReward;

  const derivedLevel = levelForXp(newXp);
  const newPlayerLevel = Math.max(previousPlayerLevel, derivedLevel);
  const leveledUp = newPlayerLevel > previousPlayerLevel;

  const profileUpdate: Record<string, unknown> = {
    xp: newXp,
    updated_at: new Date().toISOString(),
  };
  if (leveledUp) profileUpdate.player_level = newPlayerLevel;

  // deno-lint-ignore no-explicit-any
  const { error: profErrorUpdate } = await (supabase.from("profiles") as any)
    .update(profileUpdate)
    .eq("id", user.id);

  if (profErrorUpdate) {
    console.error("[process-quest] Failed to update profile XP:", profErrorUpdate);
    return json({ success: false, error: "Failed to grant XP reward" }, 500);
  }

  console.log(`[process-quest] Successfully processed quest ${body.questId} for user ${user.id}`);

  return json({
    success: true,
    questId: body.questId,
    xpGained: questDef.xpReward,
    lootScrap: rewardScrap,
    lootComponents: rewardComponents,
    lootCredits: rewardCredits,
    lootIntel: rewardIntel,
    lootContraband: rewardContraband,
    newScrap,
    newComponents,
    newCredits,
    newIntel,
    newContraband,
    newXp,
    previousPlayerLevel,
    newPlayerLevel,
    leveledUp,
  });
});
