import 'server-only';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  createAdminClient,
} from '@/lib/supabase/admin';

import type {
  OnlineRecordOfWorkContext,
  OnlineRecordOfWorkEntry,
  OnlineRecordOfWorkOccurrence,
} from './types';

type UnknownRow =
  Record<string, unknown>;

type Relation<T> =
  | T
  | T[]
  | null
  | undefined;

function one<T>(
  value: Relation<T>,
): T | null {
  return Array.isArray(value)
    ? value[0] ?? null
    : value ?? null;
}

function asString(
  value: unknown,
): string {
  return typeof value ===
    'string'
    ? value
    : '';
}

function asNullableString(
  value: unknown,
): string | null {
  const text =
    asString(value).trim();

  return text
    ? text
    : null;
}

function asNumber(
  value: unknown,
  fallback = 0,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback;
}

function normalizeTime(
  value: unknown,
): string {
  const text =
    asString(value);

  if (!text) {
    return '';
  }

  return text.slice(
    0,
    5,
  );
}

function timeLabel(
  startTime: string,
  endTime: string,
): string {
  if (
    !startTime &&
    !endTime
  ) {
    return '';
  }

  return `${startTime || '—'}–${endTime || '—'}`;
}

const dayIndex:
Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function weekdayNumber(
  value: unknown,
): number | null {
  const normalized =
    asString(value)
      .trim()
      .toLowerCase();

  return dayIndex[
    normalized
  ] ??
    dayIndex[
      normalized.slice(
        0,
        3,
      )
    ] ??
    null;
}

function isoDate(
  date: Date,
): string {
  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

function dateFromIso(
  value: string,
): Date {
  return new Date(
    `${value}T00:00:00.000Z`,
  );
}

function kenyaToday():
string {
  const parts =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:
          'Africa/Nairobi',
        year:
          'numeric',
        month:
          '2-digit',
        day:
          '2-digit',
      },
    ).formatToParts(
      new Date(),
    );

  const part = (
    type: string,
  ) =>
    parts.find(
      (item) =>
        item.type ===
        type,
    )?.value ??
    '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function occurrenceDates({
  teachingStartsOn,
  teachingEndsOn,
  weekday,
}: {
  teachingStartsOn: string;
  teachingEndsOn: string;
  weekday: number;
}): Array<{
  date: string;
  weekNumber: number;
}> {
  const start =
    dateFromIso(
      teachingStartsOn,
    );

  const end =
    dateFromIso(
      teachingEndsOn,
    );

  if (
    Number.isNaN(
      start.getTime(),
    ) ||
    Number.isNaN(
      end.getTime(),
    ) ||
    end <
      start
  ) {
    return [];
  }

  const startDay =
    start.getUTCDay();

  const delta =
    (
      weekday -
      startDay +
      7
    ) %
    7;

  const first =
    new Date(
      start.getTime() +
        delta *
          24 *
          60 *
          60 *
          1000,
    );

  const result:
  Array<{
    date: string;
    weekNumber: number;
  }> =
    [];

  for (
    let current =
      first;
    current <=
      end;
    current =
      new Date(
        current.getTime() +
          7 *
            24 *
            60 *
            60 *
            1000,
      )
  ) {
    const weekNumber =
      Math.floor(
        (
          current.getTime() -
          start.getTime()
        ) /
          (
            7 *
            24 *
            60 *
            60 *
            1000
          ),
      ) +
      1;

    // Standard TVET semester is strictly 14 weeks
    if (weekNumber > 14) {
      break;
    }

    result.push({
      date:
        isoDate(
          current,
        ),
      weekNumber:
        Math.max(
          1,
          weekNumber,
        ),
    });
  }

  return result;
}

function parseSchemeSubtopics(raw: unknown): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : String(raw).split(/[\n·;•\r]+/);
  return items
    .map((s) => cleanMojibakeText(s).replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((s) => s.length > 2);
}

function cleanMojibakeText(text?: string | null): string {
  if (!text) return '';
  return text
    .replaceAll('â€¢', '•')
    .replaceAll('Â·', '·')
    .replaceAll('â€”', '—')
    .replaceAll('â€“', '–')
    .replaceAll('ÃƒÆ’Ã†â€™', '')
    .trim();
}

