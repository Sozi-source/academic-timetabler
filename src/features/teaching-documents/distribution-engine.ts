import { DEFAULT_ASSESSMENT_MILESTONES, type AssessmentMilestones } from './assessment-milestones';
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

export function isPureAssessmentTopic(title: string): boolean {
  const t = title.toLowerCase().trim();
  return (
    t.includes('continuous assessment test') ||
    t.includes('summative examination') ||
    t.includes('mid-term examination') ||
    t.includes('mid-term review') ||
    t.includes('end of term examination') ||
    t.includes('supervised final') ||
    t.includes('course evaluation') ||
    /^cat\b/i.test(t) ||
    /^rat\b/i.test(t) ||
    /^mid-term\s+/i.test(t) ||
    /^(?:final|supervised\s+final|comprehensive\s+final)/i.test(t)
  );
}

function cleanTopicTitle(title: string): string {
  return title.replace(/\s*\((?:RAT\s*\d*|CAT)\)\s*$/i, '').trim();
}

/**
 * Distributes syllabus topics across teaching weeks in a semester (default 14 weeks).
 * 
 * - Purges hardcoded RAT/CAT/Exam assessment topics from syllabus topics.
 * - Assessment weeks (CAT & End of Term Examination) are configured via setup.
 * - Teaching weeks receive syllabus topics (proportional or grouped if N != T).
 * - CAT and Exam rows contain NO synthetic content: subtopics, SLOs, activities, and resources are empty.
 */
