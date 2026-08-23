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

import { distributeTopicsAcrossWeeks } from './distribution-engine';
import type { AssessmentMilestones } from './assessment-milestones';

/**
 * Presentation-only Course Outline builder.
 * Curriculum topics are balanced across the 14-week term by the distribution engine.
 */
export function generateTVETCourseOutline(
  context: TVETDocumentHeaderContext,
  curriculum?: UnitCurriculumDefinition | null,
  milestones?: AssessmentMilestones | null,
): TVETCourseOutlineData {
  const source: UnitCurriculumDefinition = curriculum ?? { unitCode: context.unitCode, unitName: context.unitName };
  const distributed = distributeTopicsAcrossWeeks(source.weeklySchedule ?? [], 14, milestones);

  return {
    header: context,
    unitDescription: source.unitDescription ?? '',
    overallCompetency: source.overallCompetency ?? '',
    learningOutcomes: source.learningOutcomes ?? [],
    weeklySchedule: distributed.map((d) => ({
      weekNumber: d.weekNumber,
      topicTitle: d.topicTitle,
      subTopics: d.subTopics,
      hours: context.weeklyHours,
    })),
    teachingLearningApproaches: source.teachingLearningApproaches ?? '',
    assessmentApproaches:
      source.assessmentApproaches &&
      !source.assessmentApproaches.includes('Week 5') &&
      !source.assessmentApproaches.includes('Week 8')
        ? source.assessmentApproaches
        : 'Continuous Assessment Tests (CAT / RAT) — 15%\nAssignments — 5%\nClass Presentations / Practical Tasks — 10%\nFinal Summative Examination — 70%\nTotal Course Evaluation — 100%',
    assessmentMatrix: {
      continuousAssessment: { assignment:5, presentation:10, rat:15, cat:15, courseworkWeightedTotal:30 },
      finalExamination:70,
      finalTotal:100,
    },
    references: source.references ?? [],
    instructionalEquipment: source.instructionalEquipment ?? [],
  };
}

/**
 * Automatically synthesizes the 14-Week Scheme of Work directly from the Course Outline topics.
 * Zero separate scheme-of-work uploads required.
 */
export function generateTVETSchemeOfWork(
  context: TVETDocumentHeaderContext,
  curriculum?: UnitCurriculumDefinition | null,
  milestones?: AssessmentMilestones | null,
): TVETSchemeOfWorkData {
  const source: UnitCurriculumDefinition = curriculum ?? { unitCode: context.unitCode, unitName: context.unitName };
  const distributed = distributeTopicsAcrossWeeks(source.weeklySchedule ?? [], 14, milestones);

  return {
    header: context,
    plannedWeeks: distributed.map((d) => ({
      weekNumber: d.weekNumber,
      topic: d.topicTitle,
      subTopics: d.subTopics.join(' · '),
      specificLearningOutcomes: d.specificLearningOutcomes,
      learningActivities: d.learningActivities,
      resourcesAndReferences: d.resourcesAndReferences,
      assessmentAndRemarks: d.assessmentAndRemarks,
    })),
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
