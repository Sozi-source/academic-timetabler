import { createAdminClient } from '@/lib/supabase/admin';

export interface AssessmentMilestones {
  ratWeek: number;
  catWeek: number;
  examWeek: number;
  ratRemarks: string;
  catRemarks: string;
  examRemarks: string;
}

export const DEFAULT_ASSESSMENT_MILESTONES: AssessmentMilestones = {
  ratWeek: 5,
  catWeek: 8,
  examWeek: 14,
  ratRemarks: 'Continuous Assessment 1 (15 Marks)',
  catRemarks: 'Mid-Term CAT (15 Marks)',
  examRemarks: 'Final Exam (70 Marks)',
};

const CONFIG_KEY = 'cfg-assessment-milestones';

/**
 * Loads institutional assessment milestone weeks configured by Admin.
 */
export async function getAssessmentMilestones(): Promise<AssessmentMilestones> {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('teaching_document_templates')
      .select('original_filename')
      .eq('id', CONFIG_KEY)
      .maybeSingle();

    if (row?.original_filename) {
      const parsed = JSON.parse(row.original_filename) as Partial<AssessmentMilestones>;
      return {
        ratWeek: Number(parsed.ratWeek) || DEFAULT_ASSESSMENT_MILESTONES.ratWeek,
        catWeek: Number(parsed.catWeek) || DEFAULT_ASSESSMENT_MILESTONES.catWeek,
        examWeek: Number(parsed.examWeek) || DEFAULT_ASSESSMENT_MILESTONES.examWeek,
        ratRemarks: parsed.ratRemarks || DEFAULT_ASSESSMENT_MILESTONES.ratRemarks,
        catRemarks: parsed.catRemarks || DEFAULT_ASSESSMENT_MILESTONES.catRemarks,
        examRemarks: parsed.examRemarks || DEFAULT_ASSESSMENT_MILESTONES.examRemarks,
      };
    }
  } catch (err) {
    console.warn('Could not load assessment milestones from DB, using defaults:', err);
  }

  return DEFAULT_ASSESSMENT_MILESTONES;
}

export { saveAssessmentMilestonesAction } from './assessment-milestones-actions';
