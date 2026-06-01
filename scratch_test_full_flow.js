const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.replace(/\r/g, '').split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[match[1]] = val;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client to create/manage users
const adminSupabase = createClient(url, serviceKey);

// Normal client for user flow
const userSupabase = createClient(url, anonKey);

async function run() {
  const email = `test_raider_${Date.now()}@example.com`;
  const password = "password123";

  console.log("1. Creating test user:", email);
  const { data: authData, error: signUpError } = await userSupabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: `raider_${Math.floor(Math.random() * 1000)}`
      }
    }
  });

  if (signUpError) {
    console.error("Sign up failed:", signUpError);
    return;
  }

  const user = authData.user;
  const session = authData.session;
  const token = session.access_token;
  console.log("User created, ID:", user.id);

  // We need to wait a second for the trigger to create the profile row
  console.log("Waiting 2s for trigger profile creation...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify profile exists and has level/xp set
  const { data: profile, error: profErr } = await adminSupabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  
  if (profErr || !profile) {
    console.error("Profile not found:", profErr);
    return;
  }
  console.log("Profile created:", profile);

  // Invoke resolve-raid remotely using the user's token
  console.log("2. Invoking resolve-raid with user token...");
  const payload = {
    fixtureId: "tier1-storage-unit",
    outcome: "victory",
    reason: "Loot stash secured",
    secondsElapsed: 25,
    squadHp: 80,
    squadMaxHp: 100,
    actionLog: [
      { t: 0, type: "move", data: { gridX: 1, gridY: 4 } },
      { t: 5, type: "move", data: { gridX: 1, gridY: 3 } },
      { t: 6, type: "move", data: { gridX: 2, gridY: 3 } },
      { t: 7, type: "move", data: { gridX: 3, gridY: 3 } },
      { t: 8, type: "move", data: { gridX: 4, gridY: 3 } },
      { t: 9, type: "move", data: { gridX: 5, gridY: 3 } },
      { t: 10, type: "move", data: { gridX: 6, gridY: 3 } },
      { t: 11, type: "move", data: { gridX: 7, gridY: 3 } },
      { t: 12, type: "move", data: { gridX: 8, gridY: 3 } },
      { t: 13, type: "move", data: { gridX: 8, gridY: 4 } },
      { t: 14, type: "move", data: { gridX: 8, gridY: 5 } },
      { t: 15, type: "move", data: { gridX: 8, gridY: 6 } },
      { t: 16, type: "move", data: { gridX: 8, gridY: 7 } },
      { t: 17, type: "stash_entered" },
      { t: 20, type: "stash_secured" }
    ]
  };

  try {
    const fnUrl = `${url}/functions/v1/resolve-raid`;
    const response = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": anonKey
      },
      body: JSON.stringify(payload)
    });

    console.log("Response Status:", response.status, response.statusText);
    const bodyText = await response.text();
    console.log("Response Body:", bodyText);
  } catch (err) {
    console.error("Fetch failed:", err);
  }

  // Cleanup user
  console.log("3. Cleaning up user...");
  const { error: delErr } = await adminSupabase.auth.admin.deleteUser(user.id);
  console.log("User cleanup status:", delErr ? `Failed: ${delErr.message}` : "Success");
}

run().catch(console.error);
