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
  const { data } = await supabase
    .from('curriculum_document_versions')
    .select('id, version_number, document_type, payload')
    .eq('id', 'ccaf078b-4f5e-476b-acba-37a813b7605a')
    .single();
  console.log('Version 4 content:', JSON.stringify(data?.payload?.content, null, 2));
}
run();
