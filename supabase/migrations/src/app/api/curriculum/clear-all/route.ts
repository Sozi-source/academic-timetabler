import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireHodAccess } from '@/features/auth/authorization';

export async function POST() {
  try {
    await requireHodAccess();
    const admin = createAdminClient();

    await Promise.allSettled([
      admin.from('curriculum_document_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      admin.from('curriculum_content_import_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      admin.from('trainer_teaching_document_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      admin.from('teaching_documents').delete().in('document_type', ['course_outline', 'scheme_of_work', 'lesson_plan']),
      admin.from('curriculum_unit_mappings').delete().neq('unit_id', '00000000-0000-0000-0000-000000000000'),
      admin.from('curriculum_weeks').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      admin.from('curriculum_learning_outcomes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      admin.from('curriculum_references').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      admin.from('curriculum_families').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ]);

    return NextResponse.json({
      success: true,
      message: 'All generated curriculum documents, relational families, and staged batches have been cleared.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized or error' },
      { status: 500 }
    );
  }
}
