import type { AssessmentMilestones } from './assessment-milestones';
import type { UnitCurriculumDefinition } from './curriculum-registry';

type UnitWeeklyScheduleItem =
  NonNullable<UnitCurriculumDefinition['weeklySchedule']>[number];

export interface RawTopicInput {
  topicTitle: string;
  subTopics?: string[];
  specificLearningOutcomes?: string;
  learningActivities?: string;
  resourcesAndReferences?: string;
  assessmentAndRemarks?: string;
}

export interface DistributedWeekSchedule {
  weekNumber: number;
  topicTitle: string;
  subTopics: string[];
  specificLearningOutcomes: string;
  learningActivities: string;
  resourcesAndReferences: string;
  assessmentAndRemarks: string;
}

/**
 * Splits an array of subtopics into `k` roughly equal chunks.
 */
function splitSubtopics(subtopics: string[], chunks: number): string[][] {
  if (chunks <= 1 || subtopics.length === 0) {
    return [subtopics];
  }

  const result: string[][] = [];
  const size = Math.ceil(subtopics.length / chunks);

  for (let i = 0; i < chunks; i++) {
    const start = i * size;
    const end = start + size;
    const slice = subtopics.slice(start, end);
    if (slice.length > 0) {
      result.push(slice);
    }
  }

  while (result.length < chunks) {
    result.push([]);
  }

  return result;
}

/**
 * Distributes an arbitrary list of N syllabus topics across T teaching weeks (default 14).
 * 
 * - If N === 14: 1 topic per week.
 * - If N < 14: Proportional distribution (topics with more subtopics or earlier topics span multiple weeks).
 * - Automatically overlays institutional assessment milestones (RAT, CAT, Exam) on designated weeks.
 */
