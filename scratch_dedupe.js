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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

const supabaseKey = supabaseServiceKey || supabaseAnonKey;
if (!supabaseKey) {
  console.error("No key found!");
  process.exit(1);
}

// We need the service role key to perform raw SQL queries or bypass RLS if needed,
// but since we only have anon key, we can run RPC or do updates/deletes through the client
// if policies permit, or since items has no delete policy for anon, we might need a SQL migration
// or an RPC call. Wait, let's see if we can do it directly.
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching all items to analyze...");
  const { data: items, error: iErr } = await supabase.from('items').select('id, name, sprite_key');
  if (iErr) {
    console.error("Error fetching items:", iErr);
    return;
  }

  console.log(`Found ${items.length} total items in database.`);
  
  // Group by sprite_key
  const groups = {};
  items.forEach(item => {
    if (!groups[item.sprite_key]) {
      groups[item.sprite_key] = [];
    }
    groups[item.sprite_key].push(item);
  });

  const duplicates = Object.keys(groups).filter(k => groups[k].length > 1);
  console.log(`Found ${duplicates.length} duplicate keys.`);

  if (duplicates.length === 0) {
    console.log("No duplicates found, database is clean.");
    return;
  }

  // We will generate a migration file or SQL execution script that can be run
  // because anon key cannot directly delete from items (RLS allows select only to anon).
  // Let's generate a safe SQL block that the user or we can execute via supabase CLI!
  // Yes, we can run the SQL query directly using the Supabase CLI db query command!
  console.log("Generating SQL deduplication query...");
  
  const sql = `
-- 1. Safely remap placed player items to the primary (kept) item records
WITH kept_items AS (
  SELECT DISTINCT ON (sprite_key) id, sprite_key
  FROM public.items
  ORDER BY sprite_key, id
)
UPDATE public.player_items pi
SET item_id = k.id
FROM kept_items k
JOIN public.items i ON i.sprite_key = k.sprite_key
WHERE pi.item_id = i.id AND pi.item_id <> k.id;

-- 2. Delete all duplicate item records, keeping only the primary record
DELETE FROM public.items a
USING public.items b
WHERE a.id > b.id
  AND a.sprite_key = b.sprite_key;
`;

  console.log("SQL Query generated:\n", sql);
  fs.writeFileSync('dedupe.sql', sql);
  console.log("Saved SQL to dedupe.sql");
}

run().catch(console.error);