export function distributeTopicsAcrossWeeks(
  rawTopics: (RawTopicInput | UnitWeeklyScheduleItem)[],
  totalWeeks = 14,
  milestones?: AssessmentMilestones | null,
): DistributedWeekSchedule[] {
  const effectiveMilestones = milestones ?? DEFAULT_ASSESSMENT_MILESTONES;

  // 1. Filter out pure assessment topics and clean RAT/CAT artifacts
  const normalizedTopics: RawTopicInput[] = (rawTopics || [])
    .map((t, idx) => {
      const rawTitle = (t as any).topicTitle || (t as any).topic || `Topic ${idx + 1}`;
      const topicTitle = cleanTopicTitle(rawTitle);
      const rawSubs = Array.isArray((t as any).subTopics)
        ? (t as any).subTopics
        : typeof (t as any).coverage === 'string'
        ? (t as any).coverage.split(/\s*[·;]\s*/).filter(Boolean)
        : [];
      const subTopics = rawSubs.filter((st: string) => !/continuous assessment|rat\s*\d/i.test(st));
      let slo = (t as any).specificLearningOutcomes || (t as any).learningOutcomes || '';
      slo = slo.replace(/\s*\((?:RAT\s*\d*|CAT)\)/gi, '').trim();

      return {
        topicTitle,
        subTopics,
        specificLearningOutcomes: slo,
        learningActivities: (t as any).learningActivities || (t as any).activities || '',
        resourcesAndReferences: (t as any).resourcesAndReferences || (t as any).resources || '',
        assessmentAndRemarks: (t as any).assessmentAndRemarks || (t as any).assessment || '',
      };
    })
    .filter((t) => Boolean(t.topicTitle.trim()) && !isPureAssessmentTopic(t.topicTitle));

  // 2. Identify configured assessment weeks vs teaching weeks
  const catWeek = effectiveMilestones.catWeek;
  const examWeek = effectiveMilestones.examWeek;
  const catRemarks = effectiveMilestones.catRemarks || 'Continuous Assessment Test (CAT)';
  const examRemarks = effectiveMilestones.examRemarks || 'End of Term Examination';
  const catDate = effectiveMilestones.catDate;
  const examDate = effectiveMilestones.examDate;

  const assessmentWeeks = new Set<number>();
  if (catWeek && catWeek >= 1 && catWeek <= totalWeeks) {
    assessmentWeeks.add(catWeek);
  }
  if (examWeek && examWeek >= 1 && examWeek <= totalWeeks) {
    assessmentWeeks.add(examWeek);
  }

  const teachingWeeks: number[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    if (!assessmentWeeks.has(w)) {
      teachingWeeks.push(w);
    }
  }

  const result: DistributedWeekSchedule[] = [];
  const T = teachingWeeks.length;
  const N = normalizedTopics.length;

  if (N === 0) {
    // Purge synthetic topics when curriculum content is not yet available.
    // Never fabricate placeholder weeks or synthetic topics.
    return [];
  } else if (N === T) {
    // Exact match: 1 topic per teaching week
    for (let i = 0; i < T; i++) {
      const t = normalizedTopics[i];
      const weekNumber = teachingWeeks[i];
      result.push({
        weekNumber,
        topicTitle: t.topicTitle,
        subTopics: t.subTopics ?? [],
        specificLearningOutcomes: resolveSpecificLearningOutcomes(t.specificLearningOutcomes, t.topicTitle, t.subTopics ?? []),
        learningActivities: t.learningActivities || defaultActivities(weekNumber, t.topicTitle, t.subTopics),
        resourcesAndReferences: cleanInstructionalResources(t.resourcesAndReferences),
        assessmentAndRemarks: t.assessmentAndRemarks || '',
      });
    }
  } else if (N < T) {
    // Distribute N topics proportionally across T teaching weeks
    const weekAllocations = new Array(N).fill(1);
    let remainingWeeks = T - N;

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

    let teachingWeekPtr = 0;
    for (let i = 0; i < N; i++) {
      const topic = normalizedTopics[i];
      const allocatedWeeks = weekAllocations[i];
      const subtopicChunks = splitSubtopics(topic.subTopics ?? [], allocatedWeeks);

      for (let part = 0; part < allocatedWeeks; part++) {
        const weekNum = teachingWeeks[teachingWeekPtr++];
        const partSubtopics = subtopicChunks[part] || [];
        const partSuffix = allocatedWeeks > 1 ? ` (Part ${part + 1})` : '';
        const effectiveSubtopics = partSubtopics.length > 0 ? partSubtopics : (topic.subTopics ?? []);
        const partTitle = `${topic.topicTitle}${partSuffix}`;

        result.push({
          weekNumber: weekNum,
          topicTitle: partTitle,
          subTopics: effectiveSubtopics,
          specificLearningOutcomes: resolveSpecificLearningOutcomes(topic.specificLearningOutcomes, partTitle, effectiveSubtopics),
          learningActivities: topic.learningActivities || defaultActivities(weekNum, topic.topicTitle, effectiveSubtopics),
          resourcesAndReferences: cleanInstructionalResources(topic.resourcesAndReferences),
          assessmentAndRemarks: topic.assessmentAndRemarks || '',
        });
      }
    }
  } else {
    // N > T: Group adjacent topics into T teaching weeks
    const step = N / T;
    for (let w = 0; w < T; w++) {
      const startIdx = Math.floor(w * step);
      const endIdx = Math.min(N, Math.floor((w + 1) * step));
      const grouped = normalizedTopics.slice(startIdx, endIdx);

      const weekNumber = teachingWeeks[w];
      const combinedTitle = grouped.map((g) => g.topicTitle).join(' & ');
      const combinedSubtopics = grouped.flatMap((g) => g.subTopics ?? []);
      const combinedOutcomes = resolveSpecificLearningOutcomes(
        grouped.map((g) => g.specificLearningOutcomes).filter(Boolean).join('; '),
        combinedTitle,
        combinedSubtopics,
      );
      const combinedActivities = grouped.map((g) => g.learningActivities).filter(Boolean).join('; ');
      const combinedResources = grouped.map((g) => g.resourcesAndReferences).filter(Boolean).join('; ');

      result.push({
        weekNumber,
        topicTitle: combinedTitle,
        subTopics: combinedSubtopics,
        specificLearningOutcomes: combinedOutcomes,
        learningActivities: combinedActivities || defaultActivities(weekNumber, combinedTitle, combinedSubtopics),
        resourcesAndReferences: cleanInstructionalResources(combinedResources),
        assessmentAndRemarks: '',
      });
    }
  }

  // 3. Add assessment rows (EMPTY content for subtopics, SLOs, activities, and resources)
  if (assessmentWeeks.has(catWeek)) {
    result.push({
      weekNumber: catWeek,
      topicTitle: catRemarks,
      subTopics: [],
      specificLearningOutcomes: '',
      learningActivities: '',
      resourcesAndReferences: '',
      assessmentAndRemarks: catDate ? `${catRemarks}\nDate: ${catDate}` : catRemarks,
    });
  }

  if (assessmentWeeks.has(examWeek)) {
    result.push({
      weekNumber: examWeek,
      topicTitle: examRemarks,
      subTopics: [],
      specificLearningOutcomes: '',
      learningActivities: '',
      resourcesAndReferences: '',
      assessmentAndRemarks: examDate ? `${examRemarks}\nDate: ${examDate}` : examRemarks,
    });
  }

  result.sort((a, b) => a.weekNumber - b.weekNumber);
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

export function resolveSpecificLearningOutcomes(
  rawOutcomes: string | undefined,
  topicTitle: string,
  subTopics: string[],
): string {
  if (!rawOutcomes || rawOutcomes.trim() === '') {
    return synthesizeLearningObjectives(topicTitle, subTopics);
  }

  // If rawOutcomes already starts with "By the end of", preserve authentic bullets with standard lead-in
  if (/^by the end of/i.test(rawOutcomes.trim())) {
    const lines = rawOutcomes.split(/[\n\r]+/);
    if (lines.length > 1) {
      const bullets = lines.slice(1).map((l) => l.trim()).filter(Boolean);
      return `By the end of the lesson/topic, the trainee should be able to:\n${bullets.map((b) => (b.startsWith('•') ? b : `• ${b}`)).join('\n')}`;
    }
  }

  // If it's a list of outcomes separated by semicolons or newlines
  const parts = rawOutcomes.split(/[\n\r;]+/).map((s) => s.replace(/^[•·\s-]+/, '').trim()).filter(Boolean);
  if (parts.length >= 1) {
    return `By the end of the lesson/topic, the trainee should be able to:\n${parts.map((p) => `• ${p}`).join('\n')}`;
  }

  return synthesizeLearningObjectives(topicTitle, subTopics);
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
    return `By the end of the lesson/topic, the trainee should be able to:\n• Explain the fundamental principles and concepts of ${cleanTitle}.\n• Apply theoretical knowledge of ${cleanTitle} in practical contexts.`;
  }

  const selected = discretePhrases.slice(0, 3);
  const bullets = selected.map((item, idx) => `• ${formatObjectivePhrase(item, cleanTitle, idx)}`);

  return `By the end of the lesson/topic, the trainee should be able to:\n${bullets.join('\n')}`;
}

