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

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("--- Items ---");
  const { data: items, error: iErr } = await supabase.from('items').select('id, name, sprite_key, required_boss_clear');
  console.log("Items count:", items ? items.length : 0, iErr || "");
  if (items) {
    const keyCounts = {};
    items.forEach(i => {
      keyCounts[i.sprite_key] = (keyCounts[i.sprite_key] || 0) + 1;
    });
    const duplicates = Object.keys(keyCounts).filter(k => keyCounts[k] > 1);
    console.log("Duplicate keys:", duplicates.map(k => ({ key: k, count: keyCounts[k], firstItem: items.find(item => item.sprite_key === k) })));
  }
}

run().catch(console.error);
