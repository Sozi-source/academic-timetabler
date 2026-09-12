'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AssessmentMilestones,
  DEFAULT_ASSESSMENT_MILESTONES,
} from './assessment-milestones';

const CONFIG_KEY = 'cfg-assessment-milestones';

/**
 * Server action for Admin/HOD to update assessment milestone weeks.
 * Keeps both legacy teaching_document_templates and semester_program_activities in sync.
 */
export async function saveAssessmentMilestonesAction(formData: FormData) {
  const catWeek = Number(formData.get('catWeek')) || DEFAULT_ASSESSMENT_MILESTONES.catWeek;
  const examWeek = Number(formData.get('examWeek')) || DEFAULT_ASSESSMENT_MILESTONES.examWeek;
  const catRemarks = String(formData.get('catRemarks') || '').trim() || DEFAULT_ASSESSMENT_MILESTONES.catRemarks;
  const examRemarks = String(formData.get('examRemarks') || '').trim() || DEFAULT_ASSESSMENT_MILESTONES.examRemarks;
  const catDate = String(formData.get('catDate') || '').trim();
  const examDate = String(formData.get('examDate') || '').trim();

  const config: AssessmentMilestones = {
    catWeek,
    examWeek,
    catRemarks,
    examRemarks,
    catDate,
    examDate,
  };

  const admin = createAdminClient();

  // 1. Save to legacy teaching_document_templates
  const { error } = await admin.from('teaching_document_templates').upsert({
    id: CONFIG_KEY,
    document_type: 'course_outline',
    name: 'Assessment Milestones Config',
    version_number: 1,
    status: 'active',
    storage_bucket: 'teaching-documents',
    storage_path: 'config/assessment-milestones.json',
    original_filename: JSON.stringify(config),
    notes: `CAT: W${catWeek}${catDate ? ` (${catDate})` : ''} · Exam: W${examWeek}${examDate ? ` (${examDate})` : ''}`,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to save assessment milestones: ${error.message}`);
  }

  // 2. Sync to semester_program_activities (institutional default)
  try {
    const defaultActivities = [
      {
        academic_period_id: null,
        week_number: 1,
        activity_type: 'orientation',
        title: 'Term Commencement & Course Introduction',
        description: 'Trainee orientation, course outline distribution, learning contract, diagnostic assessment.',
        is_teaching_week: true,
        learning_outcomes: 'Understand course expectations, syllabus structure, assessment criteria, and foundational concepts.',
        learning_activities: 'Interactive lecture · Syllabus review · Diagnostic brainstorm · Question & Answer',
        assessment_remarks: 'Formative Diagnostic Assessment',
        updated_at: new Date().toISOString(),
      },
      {
        academic_period_id: null,
        week_number: catWeek,
        activity_type: 'cat',
        title: 'Continuous Assessment Test (CAT)',
        description: `Continuous Assessment Test (CAT) - 30 Marks / 30% Coursework.${catDate ? ` Scheduled: ${catDate}.` : ''}`,
        is_teaching_week: false,
        learning_outcomes: `Assess comprehensive theoretical and practical competencies covered across Weeks 1 to ${catWeek - 1}.`,
        learning_activities: 'Administration of Continuous Assessment Test · Supervised examination',
        assessment_remarks: `${catRemarks}${catDate ? ` [Date: ${catDate}]` : ''}`,
        updated_at: new Date().toISOString(),
      },
      {
        academic_period_id: null,
        week_number: 13,
        activity_type: 'revision',
        title: 'Comprehensive Syllabus Revision & Tutorial Clinic',
        description: 'Intensive course review, past examination paper analysis, remedial tutorials.',
        is_teaching_week: true,
        learning_outcomes: 'Synthesize course principles, resolve complex competency areas, prepare for final summative evaluation.',
        learning_activities: 'Comprehensive syllabus recap · Revision tutorials · Group problem-solving · Past paper drills',
        assessment_remarks: 'Remedial Consultations & Formative Revision',
        updated_at: new Date().toISOString(),
      },
      {
        academic_period_id: null,
        week_number: examWeek,
        activity_type: 'exam',
        title: 'End of Term Examinations / Summative Evaluation',
        description: `Institutional End of Term Examinations & TVET CDACC Competency Assessments - 70 Marks.${examDate ? ` Scheduled: ${examDate}.` : ''}`,
        is_teaching_week: false,
        learning_outcomes: 'Demonstrate overall theoretical and practical competence as per TVET national curriculum standards.',
        learning_activities: 'Supervised End of Term Summative Examinations · Practical assessments · Script marking',
        assessment_remarks: `${examRemarks}${examDate ? ` [Date: ${examDate}]` : ''}`,
        updated_at: new Date().toISOString(),
      },
    ];

    await admin
      .from('semester_program_activities')
      .delete()
      .is('academic_period_id', null);

    await admin
      .from('semester_program_activities')
      .insert(defaultActivities);
  } catch (syncErr) {
    console.warn('Could not sync to semester_program_activities table:', syncErr);
  }

  revalidatePath('/teaching-documents');
  revalidatePath('/teaching-documents/curriculum');
  revalidatePath('/staff/documents');
  revalidatePath('/staff/units/[allocationId]/documents/scheme-of-work', 'page');
  revalidatePath('/staff/units/[allocationId]/documents/course-outline', 'page');
  revalidatePath('/staff/units/[allocationId]/documents/record-of-work', 'page');
}