export function distributeTopicsAcrossWeeks(
  rawTopics: (RawTopicInput | UnitWeeklyScheduleItem)[],
  totalWeeks = 14,
  milestones?: AssessmentMilestones | null,
): DistributedWeekSchedule[] {
  const normalizedTopics: RawTopicInput[] = (rawTopics || []).map((t, idx) => ({
    topicTitle: (t as any).topicTitle || (t as any).topic || `Topic ${idx + 1}`,
    subTopics: Array.isArray((t as any).subTopics)
      ? (t as any).subTopics
      : typeof (t as any).coverage === 'string'
      ? (t as any).coverage.split(/\s*[Â·;]\s*/).filter(Boolean)
      : [],
    specificLearningOutcomes: (t as any).specificLearningOutcomes || (t as any).learningOutcomes || '',
    learningActivities: (t as any).learningActivities || (t as any).activities || '',
    resourcesAndReferences: (t as any).resourcesAndReferences || (t as any).resources || '',
    assessmentAndRemarks: (t as any).assessmentAndRemarks || (t as any).assessment || '',
  })).filter((t) => Boolean(t.topicTitle.trim()));

  const result: DistributedWeekSchedule[] = [];

  if (normalizedTopics.length === 0) {
    for (let w = 1; w <= totalWeeks; w++) {
      result.push({
        weekNumber: w,
        topicTitle: '',
        subTopics: [],
        specificLearningOutcomes: '',
        learningActivities: '',
        resourcesAndReferences: '',
        assessmentAndRemarks: getMilestoneRemark(w, milestones),
      });
    }
    return result;
  }

  const N = normalizedTopics.length;

  // Case A: Exact match (e.g. 14 topics for 14 weeks)
  if (N === totalWeeks) {
    for (let i = 0; i < totalWeeks; i++) {
      const t = normalizedTopics[i];
      const weekNumber = i + 1;
      result.push({
        weekNumber,
        topicTitle: t.topicTitle,
        subTopics: t.subTopics ?? [],
        specificLearningOutcomes: t.specificLearningOutcomes || synthesizeLearningObjectives(t.topicTitle, t.subTopics),
        learningActivities: t.learningActivities || defaultActivities(weekNumber, t.topicTitle, t.subTopics),
        resourcesAndReferences: cleanInstructionalResources(t.resourcesAndReferences),
        assessmentAndRemarks: t.assessmentAndRemarks || getMilestoneRemark(weekNumber, milestones),
      });
    }
    return result;
  }

  // Case B: N < totalWeeks (e.g. 6 to 12 topics) -> Distribute proportionally
  if (N < totalWeeks) {
    const weekAllocations = new Array(N).fill(1);
    let remainingWeeks = totalWeeks - N;

    const priorityIndices = normalizedTopics
      .map((t, idx) => ({ idx, count: (t.subTopics ?? []).length }))
      .sort((a, b) => b.count - a.count);

    let priorityPtr = 0;
    while (remainingWeeks > 0) {
      const targetIdx = priorityIndices[priorityPtr % priorityIndices.length].idx;
      weekAllocations[targetIdx] += 1;
      remainingWeeks -= 1;
      priorityPtr += 1;
    }

    let currentWeek = 1;
    for (let i = 0; i < N; i++) {
      const topic = normalizedTopics[i];
      const allocatedWeeks = weekAllocations[i];
      const subtopicChunks = splitSubtopics(topic.subTopics ?? [], allocatedWeeks);

      for (let part = 0; part < allocatedWeeks; part++) {
        const weekNum = currentWeek;
        const partSubtopics = subtopicChunks[part] || [];
        const partSuffix = allocatedWeeks > 1 ? ` (Part ${part + 1})` : '';
        const effectiveSubtopics = partSubtopics.length > 0 ? partSubtopics : (topic.subTopics ?? []);

        result.push({
          weekNumber: weekNum,
          topicTitle: `${topic.topicTitle}${partSuffix}`,
          subTopics: effectiveSubtopics,
          specificLearningOutcomes: topic.specificLearningOutcomes || synthesizeLearningObjectives(`${topic.topicTitle}${partSuffix}`, effectiveSubtopics),
          learningActivities: topic.learningActivities || defaultActivities(weekNum, topic.topicTitle, effectiveSubtopics),
          resourcesAndReferences: cleanInstructionalResources(topic.resourcesAndReferences),
          assessmentAndRemarks: topic.assessmentAndRemarks || getMilestoneRemark(weekNum, milestones),
        });

        currentWeek += 1;
      }
    }

    return result;
  }

  // Case C: N > totalWeeks (e.g. 15+ topics) -> Group adjacent topics
  const step = N / totalWeeks;
  for (let w = 0; w < totalWeeks; w++) {
    const startIdx = Math.floor(w * step);
    const endIdx = Math.min(N, Math.floor((w + 1) * step));
    const grouped = normalizedTopics.slice(startIdx, endIdx);

    const weekNumber = w + 1;
    const combinedTitle = grouped.map((g) => g.topicTitle).join(' & ');
    const combinedSubtopics = grouped.flatMap((g) => g.subTopics ?? []);
    const combinedOutcomes = grouped.map((g) => g.specificLearningOutcomes).filter(Boolean).join('; ') || synthesizeLearningObjectives(combinedTitle, combinedSubtopics);
    const combinedActivities = grouped.map((g) => g.learningActivities).filter(Boolean).join('; ');
    const combinedResources = grouped.map((g) => g.resourcesAndReferences).filter(Boolean).join('; ');

    result.push({
      weekNumber,
      topicTitle: combinedTitle,
      subTopics: combinedSubtopics,
      specificLearningOutcomes: combinedOutcomes,
      learningActivities: combinedActivities || defaultActivities(weekNumber, combinedTitle, combinedSubtopics),
      resourcesAndReferences: cleanInstructionalResources(combinedResources),
      assessmentAndRemarks: getMilestoneRemark(weekNumber, milestones),
    });
  }

  return result;
}

/**
 * Formats a subtopic phrase into an active TVET behavioral objective
 */
function formatObjectivePhrase(phrase: string, fallbackTopic: string, index: number): string {
  let clean = phrase.replace(/^[-*•·\s\d.)]+/, '').trim();
  if (!clean) {
    clean = fallbackTopic;
  }

  clean = clean.replace(/[:;,\.]\s*$/, '').trim();
  const lower = clean.toLowerCase();

  if (/^(explain|describe|identify|analyze|demonstrate|apply|evaluate|discuss|outline|define|classify|assess|examine|formulate|differentiate|relate)\b/i.test(clean)) {
    return clean.charAt(0).toUpperCase() + clean.slice(1) + '.';
  }

  if (lower.startsWith('importance of ') || lower.startsWith('significance of ')) {
    return `Explain the ${clean.toLowerCase()}.`;
  }
  if (lower.startsWith('requirement') || lower.startsWith('prerequisite')) {
    return `Identify and describe the ${clean.toLowerCase()}.`;
  }
  if (lower.startsWith('introduction to ') || lower.startsWith('overview of ')) {
    return `Explain fundamental concepts and principles of ${clean.replace(/^(introduction to |overview of )/i, '')}.`;
  }
  if (lower.startsWith('definition of ') || lower.startsWith('meaning of ')) {
    return `Define and explain ${clean.replace(/^(definition of |meaning of )/i, '')}.`;
  }
  if (lower.startsWith('classification of ') || lower.startsWith('types of ') || lower.startsWith('categories of ')) {
    return `Classify and differentiate ${clean.toLowerCase()}.`;
  }
  if (lower.startsWith('methods of ') || lower.startsWith('techniques in ') || lower.startsWith('procedures for ')) {
    return `Demonstrate understanding of ${clean.toLowerCase()}.`;
  }
  if (lower.startsWith('factors affecting ') || lower.startsWith('factors influencing ')) {
    return `Analyze ${clean.toLowerCase()}.`;
  }
  if (lower.startsWith('prevention') || lower.startsWith('control of ') || lower.startsWith('treatment of ') || lower.startsWith('management of ')) {
    return `Describe ${clean.toLowerCase()}.`;
  }

  const verbPatterns = [
    `Explain the principles and concepts of ${clean}.`,
    `Describe the key characteristics and operational aspects of ${clean}.`,
    `Apply knowledge of ${clean} to practical tasks and problem-solving.`,
  ];

  return verbPatterns[index % verbPatterns.length];
}