function isAssessmentTopic(title: string): boolean {
  return /continuous assessment|summative|end[\s-]*(?:of[\s-]*)?(?:term|semester)|cat\b|rat\b|final examination/i.test(title);
}

function isCatTopic(title: string): boolean {
  return /continuous assessment|cat\b|rat\b/i.test(title);
}

function synthesizePracticalObjective(subtopic: string, index = 0): string {
  const clean = subtopic.replace(/^[-*•\d.)\s]+/, '').trim().replace(/[:;,\.]\s*$/, '');
  const lower = clean.toLowerCase();

  if (/glycolysis|krebs|pyruvate|respiratory|phosphorylation|oxidation|beta-oxidation|urea\s+cycle|transamination|deamination|activation|transport|cycle|synthesis|replication|transcription|translation/i.test(lower)) {
    if (index % 2 === 1) {
      return `Perform reaction mapping, enzyme cofactor analysis, and quantitative problem-solving on ${clean}.`;
    }
    return `Trace biochemical pathway steps, calculate net energy yield (ATP), and diagram intermediate stages of ${clean}.`;
  }
  if (/disease|disorder|pathology|syndrome|inborn\s+error|deficiency|alteration|clinical/i.test(lower)) {
    if (index % 2 === 1) {
      return `Evaluate patient laboratory findings, pathology risks, and clinical nutritional management for ${clean}.`;
    }
    return `Analyze diagnostic markers, clinical case presentations, and metabolic alterations associated with ${clean}.`;
  }
  if (/enzyme|enzymology|kinetics|inhibition|catalyst|substrate|michaelis|lineweaver/i.test(lower)) {
    if (index % 2 === 1) {
      return `Demonstrate spectrophotometric measurements, enzyme velocity calculations, and catalytic analysis of ${clean}.`;
    }
    return `Conduct laboratory assays, construct kinetic plots, and evaluate factors influencing ${clean}.`;
  }
  if (/dna|rna|purine|pyrimidine|nucleotide|codon/i.test(lower)) {
    if (index % 2 === 1) {
      return `Examine biochemical stability, denaturation dynamics, and molecular diagnostic applications of ${clean}.`;
    }
    return `Analyze structural models, differentiate molecular components, and diagram functional mechanisms of ${clean}.`;
  }
  if (/meaning\s+of\s+terms|definition|introduction|overview|concept/i.test(lower)) {
    return `Apply diagnostic principles, terminology, and foundational concepts of ${clean} to practical exercises.`;
  }
  if (/stain|microscop|culture|isolat|media|streak|agar/i.test(lower)) {
    return `Perform laboratory staining, microscopic examination, and aseptic handling relating to ${clean}.`;
  }
  if (/calculat|assessment|diet|intake|planning|menu|requirement/i.test(lower)) {
    return `Perform quantitative nutritional calculations and clinical assessment protocols for ${clean}.`;
  }
  if (/quality|preserv|process|storage|hygiene|control/i.test(lower)) {
    return `Execute quality control procedures, safety protocols, and standard operating procedures for ${clean}.`;
  }

  return `Demonstrate practical procedures, diagnostic methods, and problem-solving relating to ${clean}.`;
}

function formatTheoryOutcomes(rawOutcomes: string, subtopics: string[], baseTopic: string): string {
  const cleanRaw = cleanMojibakeText(rawOutcomes);
  let bullets: string[] = [];

  if (cleanRaw) {
    if (cleanRaw.includes('•')) {
      bullets = cleanRaw
        .split(/[\n\r]+/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'))
        .map((l) => l.replace(/^[-*•\s]+/, '').trim())
        .filter((l) => l.length > 2);
    } else if (cleanRaw.includes(';') || cleanRaw.includes('\n')) {
      bullets = cleanRaw
        .split(/[;\n\r]+/)
        .map((l) => l.trim().replace(/^[-*•\s]+/, ''))
        .filter((l) => l.length > 2);
    } else if (/^By the end of/i.test(cleanRaw)) {
      const parts = cleanRaw.replace(/^By the end of[^\n:]+[:\n]/i, '').split(/[\n\r]+/);
      bullets = parts.map((p) => p.trim().replace(/^[-*•\s]+/, '')).filter((p) => p.length > 2);
    } else {
      bullets = [cleanRaw];
    }
  }

  if (bullets.length === 0 && subtopics.length > 0) {
    bullets = subtopics.slice(0, 3).map((st) => {
      const clean = st.replace(/^[-*•\d.)\s]+/, '').trim().replace(/[:;,\.]\s*$/, '');
      const lower = clean.toLowerCase();
      if (/meaning|definition/i.test(lower)) return `Define and explain key terms and foundational principles of ${clean}.`;
      if (/classification|types/i.test(lower)) return `Classify and differentiate ${clean}.`;
      if (/factor/i.test(lower)) return `Analyze factors influencing ${clean}.`;
      return `Explain the principles, biological roles, and regulation of ${clean}.`;
    });
  }

  if (bullets.length === 0) {
    bullets = [
      `Explain the fundamental principles and concepts of ${baseTopic}.`,
      `Apply theoretical knowledge of ${baseTopic} to clinical and diagnostic contexts.`
    ];
  }

  const formattedBullets = bullets.map((b) => {
    let s = b.trim();
    if (s.length > 0) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
      if (!s.endsWith('.')) s += '.';
    }
    return `• ${s}`;
  });

  return [
    'By the end of the lesson/topic, the trainee should be able to:',
    ...formattedBullets
  ].join('\n');
}

