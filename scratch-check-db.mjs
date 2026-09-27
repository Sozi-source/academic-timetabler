import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

const client = createClient(url, key);

async function run() {
  // Check batches
  const { data: batches } = await client
    .from('curriculum_content_import_batches')
    .select('id, payload')
    .in('status', ['imported', 'validated', 'staged'])
    .order('created_at', { ascending: false })
    .limit(5);

  for (const b of batches || []) {
    const units = b.payload?.units || [];
    const matched = units.filter(u => JSON.stringify(u).includes('2304') || JSON.stringify(u).toLowerCase().includes('biochem'));
    console.log(`Batch ${b.id} matching units:`, matched);
  }

  // Check curriculum_unit_mappings
  const { data: mappings } = await client
    .from('curriculum_unit_mappings')
    .select('*')
    .eq('unit_id', 'cad29f59-7252-4d68-b47d-fbc7f1be03b3');
  console.log('Unit mappings for DHN 2304:', mappings);
}

run();