export function synthesizeLearningObjectives(topicTitle: string, subTopics?: string[]): string {
  const cleanTitle = topicTitle.replace(/\s*\(Part\s*\d+\)/i, '').trim();
  
  const discretePhrases: string[] = [];
  if (subTopics && subTopics.length > 0) {
    for (const st of subTopics) {
      const parts = st
        .split(/[·;\n•\r]+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 2);
      for (const p of parts) {
        const subParts = p.split(/\s*,\s*(?=[A-Z])/).map((s) => s.trim()).filter((s) => s.length > 2);
        discretePhrases.push(...(subParts.length > 0 ? subParts : [p]));
      }
    }
  }

  if (discretePhrases.length === 0) {
    return `By the end of the lesson, the trainee should be able to:\n• Explain the fundamental principles and concepts of ${cleanTitle}.\n• Apply theoretical knowledge of ${cleanTitle} in practical contexts.`;
  }

  const selected = discretePhrases.slice(0, 3);
  const bullets = selected.map((item, idx) => `• ${formatObjectivePhrase(item, cleanTitle, idx)}`);

  return `By the end of the lesson, the trainee should be able to:\n${bullets.join('\n')}`;
}

function getMilestoneRemark(weekNumber: number, milestones?: AssessmentMilestones | null): string {
  if (!milestones) return '';
  if (weekNumber === milestones.ratWeek) return milestones.ratRemarks;
  if (weekNumber === milestones.catWeek) return milestones.catRemarks;
  if (weekNumber === milestones.examWeek) return milestones.examRemarks;
  return '';
}

/**
 * Diversified pedagogical activities across the 14 teaching weeks
 */
function defaultActivities(weekNumber: number, _topicTitle?: string, _subtopics?: string[]): string {
  const activitiesByWeek: Record<number, string> = {
    1: 'Interactive lecture · Diagnostic brainstorm · Note taking',
    2: 'Illustrated lecture · Guided discussion · Q&A check',
    3: 'Think-pair-share · Practical demonstration · Group exercise',
    4: 'Lecture · Case scenario analysis · Buzz group session',
    5: 'Continuous Assessment Test (RAT 1) · Plenary review session',
    6: 'Interactive lecture · Hands-on practical exercise · Demonstrations',
    7: 'Problem-solving session · Group presentations · Peer review',
    8: 'Mid-Term Examination (CAT) · Term progress evaluation',
    9: 'Guided practical simulation · Field/lab exercise · Class discussion',
    10: 'Demonstration · Group inquiry · Applied problem solving',
    11: 'Practical exercise · Case study analysis · Guided practice',
    12: 'Interactive lecture · Workshop tasks · Formative review',
    13: 'Comprehensive syllabus recap · Revision tutorials · Group Q&A',
    14: 'Final Examination · Supervised assessment · Course wrap-up',
  };

  return activitiesByWeek[weekNumber] || 'Interactive lecture · Practical illustrations · Small group discussion';
}

function defaultResources(_topicTitle?: string): string {
  return 'Course Textbooks · Whiteboard & Markers · Flip Charts · Handouts';
}

export function cleanInstructionalResources(value?: string | null): string {
  if (!value) return defaultResources();
  const trimmed = value.trim();
  if (
    /lehninger|harper|biochemistry|edition|isbn/i.test(trimmed) ||
    /^\d+\.\s+[A-Z]/i.test(trimmed)
  ) {
    return defaultResources();
  }
  return trimmed;
}
