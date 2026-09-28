import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1].trim()] = val;
  }
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: revs } = await supabase
    .from('teaching_document_revisions')
    .select('*')
    .order('created_at', { ascending: false });
  console.log('Revisions count:', revs?.length);
  for (const r of revs || []) {
    console.log(`DocID: ${r.document_id} | rev: ${r.revision_number} | bucket: ${r.storage_bucket} | path: ${r.storage_path} | file: ${r.original_filename} | created: ${r.created_at}`);
  }
}
run();
