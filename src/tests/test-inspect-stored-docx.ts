import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import AdmZip from 'adm-zip';

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
  const { data } = await supabase.storage
    .from('teaching-documents-private')
    .download('documents/6a71bb26-32e6-4633-8460-28330393cd8e/0e18dd0a-622c-4e44-8518-231610ce365e.docx');
  const buf = Buffer.from(await data!.arrayBuffer());
  const zip = new AdmZip(buf);
  const docXml = zip.readAsText('word/document.xml');
  console.log('Contains Meaning of terms:', docXml.includes('Meaning of terms'));
  // Find where Meaning of terms appears
  const idx = docXml.indexOf('Meaning of terms');
  console.log('Snippet around Meaning of terms:');
  console.log(docXml.slice(Math.max(0, idx - 200), idx + 200));
}
run();
