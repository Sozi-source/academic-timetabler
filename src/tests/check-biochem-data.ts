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
  const { data: vers } = await supabase
    .from('curriculum_document_versions')
    .select('*')
    .eq('unit_id', 'cad29f59-7252-4d68-b47d-fbc7f1be03b3');
  
  console.log('Versions for DHN 2304 (cad29f59-7252-4d68-b47d-fbc7f1be03b3):', vers?.length);
  for (const v of vers || []) {
    console.log(`ID: ${v.id} | type: ${v.document_type} | v${v.version_number} | status: ${v.status} | file: ${v.source_file_name}`);
    if (v.status === 'active') {
      console.log('ACTIVE PAYLOAD:', JSON.stringify(v.payload, null, 2));
    }
  }

  // Also check teaching_documents
  const { data: tdocs } = await supabase
    .from('teaching_documents')
    .select('*');
  const bioDocs = tdocs?.filter(d => JSON.stringify(d).includes('cad29f59') || JSON.stringify(d).toLowerCase().includes('biochem'));
  console.log('\nTeaching Documents for biochem:', bioDocs?.length);
  for (const d of bioDocs || []) {
    console.log(`Doc ID: ${d.id} | type: ${d.document_type} | status: ${d.status} | file_path: ${d.file_path}`);
  }
}
run();
