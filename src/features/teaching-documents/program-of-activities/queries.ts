import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_PROGRAM_OF_ACTIVITIES,
  type SemesterProgramActivity,
  type SemesterProgramOfActivitiesConfig,
} from './types';
import type { AssessmentMilestones } from '../assessment-milestones';

/**
 * Loads the Program of Activities for a specific academic period,
 * falling back to the active academic period, or the institutional defaults.
 */
export const getSemesterProgramOfActivities = cache(
  async (academicPeriodId?: string | null): Promise<SemesterProgramActivity[]> => {
    try {
      const admin = createAdminClient();

      let targetPeriodId = academicPeriodId;

      // If period ID not supplied, resolve the active academic period
      if (!targetPeriodId) {
        const { data: activePeriod } = await admin
          .from('academic_periods')
          .select('id')
          .eq('status', 'active')
          .maybeSingle();

        targetPeriodId = activePeriod?.id ?? null;
      }

      // 1. Try loading activities scoped to this specific academic period
      if (targetPeriodId) {
        const { data: periodRows } = await admin
          .from('semester_program_activities')
          .select('*')
          .eq('academic_period_id', targetPeriodId)
          .order('week_number', { ascending: true });

        if (periodRows && periodRows.length > 0) {
          return periodRows.map((r) => ({
            id: r.id,
            academicPeriodId: r.academic_period_id,
            weekNumber: Number(r.week_number),
            activityType: r.activity_type,
            title: r.title,
            description: r.description,
            isTeachingWeek: Boolean(r.is_teaching_week),
            learningOutcomes: r.learning_outcomes,
            learningActivities: r.learning_activities,
            assessmentRemarks: r.assessment_remarks,
          }));
        }
      }

      // 2. Fallback to institutional default rows (where academic_period_id is null)
      const { data: defaultRows } = await admin
        .from('semester_program_activities')
        .select('*')
        .is('academic_period_id', null)
        .order('week_number', { ascending: true });

      if (defaultRows && defaultRows.length > 0) {
        return defaultRows.map((r) => ({
          id: r.id,
          academicPeriodId: null,
          weekNumber: Number(r.week_number),
          activityType: r.activity_type,
          title: r.title,
          description: r.description,
          isTeachingWeek: Boolean(r.is_teaching_week),
          learningOutcomes: r.learning_outcomes,
          learningActivities: r.learning_activities,
          assessmentRemarks: r.assessment_remarks,
        }));
      }
    } catch (err) {
      console.warn('Could not query semester_program_activities, using built-in defaults:', err);
    }

    return DEFAULT_PROGRAM_OF_ACTIVITIES;
  }
);

/**
 * Maps a Semester Program of Activities list to legacy AssessmentMilestones
 * for full backward compatibility across all legacy consumers.
 */
export function mapProgramOfActivitiesToMilestones(
  activities: SemesterProgramActivity[]
): AssessmentMilestones {
  const cats = activities.filter((a) => a.activityType === 'cat');
  const exams = activities.filter((a) => a.activityType === 'exam');

  const cat = cats[0] ?? null;
  const exam = exams[0] ?? null;

  return {
    catWeek: cat?.weekNumber ?? 8,
    examWeek: exam?.weekNumber ?? 14,
    catRemarks: cat?.assessmentRemarks || cat?.title || 'Continuous Assessment Test (CAT)',
    examRemarks: exam?.assessmentRemarks || exam?.title || 'End of Term Examination',
  };
}