function formatPracticalOutcomes(baseTopic: string, subtopics: string[]): string {
  const bullets: string[] = [];
  const cleanSubs = subtopics.slice(0, 3);

  for (let i = 0; i < cleanSubs.length; i++) {
    bullets.push(`• ${synthesizePracticalObjective(cleanSubs[i], i)}`);
  }

  if (bullets.length === 0) {
    bullets.push(
      `• Perform laboratory procedures and hands-on exercises demonstrating ${baseTopic}.`,
      `• Conduct setup, perform tasks, and record empirical observations accurately.`
    );
  } else if (bullets.length === 1) {
    bullets.push(
      `• Execute standard diagnostic procedures and record empirical observations accurately.`
    );
  }

  return [
    'By the end of the practical session, the trainee should be able to:',
    ...bullets
  ].join('\n');
}

function formatTutorialOutcomes(baseTopic: string, subtopics: string[]): string {
  const focal = subtopics.slice(0, 2).join(' and ') || baseTopic;
  return [
    'By the end of the session, the trainee should be able to:',
    `• Solve quantitative problems, case study scenarios, and review exercises on ${focal}.`,
    `• Synthesize practical findings, review competencies, and evaluate physiological applications of ${baseTopic}.`
  ].join('\n');
}

function schemeSuggestion(
  content: UnknownRow[],
  weekNumber: number,
  unitName = '',
  sessionIndexInWeek = 0,
) {
  const rows = content.filter((row) => {
    const seq = asNumber(row.sequence ?? row.weekNumber ?? row.week, -1);
    return seq === weekNumber;
  });

  if (rows.length === 0) {
    return {
      topic: '',
      objectives: '',
      deliveryMode: sessionIndexInWeek > 0 ? 'practical' : 'theory',
    };
  }

  const activeRow = rows[0] || {};
  const baseTopic = rows
    .map((row) => asString(row.topic ?? row.topicTitle).trim())
    .filter(Boolean)[0] || unitName || 'Scheduled Topic';

  const subtopics = parseSchemeSubtopics(activeRow.subTopics ?? activeRow.coverage);

  // 1. Assessment Weeks (CAT, Midterm, Summative Examination)
  if (isAssessmentTopic(baseTopic)) {
    const isCat = isCatTopic(baseTopic);
    if (isCat) {
      if (sessionIndexInWeek === 0) {
        return {
          topic: baseTopic,
          objectives: [
            'By the end of the assessment session, the trainee should be able to:',
            '• Complete comprehensive test questions evaluating mastery of competencies covered in preceding weeks.',
            '• Apply critical thinking and analytical problem-solving to continuous assessment tasks.'
          ].join('\n'),
          deliveryMode: 'theory',
        };
      }
      return {
        topic: `${baseTopic} (Review & Remediation)`,
        objectives: [
          'By the end of the review session, the trainee should be able to:',
          '• Review assessment items, discuss marking criteria, and identify areas requiring academic remediation.',
          '• Resolve common errors and consolidate core competencies in metabolic pathway regulation.'
        ].join('\n'),
        deliveryMode: 'theory',
      };
    } else {
      if (sessionIndexInWeek === 0) {
        return {
          topic: baseTopic,
          objectives: [
            'By the end of the examination session, the trainee should be able to:',
            '• Demonstrate comprehensive summative mastery of all unit learning outcomes and syllabus competencies.',
            '• Complete official end-of-term examination papers adhering to institutional examination regulations.'
          ].join('\n'),
          deliveryMode: 'theory',
        };
      }
      return {
        topic: `${baseTopic} (Evaluation & Course Wrap-up)`,
        objectives: [
          'By the end of the session, the trainee should be able to:',
          '• Conclude all unit academic assessments, verify examination submissions, and complete term evaluation.'
        ].join('\n'),
        deliveryMode: 'theory',
      };
    }
  }

  // 2. Multi-session practical / applied work (Session 2 in week)
  if (sessionIndexInWeek === 1) {
    return {
      topic: `${baseTopic} (Practical Application)`,
      objectives: formatPracticalOutcomes(baseTopic, subtopics),
      deliveryMode: 'practical',
    };
  }

  // 3. Multi-session tutorial / case analysis (Session 3+ in week)
  if (sessionIndexInWeek >= 2) {
    return {
      topic: `${baseTopic} (Tutorial & Practical Case Analysis)`,
      objectives: formatTutorialOutcomes(baseTopic, subtopics),
      deliveryMode: 'practical',
    };
  }

  // 4. Session 1: Theory & Core Concepts read directly from Scheme of Work
  const rawOutcomes = rows
    .map((row) => {
      const outcomes = row.specificLearningOutcomes ?? row.learningOutcomes ?? row.objectives ?? row.outcomes;
      const text = Array.isArray(outcomes)
        ? outcomes.join('\n')
        : asString(outcomes).trim();
      return cleanMojibakeText(text);
    })
    .filter(Boolean)[0] || '';

  return {
    topic: baseTopic,
    objectives: formatTheoryOutcomes(rawOutcomes, subtopics, baseTopic),
    deliveryMode: 'theory',
  };
}

