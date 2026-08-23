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

function schemeSuggestion(
  content: UnknownRow[],
  weekNumber: number,
  _unitName = '',
) {
  const rows = content.filter((row) => {
    const seq = asNumber(row.sequence ?? row.weekNumber ?? row.week, -1);
    return seq === weekNumber;
  });

  if (rows.length === 0) {
    return {
      topic: '',
      objectives: '',
    };
  }

  // User requirement: For topic covered only insert the topic and NO sub-topics
  const topics = rows
    .map((row) => asString(row.topic ?? row.topicTitle).trim())
    .filter(Boolean);

  const objectives = rows
    .map((row) => {
      const rawOutcomes = row.specificLearningOutcomes ?? row.learningOutcomes ?? row.objectives ?? row.outcomes;
      let text = Array.isArray(rawOutcomes)
        ? rawOutcomes.join('\n')
        : asString(rawOutcomes).trim();

      // Clean all mojibakes
      text = text
        .replaceAll('â€¢', '•')
        .replaceAll('Â·', '·')
        .replaceAll('â€”', '—')
        .replaceAll('â€“', '–')
        .replaceAll('ÃƒÆ’Ã†â€™', '');

      return text;
    })
    .filter(Boolean);

  return {
    topic: topics.length > 0 ? [...new Set(topics)].join('; ') : '',
    objectives: objectives.length > 0 ? [...new Set(objectives)].join('\n') : '',
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
    workCovered:
      asString(
        row.topic_covered,
      ),
    outcomesAchieved:
      asString(
        row.objectives,
      ),
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

    const [curriculumDef, milestones] = await Promise.all([
      getApprovedCurriculumForUnitCode(asString(unit.code), asString(unit.name)),
      getAssessmentMilestones(),
    ]);

    const tvetHeader = {
      institutionName: 'Imperial College of Medical & Health Sciences',
      departmentName: asString(department?.name) || profile.departmentName || 'Department',
      academicPeriodName: asString(period.name),
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
      ) =>
        mapSubmittedEntry(
          row,
        ),
    );

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

      const suggestion = schemeSuggestion(
        schemeContent,
        occurrence.weekNumber,
        asString(unit.name)
      );

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
        topicSuggestion:
          suggestion.topic,
        objectivesSuggestion:
          suggestion.objectives,
        deliveryMode:
          asString(
            item.deliveryMode,
          ) ||
          'Teaching',
        canSubmit:
          occurrence.date <=
          today,
        timingStatus:
          occurrence.date ===
            today
            ? 'today'
            : occurrence.date <
                today
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
