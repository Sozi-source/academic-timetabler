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
  const { data: rows } = await supabase
    .from('curriculum_document_versions')
    .select('id, unit_id, document_type, version_number, status, created_at, payload')
    .eq('document_type', 'scheme_of_work')
    .eq('status', 'active');
  console.log(`Active scheme_of_work rows count: ${rows?.length}`);
  for (const r of rows || []) {
    const payloadUnit = r.payload?.unit;
    const firstTopic = r.payload?.content?.[0]?.topic;
    console.log(`- ID: ${r.id}, Unit: ${r.unit_id}, UnitCode: ${payloadUnit?.unitCode}, UnitName: ${payloadUnit?.unitName}, Family: ${payloadUnit?.contentFamilyKey}, FirstTopic: ${firstTopic}`);
  }
}
run();
