import { getUnitCurriculum, type UnitCurriculumDefinition } from './curriculum-registry';

export interface TVETDocumentHeaderContext {
  institutionName: string;
  departmentName: string;
  academicPeriodName: string;
  academicPeriodId?: string | null;
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
    continuousAssessment: {
      assignment?: number;
      presentation?: number;
      rat?: number;
      cat: number;
      courseworkWeightedTotal: number;
    };
    finalExamination: number;
    finalTotal: number;
  };
  references: string[];
  instructionalEquipment: string[];
  isAvailable?: boolean;
  notReadyMessage?: string;
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
  isAvailable?: boolean;
  notReadyMessage?: string;
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
import { DEFAULT_ASSESSMENT_MILESTONES, type AssessmentMilestones } from './assessment-milestones';

/**
 * Presentation-only Course Outline builder.
 * Curriculum topics are balanced across the 14-week term by the distribution engine.
 */
export function generateTVETCourseOutline(
  context: TVETDocumentHeaderContext,
  curriculum?: UnitCurriculumDefinition | null,
  milestones?: AssessmentMilestones | null,
): TVETCourseOutlineData {
  const effectiveMilestones = milestones ?? DEFAULT_ASSESSMENT_MILESTONES;
  const source: UnitCurriculumDefinition =
    curriculum ?? getUnitCurriculum(context.unitCode, context.unitName);
  
  const isAvailable =
    source.isAvailable !== false &&
    Boolean(source.weeklySchedule && source.weeklySchedule.length > 0);
  const notReadyMessage = !isAvailable
    ? source.notReadyMessage ||
      `Curriculum content for ${context.unitCode} (${context.unitName}) is currently not ready. The official course outline and scheme of work have not yet been published by the department.`
    : undefined;

  const distributed = isAvailable
    ? distributeTopicsAcrossWeeks(source.weeklySchedule ?? [], 14, effectiveMilestones)
    : [];

  return {
    header: context,
    isAvailable,
    notReadyMessage,
    unitDescription: source.unitDescription ?? '',
    overallCompetency: source.overallCompetency ?? '',
    learningOutcomes: source.learningOutcomes ?? [],
    weeklySchedule: distributed.map((d) => {
      const isCat = d.weekNumber === effectiveMilestones.catWeek;
      const isExam = d.weekNumber === effectiveMilestones.examWeek;

      let subTopics = [...d.subTopics];
      if (isCat || isExam) {
        subTopics = [];
      }

      return {
        weekNumber: d.weekNumber,
        topicTitle: d.topicTitle,
        subTopics,
        hours: context.weeklyHours,
      };
    }),
    teachingLearningApproaches: source.teachingLearningApproaches ?? '',
    assessmentApproaches:
      effectiveMilestones.catDate || effectiveMilestones.examDate
        ? `Continuous Assessment Test (CAT) [Week ${effectiveMilestones.catWeek}${effectiveMilestones.catDate ? ` · ${effectiveMilestones.catDate}` : ''}] — 30%\nFinal Summative Examination [Week ${effectiveMilestones.examWeek}${effectiveMilestones.examDate ? ` · ${effectiveMilestones.examDate}` : ''}] — 70%\nTotal Course Evaluation — 100%`
        : source.assessmentApproaches &&
          !source.assessmentApproaches.includes('Week 5') &&
          !source.assessmentApproaches.includes('Week 8') &&
          !source.assessmentApproaches.includes('RAT')
        ? source.assessmentApproaches
        : `Continuous Assessment Test (CAT) [Week ${effectiveMilestones.catWeek}] — 30%\nFinal Summative Examination [Week ${effectiveMilestones.examWeek}] — 70%\nTotal Course Evaluation — 100%`,
    assessmentMatrix: {
      continuousAssessment: { cat: 30, courseworkWeightedTotal: 30 },
      finalExamination: 70,
      finalTotal: 100,
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
  const source: UnitCurriculumDefinition =
    curriculum ?? getUnitCurriculum(context.unitCode, context.unitName);

  const isAvailable =
    source.isAvailable !== false &&
    Boolean(source.weeklySchedule && source.weeklySchedule.length > 0);
  const notReadyMessage = !isAvailable
    ? source.notReadyMessage ||
      `Curriculum content for ${context.unitCode} (${context.unitName}) is currently not ready. The official course outline and scheme of work have not yet been published by the department.`
    : undefined;

  const distributed = isAvailable
    ? distributeTopicsAcrossWeeks(source.weeklySchedule ?? [], 14, milestones)
    : [];

  return {
    header: context,
    isAvailable,
    notReadyMessage,
    plannedWeeks: distributed.map((d) => ({
      weekNumber: d.weekNumber,
      topic: d.topicTitle,
      subTopics: d.subTopics.join('\n'),
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

/**
 * Parses subtopics into discrete lines from strings (joined by \n, ·, ;, or bullets) or arrays
 */
export function parseSubTopics(input?: string | string[] | null): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.flatMap((item) => parseSubTopics(item));
  }
  return input
    .split(/[\n\r]+|[;|]+|[\u00b7\u2022\u25cf\u25aa\u25e6]+/u)
    .map((s) => s.replace(/^[\s\d.-]+/, '').trim())
    .filter((s) => s.length > 0);
}
/**
 * Parses learning activities into discrete lines
 */
export function parseActivitiesList(input?: string | null): string[] {
  if (!input) return [];
  let items = input
    .split(/[\n\r]+|[·;•]+/)
    .map((s) => s.replace(/^[•·\s-]+/, '').trim())
    .filter(Boolean);

  if (items.length === 1 && items[0].includes(',')) {
    const commaParts = items[0]
      .split(/,\s*(?:and\s+)?|\s+and\s+/i)
      .map((s) => s.replace(/^\s*[-•]\s*/, '').trim())
      .filter((s) => s.length > 2);
    if (commaParts.length > 1) {
      items = commaParts;
    }
  }

  return items;
}

/**
 * Action verbs used in TVET behavioral objectives
 */
const ACTION_VERBS =
  'explain|describe|identify|analyze|demonstrate|apply|evaluate|discuss|outline|define|classify|assess|examine|formulate|differentiate|relate|plan|categorize|practice|operate|observe|select|prepare|portion|present|maintain|clean';

/**
 * Parses Specific Learning Outcomes into discrete lines.
 * Handles multi-line strings, semicolon/bullet separated items, and compound single-line sentences.
 */
export function parseSLOOutcomes(input?: string | null): string[] {
  if (!input || !input.trim()) return [];

  const rawLines = input
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length > 1) {
    const firstIsPreamble = /^by the end of/i.test(rawLines[0]);
    const lines = firstIsPreamble ? rawLines.slice(1) : rawLines;
    return lines
      .map((b) => b.replace(/^[•·\s\d.-]+/, '').trim())
      .filter(Boolean)
      .map((b) => (b.endsWith('.') ? b : `${b}.`));
  }

  let cleanSingle = input
    .replace(/^by the end of [^:]+:\s*/i, '')
    .replace(/^[•·\s-]+/, '')
    .trim();

  // 1. Lettered or numbered list: e.g. a) ... b) ... or 1. ... 2. ...
  if (/\b[a-z]\)\s+/i.test(cleanSingle)) {
    const parts = cleanSingle
      .split(/\s*\b[a-z]\)\s+/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 2);
    if (parts.length > 0) {
      return parts.map((p) => {
        const c = p.replace(/[.,;]\s*$/, '').trim();
        return c.charAt(0).toUpperCase() + c.slice(1) + '.';
      });
    }
  }

  // 2. Semicolon or bullet separation
  if (/[•·;]+/.test(cleanSingle)) {
    const parts = cleanSingle
      .split(/[•·;]+/)
      .map((p) => p.replace(/^[•·\s\d.-]+/, '').trim())
      .filter((p) => p.length > 2);
    if (parts.length > 1) {
      return parts.map((p) => {
        const c = p.replace(/[.,;]\s*$/, '').trim();
        return c.charAt(0).toUpperCase() + c.slice(1) + '.';
      });
    }
  }

  // 3. Compound action clause separation: e.g. "Explain culinary terms, plan kitchen layouts, and identify professional..."
  const compoundRegex = new RegExp(
    `(?:,\\s+and\\s+|\\s*,\\s*)(?=(?:${ACTION_VERBS})\\b)`,
    'i',
  );
  if (compoundRegex.test(cleanSingle)) {
    const parts = cleanSingle
      .split(compoundRegex)
      .map((p) => p.trim())
      .filter((p) => p.length > 2);
    if (parts.length > 1) {
      return parts.map((p) => {
        const c = p.replace(/[.,;]\s*$/, '').trim();
        return c.charAt(0).toUpperCase() + c.slice(1) + '.';
      });
    }
  }

  const finalClean = cleanSingle.replace(/[.,;]\s*$/, '').trim();
  return finalClean ? [finalClean.charAt(0).toUpperCase() + finalClean.slice(1) + '.'] : [];
}

/**
 * Parses instructional resources into discrete lines
 */
export function parseResourcesList(input?: string | null): string[] {
  if (!input) return [];
  const items = input
    .split(/[\n\r]+|[·;•]+/)
    .map((s) => s.replace(/^[•·\s-]+/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const item of items) {
    if (item.includes(',')) {
      // Split by comma outside parentheses (e.g. "Food Science (7th Ed), Practical Cookery (4th Ed)")
      const parts = item
        .split(/,\s*(?![^()]*\))/)
        .map((s) => s.replace(/^[•·\s-]+/, '').replace(/^\d+\.\s*/, '').trim())
        .filter((s) => s.length > 1);
      if (parts.length > 1) {
        result.push(...parts);
      } else {
        result.push(item);
      }
    } else {
      result.push(item);
    }
  }
  return result;
}
