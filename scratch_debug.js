const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Has Service Key:", !!supabaseServiceKey);
console.log("Has Anon Key:", !!supabaseAnonKey);

const supabaseKey = supabaseServiceKey || supabaseAnonKey;
if (!supabaseKey) {
  console.error("No key found! Available keys:", Object.keys(env));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("--- Profiles ---");
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  console.log("Profiles count:", profiles ? profiles.length : 0, pErr || "");
  if (profiles && profiles.length > 0) {
    console.log("First profile:", profiles[0]);
    
    // Find our specific logged in profile or use the first one
    const userId = profiles[0].id;

    console.log("\n--- Inventories for user ---");
    const { data: inv, error: iErr } = await supabase.from('inventories').select('*').eq('owner_id', userId);
    console.log("Inventory row:", inv, iErr || "");

    console.log("\n--- Rooms for user ---");
    const { data: room, error: rErr } = await supabase.from('rooms').select('*').eq('owner_id', userId);
    console.log("Room row:", room, rErr || "");

    console.log("\n--- Squad for user ---");
    const { data: squad, error: sErr } = await supabase.from('player_squad').select('*').eq('owner_id', userId);
    console.log("Squad rows:", squad, sErr || "");
  }
}

run().catch(console.error);
