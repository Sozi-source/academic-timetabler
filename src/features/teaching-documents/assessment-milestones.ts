import { createAdminClient } from '@/lib/supabase/admin';
import {
  getSemesterProgramOfActivities,
  mapProgramOfActivitiesToMilestones,
} from './program-of-activities/queries';

export interface AssessmentMilestones {
  catWeek: number;
  examWeek: number;
  catRemarks: string;
  examRemarks: string;
  catDate?: string;
  examDate?: string;
}

export const DEFAULT_ASSESSMENT_MILESTONES: AssessmentMilestones = {
  catWeek: 8,
  examWeek: 14,
  catRemarks: 'Continuous Assessment Test (CAT)',
  examRemarks: 'End of Term Examination',
  catDate: '',
  examDate: '',
};

const CONFIG_KEY = 'cfg-assessment-milestones';

/**
 * Loads institutional assessment milestone weeks and dates configured by Admin/HOD.
 * Seamlessly integrates with the active Semester Program of Activities.
 */
export async function getAssessmentMilestones(
  academicPeriodId?: string | null
): Promise<AssessmentMilestones> {
  try {
    // 1. Check Semester Program of Activities first
    const activities = await getSemesterProgramOfActivities(academicPeriodId);
    if (activities && activities.length > 0) {
      const mapped = mapProgramOfActivitiesToMilestones(activities);
      if (mapped.catWeek || mapped.examWeek) {
        return mapped;
      }
    }

    // 2. Fallback to legacy config row in teaching_document_templates
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('teaching_document_templates')
      .select('original_filename')
      .eq('id', CONFIG_KEY)
      .maybeSingle();

    if (row?.original_filename) {
      const parsed = JSON.parse(row.original_filename) as Partial<AssessmentMilestones>;
      return {
        catWeek: Number(parsed.catWeek) || DEFAULT_ASSESSMENT_MILESTONES.catWeek,
        examWeek: Number(parsed.examWeek) || DEFAULT_ASSESSMENT_MILESTONES.examWeek,
        catRemarks: parsed.catRemarks || DEFAULT_ASSESSMENT_MILESTONES.catRemarks,
        examRemarks: parsed.examRemarks || DEFAULT_ASSESSMENT_MILESTONES.examRemarks,
        catDate: parsed.catDate || '',
        examDate: parsed.examDate || '',
      };
    }
  } catch (err) {
    console.warn('Could not load assessment milestones from DB, using defaults:', err);
  }

  return DEFAULT_ASSESSMENT_MILESTONES;
}

export { saveAssessmentMilestonesAction } from './assessment-milestones-actions';
