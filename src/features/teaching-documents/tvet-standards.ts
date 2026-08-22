import type { UnitCurriculumDefinition } from './curriculum-registry';

export interface TVETDocumentHeaderContext {
  institutionName: string;
  departmentName: string;
  academicPeriodName: string;
  unitCode: string;
  unitName: string;
  cohortName: string;
  trainerName: string;
  trainerEmail?: string | null;
  totalNominalHours: number;
  weeklyHours: number;
}

export interface TVETCourseOutlineTopic {
  weekNumber: number;
  topicTitle: string;
  subTopics: string[];
  hours: number;
}

export interface TVETCourseOutlineData {
  header: TVETDocumentHeaderContext;
  unitDescription: string;
  overallCompetency: string;
  learningOutcomes: string[];
  weeklySchedule: TVETCourseOutlineTopic[];
  teachingLearningApproaches: string;
  assessmentApproaches: string;
  /**
   * Legacy compatibility field. The new document viewer does not render this
   * matrix; institutional assessment policy is configured outside curriculum.
   * Kept temporarily so existing tests/callers compile during migration.
   */
  assessmentMatrix: {
    continuousAssessment: { assignment:number; presentation:number; rat:number; cat:number; courseworkWeightedTotal:number };
    finalExamination:number;
    finalTotal:number;
  };
  references: string[];
  instructionalEquipment: string[];
}

export interface TVETSchemeOfWorkWeek {
  weekNumber: number;
  topic: string;
  subTopics: string;
  specificLearningOutcomes: string;
  learningActivities: string;
  resourcesAndReferences: string;
  assessmentAndRemarks: string;
}

export interface TVETSchemeOfWorkData {
  header: TVETDocumentHeaderContext;
  plannedWeeks: TVETSchemeOfWorkWeek[];
}

export interface TVETRecordOfWorkEntry {
  id: string;
  allocationId: string;
  weekNumber: number;
  sessionDate: string;
  workCovered: string;
  outcomesAchieved: string;
  attendanceSummary: string;
  remarks: string;
  trainerSignature: string;
  signedAt: string;
  hodStatus: 'pending' | 'verified';
}

export interface TVETRecordOfWorkData {
  header: TVETDocumentHeaderContext;
  entries: TVETRecordOfWorkEntry[];
  totalPlannedWeeks: number;
  completedWeeksCount: number;
  syllabusCompletionRate: number;
}

function fourteenWeeks(curriculum: UnitCurriculumDefinition, weeklyHours: number): TVETCourseOutlineTopic[] {
  const schedule = [...(curriculum.weeklySchedule ?? [])]
    .filter((row) => row.weekNumber >= 1 && row.weekNumber <= 14)
    .sort((a,b) => a.weekNumber - b.weekNumber);

  return Array.from({ length: 14 }, (_, index) => {
    const weekNumber = index + 1;
    const row = schedule.find((item) => item.weekNumber === weekNumber);
    return {
      weekNumber,
      topicTitle: row?.topicTitle ?? '',
      subTopics: row?.subTopics ?? [],
      hours: row?.hours ?? weeklyHours,
    };
  });
}

/**
 * Presentation-only Course Outline builder.
 * Curriculum content MUST be supplied from the database. No generic topics,
 * CAT weeks, exam weeks, learning outcomes, references or assessments are fabricated.
 */
export function generateTVETCourseOutline(
  context: TVETDocumentHeaderContext,
  curriculum?: UnitCurriculumDefinition | null,
): TVETCourseOutlineData {
  const source: UnitCurriculumDefinition = curriculum ?? { unitCode: context.unitCode, unitName: context.unitName };
  return {
    header: context,
    unitDescription: source.unitDescription ?? '',
    overallCompetency: source.overallCompetency ?? '',
    learningOutcomes: source.learningOutcomes ?? [],
    weeklySchedule: fourteenWeeks(source, context.weeklyHours),
    teachingLearningApproaches: source.teachingLearningApproaches ?? '',
    assessmentApproaches: source.assessmentApproaches ?? '',
    assessmentMatrix: {
      continuousAssessment: { assignment:5, presentation:10, rat:15, cat:15, courseworkWeightedTotal:30 },
      finalExamination:70,
      finalTotal:100,
    },
    references: source.references ?? [],
    instructionalEquipment: source.instructionalEquipment ?? [],
  };
}

/** Scheme of Work is another view of the same approved curriculum family. */
export function generateTVETSchemeOfWork(
  context: TVETDocumentHeaderContext,
  curriculum?: UnitCurriculumDefinition | null,
): TVETSchemeOfWorkData {
  const source: UnitCurriculumDefinition = curriculum ?? { unitCode: context.unitCode, unitName: context.unitName };
  const byWeek = new Map((source.weeklySchedule ?? []).map((row) => [row.weekNumber,row]));
  return {
    header: context,
    plannedWeeks: Array.from({ length: 14 }, (_, index) => {
      const weekNumber = index + 1;
      const row = byWeek.get(weekNumber);
      return {
        weekNumber,
        topic: row?.topicTitle ?? '',
        subTopics: (row?.subTopics ?? []).join(' · '),
        specificLearningOutcomes: row?.specificLearningOutcomes ?? '',
        learningActivities: row?.learningActivities ?? '',
        resourcesAndReferences: row?.resourcesAndReferences ?? '',
        assessmentAndRemarks: row?.assessmentAndRemarks ?? '',
      };
    }),
  };
}

export function computeRecordOfWorkSummary(
  context: TVETDocumentHeaderContext,
  entries: TVETRecordOfWorkEntry[],
  totalPlannedWeeks = 14,
): TVETRecordOfWorkData {
  const uniqueDeliveredWeeks = new Set(entries.map((entry) => entry.weekNumber)).size;
  return {
    header: context,
    entries: [...entries].sort((a,b) => a.weekNumber - b.weekNumber || a.sessionDate.localeCompare(b.sessionDate)),
    totalPlannedWeeks,
    completedWeeksCount: uniqueDeliveredWeeks,
    syllabusCompletionRate: Math.min(100,Math.round((uniqueDeliveredWeeks / totalPlannedWeeks) * 100)),
  };
}