function getMilestoneRemark(weekNumber: number, milestones?: AssessmentMilestones | null): string {
  const m = milestones ?? DEFAULT_ASSESSMENT_MILESTONES;
  if (weekNumber === m.catWeek) {
    return m.catDate ? `${m.catRemarks}\nDate: ${m.catDate}` : m.catRemarks;
  }
  if (weekNumber === m.examWeek) {
    return m.examDate ? `${m.examRemarks}\nDate: ${m.examDate}` : m.examRemarks;
  }
  return '';
}

/**
 * Diversified pedagogical activities across the teaching weeks
 */
function defaultActivities(weekNumber: number, _topicTitle?: string, _subtopics?: string[]): string {
  const activitiesByWeek: Record<number, string> = {
    1: 'Interactive lecture · Diagnostic brainstorm · Note taking',
    2: 'Illustrated lecture · Guided discussion · Q&A check',
    3: 'Think-pair-share · Practical demonstration · Group exercise',
    4: 'Lecture · Case scenario analysis · Buzz group session',
    5: 'Interactive lecture · Hands-on laboratory demonstration · Q&A check',
    6: 'Illustrated presentation · Small group tasks · Practical exercise',
    7: 'Problem-solving session · Group presentations · Peer review',
    8: 'Interactive lecture · Demonstration · Guided application',
    9: 'Guided practical simulation · Field/lab exercise · Class discussion',
    10: 'Demonstration · Group inquiry · Applied problem solving',
    11: 'Practical exercise · Case study analysis · Guided practice',
    12: 'Interactive lecture · Workshop tasks · Formative review',
    13: 'Comprehensive syllabus recap · Revision tutorials · Group Q&A',
    14: 'Formative review · Trainee feedback · Portfolio evaluation',
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