function matchesAllocation({
  item,
  allocationId,
  unitId,
  cohortId,
  trainerId,
  historicalSessionIds,
}: {
  item: UnknownRow;
  allocationId: string;
  unitId: string;
  cohortId: string;
  trainerId: string;
  historicalSessionIds: Set<string>;
}): boolean {
  const embeddedAllocationId =
    asNullableString(
      item.teachingAllocationId,
    );

  if (
    embeddedAllocationId
  ) {
    return (
      embeddedAllocationId ===
      allocationId
    );
  }

  const sessionId =
    asNullableString(
      item.id,
    );

  if (
    sessionId &&
    historicalSessionIds.has(
      sessionId,
    )
  ) {
    return true;
  }

  const itemUnitId =
    asNullableString(
      item.unitId,
    );

  const itemTrainerId =
    asNullableString(
      item.trainerId,
    );

  const itemCohortId =
    asNullableString(
      item.cohortId,
    );

  if (
    itemUnitId !==
      unitId ||
    itemTrainerId !==
      trainerId
  ) {
    return false;
  }

  if (
    !itemCohortId
  ) {
    return true;
  }

  return (
    itemCohortId ===
    cohortId
  );
}

function mapSubmittedEntry(
  row: UnknownRow,
): OnlineRecordOfWorkEntry {
  const startTime =
    normalizeTime(
      row.start_time,
    );

  const endTime =
    normalizeTime(
      row.end_time,
    );

  const reviewStatus =
    asString(
      row.review_status,
    );

  return {
    id:
      asString(
        row.id,
      ),
    allocationId:
      asString(
        row.allocation_id,
      ),
    timetableVersionId:
      asString(
        row.timetable_version_id,
      ),
    timetableVersionNumber:
      asNumber(
        row.timetable_version_number,
        1,
      ),
    timetableTitle:
      asString(
        row.timetable_title,
      ),
    timetableSessionId:
      asString(
        row.timetable_session_id,
      ),
    schemeDocumentVersionId:
      asNullableString(
        row.scheme_document_version_id,
      ),
    weekNumber:
      asNumber(
        row.week_number,
        1,
      ),
    sessionNumber:
      asNumber(
        row.session_number,
        1,
      ),
    sessionDate:
      asString(
        row.occurrence_date,
      ),
    startTime,
    endTime,
    timeLabel:
      timeLabel(
        startTime,
        endTime,
      ),
    workCovered: (() => {
      let topic = asString(row.topic_covered).trim();
      if (topic.includes(': ') && !topic.includes('(')) {
        topic = topic.split(/:\s+/)[0].trim() || topic;
      }
      return topic;
    })(),
    outcomesAchieved: (() => {
      let objectives = asString(row.objectives).trim();
      return objectives
        .replaceAll('â€¢', '•')
        .replaceAll('Â·', '·')
        .replaceAll('â€”', '—')
        .replaceAll('â€“', '–')
        .replaceAll('ÃƒÆ’Ã†â€™', '');
    })(),
    deliveryMode:
      asString(
        row.delivery_mode,
      ),
    remarks:
      asString(
        row.remarks,
      ),
    classRepresentativeName:
      asNullableString(
        row.class_representative_name,
      ),
    classRepresentativeConfirmedAt:
      asNullableString(
        row.class_representative_confirmed_at,
      ),
    trainerSignature:
      asString(
        row.trainer_name_snapshot,
      ),
    signedAt:
      asString(
        row.submitted_at,
      ),
    hodStatus:
      reviewStatus ===
        'approved'
        ? 'approved'
        : reviewStatus ===
            'returned'
          ? 'returned'
          : 'pending',
  };
}

