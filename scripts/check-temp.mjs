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
  const { data } = await supabase.from('curriculum_document_versions')
    .select('id, unit_id, document_type, version_number, status, created_at, payload')
    .eq('unit_id', 'cad29f59-7252-4d68-b47d-fbc7f1be03b3')
    .eq('document_type', 'scheme_of_work');
  console.log('Row:', JSON.stringify(data, null, 2));
}
run();
