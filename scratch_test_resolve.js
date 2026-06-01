const fs = require('fs');
const path = require('path');

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

const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resolve-raid`;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  console.log("Invoking resolve-raid at:", url);
  
  // Create a minimal mock payload for "Storage Unit"
  const payload = {
    fixtureId: "tier1-storage-unit",
    outcome: "victory",
    reason: "Loot stash secured",
    secondsElapsed: 15,
    squadHp: 100,
    squadMaxHp: 100,
    actionLog: [
      { t: 0, type: "move", data: { gridX: 1, gridY: 4 } },
      { t: 5, type: "move", data: { gridX: 8, gridY: 7 } },
      { t: 10, type: "stash_entered" },
      { t: 13, type: "stash_secured" }
    ]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
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
}

run().catch(console.error);
