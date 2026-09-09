import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: programmes } = await supabase.from('programmes').select('id, code, name').eq('code', 'CHN');
  console.log('Programmes:', programmes);

  if (programmes && programmes.length > 0) {
    const programmeId = programmes[0].id;
    const { data: stages } = await supabase.from('programme_stages').select('id, code, name').eq('programme_id', programmeId);
    console.log('Stages:', stages);

    const { data: units } = await supabase.from('units').select('id, code, name, academic_period_number').eq('programme_id', programmeId);
    console.log('Units:', units);

    const { data: stageUnits } = await supabase.from('programme_stage_units').select('stage_id, unit_id');
    const chnStageUnits = stageUnits?.filter(su => stages?.some(s => s.id === su.stage_id));
    console.log('CHN Stage Units count:', chnStageUnits?.length);
    
    if (chnStageUnits) {
       for (const su of chnStageUnits) {
         const stage = stages?.find(s => s.id === su.stage_id);
         const unit = units?.find(u => u.id === su.unit_id);
         console.log(`Stage: ${stage?.code} -> Unit: ${unit?.code} (Period: ${unit?.academic_period_number})`);
       }
    }
  }
}

main().catch(console.error);
