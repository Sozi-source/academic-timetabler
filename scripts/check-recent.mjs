import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const lines = env.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
}
const supabase = createClient(url, key);

async function run() {
  const { data: recentVersions } = await supabase
    .from('curriculum_document_versions')
    .select('id, unit_id, document_type, version_number, status, created_at, payload')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Recent 10 versions in curriculum_document_versions:');
  for (const v of recentVersions || []) {
    console.log(`[${v.created_at}] ID: ${v.id}, Unit: ${v.unit_id}, Type: ${v.document_type}, v${v.version_number}, status: ${v.status}`);
    console.log('   Payload unit:', v.payload?.unit?.unitCode, v.payload?.unit?.unitName);
    console.log('   First topic:', v.payload?.content?.[0]?.topic, 'coverage:', v.payload?.content?.[0]?.coverage?.slice(0, 50));
  }
}
run();