export async function getOnlineRecordOfWorkContext(
  allocationId: string,
): Promise<OnlineRecordOfWorkContext | null> {
  const profile =
    await requireTrainerAccess();

  const db =
    createAdminClient() as any;

  const {
    data:
      allocation,
  } =
    await db
      .from(
        'teaching_allocations',
      )
      .select(
        `
          id,
          academic_period_id,
          cohort_id,
          unit_id,
          trainer_id,
          academic_periods (
            id,
            code,
            name,
            status,
            teaching_starts_on,
            teaching_ends_on
          ),
          cohorts (
            id,
            code,
            name,
            programme_id,
            current_academic_period_number
          ),
          units (
            id,
            code,
            name,
            academic_period_number
          ),
          trainers (
            id,
            profile_id,
            full_name,
            staff_number
          )
        `,
      )
      .eq(
        'id',
        allocationId,
      )
      .maybeSingle();

  if (
    !allocation
  ) {
    return null;
  }

  const period =
    one(
      allocation.academic_periods,
    ) as UnknownRow | null;

  const cohort =
    one(
      allocation.cohorts,
    ) as UnknownRow | null;

  const unit =
    one(
      allocation.units,
    ) as UnknownRow | null;

  const trainer =
    one(
      allocation.trainers,
    ) as UnknownRow | null;

  if (
    !period ||
    !cohort ||
    !unit ||
    !trainer
  ) {
    return null;
  }

  if (
    profile.role ===
      'trainer' &&
    asString(
      trainer.profile_id,
    ) !==
      profile.id
  ) {
    return null;
  }

  const programmeId =
    asString(
      cohort.programme_id,
    );

  const {
    data:
      programme,
  } =
    programmeId
      ? await db
          .from(
            'programmes',
          )
          .select(
            'id,code,name,department_id',
          )
          .eq(
            'id',
            programmeId,
          )
          .maybeSingle()
      : {
          data:
            null,
        };

  const departmentId =
    asNullableString(
      programme
        ?.department_id,
    );

  const {
    data:
      department,
  } =
    departmentId
      ? await db
          .from(
            'departments',
          )
          .select(
            'id,code,name',
          )
          .eq(
            'id',
            departmentId,
          )
          .maybeSingle()
      : {
          data:
            null,
        };

  const {
    data:
      timetableVersion,
  } =
    departmentId
      ? await db
          .from(
            'timetable_versions',
          )
          .select(
            'id,version_number,title,snapshot,published_at',
          )
          .eq(
            'department_id',
            departmentId,
          )
          .eq(
            'academic_period_id',
            allocation.academic_period_id,
          )
          .eq(
            'status',
            'published',
          )
          .order(
            'version_number',
            {
              ascending:
                false,
            },
          )
          .limit(
            1,
          )
          .maybeSingle()
      : {
          data:
            null,
        };

  const {
    data:
      legacySessions,
  } =
    await db
      .from(
        'scheduled_sessions',
      )
      .select(
        'id',
      )
      .eq(
        'teaching_allocation_id',
        allocationId,
      );

  const historicalSessionIds =
    new Set<string>(
      (
        legacySessions ??
        []
      ).map(
        (
          row: UnknownRow,
        ) =>
          asString(
            row.id,
          ),
      ),
    );

  const {
    data:
      schemeDocument,
  } =
    await db
      .from(
        'curriculum_document_versions',
      )
      .select(
        'id,version_number,payload',
      )
      .eq(
        'unit_id',
        allocation.unit_id,
      )
      .eq(
        'document_type',
        'scheme_of_work',
      )
      .eq(
        'status',
        'active',
      )
      .order(
        'version_number',
        {
          ascending:
            false,
        },
      )
      .limit(
        1,
      )
      .maybeSingle();

  let schemeContent: UnknownRow[] = [];

  try {
    const { getApprovedCurriculumForUnitCode } = await import('../curriculum-content/queries');
    const { getAssessmentMilestones } = await import('../assessment-milestones');
    const { generateTVETSchemeOfWork } = await import('../tvet-standards');

    const periodId = asString(allocation.academic_period_id) || undefined;
    const [curriculumDef, milestones] = await Promise.all([
      getApprovedCurriculumForUnitCode(asString(unit.code), asString(unit.name), 'scheme_of_work'),
      getAssessmentMilestones(periodId),
    ]);

    const tvetHeader = {
      institutionName: 'Imperial College of Medical & Health Sciences',
      departmentName: asString(department?.name) || profile.departmentName || 'Department',
      academicPeriodName: asString(period.name),
      academicPeriodId: periodId,
      unitCode: asString(unit.code),
      unitName: asString(unit.name),
      cohortName: asString(cohort.name),
      trainerName: profile.fullName || 'Trainer',
      totalNominalHours: 42,
      weeklyHours: 3,
    };

    const generatedScheme = generateTVETSchemeOfWork(tvetHeader, curriculumDef, milestones);
    if (generatedScheme?.plannedWeeks && generatedScheme.plannedWeeks.length > 0) {
      schemeContent = generatedScheme.plannedWeeks.map((pw) => ({
        sequence: pw.weekNumber,
        weekNumber: pw.weekNumber,
        topic: pw.topic,
        topicTitle: pw.topic,
        subTopics: pw.subTopics,
        coverage: pw.subTopics,
        specificLearningOutcomes: pw.specificLearningOutcomes,
        learningOutcomes: pw.specificLearningOutcomes,
      }));
    }
  } catch (err) {
    console.error('Failed to load generated Scheme of Work for Record of Work:', err);
  }

  const {
    data:
      submittedRows,
  } =
    await db
      .from(
        'record_of_work_entries',
      )
      .select(
        '*',
      )
      .eq(
        'allocation_id',
        allocationId,
      )
      .eq(
        'status',
        'submitted',
      )
      .order(
        'occurrence_date',
        {
          ascending:
            true,
        },
      )
      .order(
        'start_time',
        {
          ascending:
            true,
        },
      );

  const entries =
    (
      submittedRows ??
      []
    ).map(
      (
        row: UnknownRow,
      ) => {
        const isBiochemII = /biochemistry\s*ii\b/i.test(asString(unit.name));
        const cleanTopic = asString(row.topic_covered).trim();
        const cleanObj = asString(row.objectives).trim();
        const hasObsoleteBiochemTopic = isBiochemII && /introduction to biochemistry|amino acid anabolism|ornithine cycle/i.test(cleanTopic);
        const isMissingLipidsInBiochem = isBiochemII && (asNumber(row.week_number, 0) === 6 || asNumber(row.week_number, 0) === 7) && /protein metabolism/i.test(cleanTopic);
        const isOutdatedCatInBiochem = isBiochemII && asNumber(row.week_number, 0) === 5 && /continuous assessment/i.test(cleanTopic);
        const isCatAtWeek8InBiochem = isBiochemII && asNumber(row.week_number, 0) === 8 && !/continuous assessment/i.test(cleanTopic);
        const isNucleicAtWeek9InBiochem = isBiochemII && asNumber(row.week_number, 0) === 9 && !/nucleic/i.test(cleanTopic);

        const hasStockBoilerplate = cleanObj.includes('Demonstrate practical procedures and hands-on techniques for') ||
          cleanObj.includes('Execute standard operating procedures and safety measures correctly');

        if (hasObsoleteBiochemTopic || isMissingLipidsInBiochem || isOutdatedCatInBiochem || isCatAtWeek8InBiochem || isNucleicAtWeek9InBiochem || hasStockBoilerplate) {
          const sessIdx = Math.max(0, asNumber(row.session_number, 1) - 1);
          const suggestion = schemeSuggestion(schemeContent, asNumber(row.week_number, 1), asString(unit.name), sessIdx);
          if (suggestion.topic && suggestion.objectives) {
            row.topic_covered = suggestion.topic;
            row.objectives = suggestion.objectives;
          }
        }

        return mapSubmittedEntry(
          row,
        );
      },
    );

  // Asynchronously backfill / clean database rows if any had legacy mojibakes, subtopics, or stock boilerplate
  if (submittedRows && submittedRows.length > 0) {
    for (const row of submittedRows) {
      const originalTopic = asString(row.topic_covered);
      const originalObj = asString(row.objectives);
      let cleanTopic = originalTopic.trim();
      if (cleanTopic.includes(': ') && !cleanTopic.includes('(')) {
        cleanTopic = cleanTopic.split(/:\s+/)[0].trim() || cleanTopic;
      }
      const cleanObj = originalObj
        .replaceAll('â€¢', '•')
        .replaceAll('Â·', '·')
        .replaceAll('â€”', '—')
        .replaceAll('â€“', '–')
        .replaceAll('ÃƒÆ’Ã†â€™', '');

      if (cleanTopic !== originalTopic || cleanObj !== originalObj) {
        db.from('record_of_work_entries')
          .update({ topic_covered: cleanTopic, objectives: cleanObj })
          .eq('id', row.id)
          .then(() => {})
          .catch(() => {});
      }
    }
  }

  const submittedKeys =
    new Set(
      entries.map(
        (entry) =>
          `${entry.sessionDate}:${entry.sessionNumber}`,
      ),
    );

  const startsOn =
    asString(
      period.teaching_starts_on,
    );

  const endsOn =
    asString(
      period.teaching_ends_on,
    );

  const today =
    kenyaToday();

  const occurrences:
  OnlineRecordOfWorkOccurrence[] =
    [];

  const snapshot =
    Array.isArray(
      timetableVersion
        ?.snapshot,
    )
      ? (
          timetableVersion
            .snapshot as
            UnknownRow[]
        )
      : [];

  for (
    const item of
      snapshot
  ) {
    if (
      !matchesAllocation({
        item,
        allocationId,
        unitId:
          asString(
            allocation.unit_id,
          ),
        cohortId:
          asString(
            allocation.cohort_id,
          ),
        trainerId:
          asString(
            allocation.trainer_id,
          ),
        historicalSessionIds,
      })
    ) {
      continue;
    }

    const weekday =
      weekdayNumber(
        item.day,
      );

    const timetableSessionId =
      asString(
        item.id,
      );

    if (
      weekday ===
        null ||
      !timetableSessionId ||
      !startsOn ||
      !endsOn
    ) {
      continue;
    }

    const startTime =
      normalizeTime(
        item.startTime,
      );

    const endTime =
      normalizeTime(
        item.endTime,
      );

    const sessionNumber =
      Math.max(
        1,
        asNumber(
          item.sessionNumber,
          1,
        ),
      );

    for (
      const occurrence of
        occurrenceDates({
          teachingStartsOn:
            startsOn,
          teachingEndsOn:
            endsOn,
          weekday,
        })
    ) {
      const submittedKey =
        `${occurrence.date}:${sessionNumber}`;

      if (
        submittedKeys.has(
          submittedKey,
        )
      ) {
        continue;
      }

      occurrences.push({
        occurrenceKey:
          `${asString(
            timetableVersion?.id,
          )}:${timetableSessionId}:${occurrence.date}`,
        timetableVersionId:
          asString(
            timetableVersion?.id,
          ),
        timetableVersionNumber:
          asNumber(
            timetableVersion
              ?.version_number,
            1,
          ),
        timetableTitle:
          asString(
            timetableVersion
              ?.title,
          ),
        timetableSessionId,
        schemeDocumentVersionId:
          asNullableString(
            schemeDocument
              ?.id,
          ),
        weekNumber:
          occurrence.weekNumber,
        sessionNumber,
        sessionDate:
          occurrence.date,
        startTime,
        endTime,
        timeLabel:
          timeLabel(
            startTime,
            endTime,
          ),
        topicSuggestion: '',
        objectivesSuggestion: '',
        deliveryMode:
          asString(
            item.deliveryMode,
          ) ||
          '',
        canSubmit: occurrence.date <= today,
        timingStatus:
          occurrence.date === today
            ? 'today'
            : occurrence.date < today
              ? 'due'
              : 'scheduled',
      });
    }
  }

  occurrences.sort(
    (
      left,
      right,
    ) =>
      left.sessionDate.localeCompare(
        right.sessionDate,
      ) ||
      left.startTime.localeCompare(
        right.startTime,
      ) ||
      left.sessionNumber -
        right.sessionNumber,
  );

  // Apply sequential session differentiation per week (Session 1 = Theory, Session 2 = Practical Application)
  const weekSessionCounts = new Map<number, number>();

  // 1. Seed with already submitted sessions for each week
  for (const entry of entries) {
    if (entry.weekNumber) {
      const currentCount = weekSessionCounts.get(entry.weekNumber) ?? 0;
      weekSessionCounts.set(entry.weekNumber, currentCount + 1);
    }
  }

  // 2. Evaluate remaining pending occurrences sequentially
  for (const occ of occurrences) {
    const sessionIndex = weekSessionCounts.get(occ.weekNumber) ?? 0;
    weekSessionCounts.set(occ.weekNumber, sessionIndex + 1);

    const suggestion = schemeSuggestion(
      schemeContent,
      occ.weekNumber,
      asString(unit.name),
      sessionIndex
    );

    occ.topicSuggestion = suggestion.topic;
    occ.objectivesSuggestion = suggestion.objectives;
    if (!occ.deliveryMode || occ.deliveryMode === 'Teaching') {
      occ.deliveryMode = suggestion.deliveryMode;
    }
  }

  const periodNumber =
    asNumber(
      cohort.current_academic_period_number ??
        unit.academic_period_number,
      0,
    );

  return {
    allocationId,
    academicPeriodId:
      asString(
        allocation.academic_period_id,
      ),
    unitId:
      asString(
        allocation.unit_id,
      ),
    cohortId:
      asString(
        allocation.cohort_id,
      ),
    trainerId:
      asString(
        allocation.trainer_id,
      ),
    departmentId,
    periodStatus:
      asString(
        period.status,
      ),
    header: {
      institutionName:
        'Imperial College of Medical & Health Sciences',
      departmentName:
        asString(
          department?.name,
        ) ||
        profile.departmentName ||
        'Department',
      programmeName:
        asString(
          programme?.name,
        ) ||
        'Programme',
      programmeCode:
        asString(
          programme?.code,
        ),
      academicPeriodName:
        asString(
          period.name,
        ) ||
        'Academic Period',
      unitCode:
        asString(
          unit.code,
        ),
      unitName:
        asString(
          unit.name,
        ),
      trainerName:
        asString(
          trainer.full_name,
        ) ||
        profile.fullName ||
        'Trainer',
      trainerNumber:
        asString(
          trainer.staff_number,
        ),
      cohortName:
        asString(
          cohort.name,
        ),
      cohortCode:
        asString(
          cohort.code,
        ),
      categoryLevel:
        periodNumber >
        0
          ? `Academic period ${periodNumber}`
          : asString(
              cohort.code,
            ),
      reviewPeriod:
        asString(
          period.name,
        ),
    },
    timetable: {
      available:
        Boolean(
          timetableVersion,
        ),
      id:
        asNullableString(
          timetableVersion
            ?.id,
        ),
      versionNumber:
        timetableVersion
          ? asNumber(
              timetableVersion
                .version_number,
              1,
            )
          : null,
      title:
        asNullableString(
          timetableVersion
            ?.title,
        ),
      publishedAt:
        asNullableString(
          timetableVersion
            ?.published_at,
        ),
    },
    scheme: {
      available:
        Boolean(
          schemeDocument,
        ),
      id:
        asNullableString(
          schemeDocument
            ?.id,
        ),
      versionNumber:
        schemeDocument
          ? asNumber(
              schemeDocument
                .version_number,
              1,
            )
          : null,
    },
    entries,
    occurrences,
  };
}

// Compatibility for the existing per-unit Teaching Documents overview.
export const getRecordOfWorkContext =
  getOnlineRecordOfWorkContext;
