import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const admin = createClient(supabaseUrl, serviceRoleKey);

async function test() {
  const assessmentId = 'ba970275-3e9c-4e62-86e6-885bb145a239';
  // Check siblings resolution
  const { data: event } = await admin
    .from('assessment_events')
    .select('id,unit_id,cohort_id,academic_period_id,department_id')
    .eq('id', assessmentId)
    .single();
  console.log('Event:', event);

  // Check unit equivalence
  const { data: eq } = await admin
    .from('unit_equivalence_members')
    .select('equivalence_group_id')
    .eq('unit_id', event.unit_id)
    .eq('status', 'approved');
  console.log('Equivalence:', eq);

  if (eq && eq.length > 0) {
    const { data: allMembers } = await admin
      .from('unit_equivalence_members')
      .select('unit_id')
      .eq('equivalence_group_id', eq[0].equivalence_group_id)
      .eq('status', 'approved');
    const uids = (allMembers || []).map((m) => m.unit_id);
    const { data: sibs } = await admin
      .from('assessment_events')
      .select('id,unit_id')
      .in('unit_id', uids)
      .eq('academic_period_id', event.academic_period_id);
    console.log('Sibling events:', sibs);
  }
}
test().catch(console.error);
