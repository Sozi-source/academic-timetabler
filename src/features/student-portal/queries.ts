import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  createAdminClient,
} from '@/lib/supabase/admin';
import {
  teachingDocumentLabel,
  type TeachingDocumentType,
} from '@/features/teaching-documents/domain';

import {
  deriveStudentRegistrationState,
} from './domain';
import type {
  StudentPortalDocument,
  StudentPortalIdentity,
  StudentPortalPeriod,
  StudentPortalProfileDetails,
  StudentPortalRegistrationContext,
  StudentPortalResult,
  StudentPortalTimetableSession,
  StudentPortalUnit,
} from './types';

type UnknownRow =
  Record<string, unknown>;

function asString(
  value: unknown,
): string | null {
  return typeof value ===
    'string'
    ? value
    : null;
}

function asNumber(
  value: unknown,
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  if (
    typeof value ===
      'string' &&
    value.trim()
  ) {
    const parsed =
      Number(
        value,
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  }

  return null;
}

function adminClient():
SupabaseClient {
  return createAdminClient() as unknown as
    SupabaseClient;
}

async function rowsByIds(
  admin:
    SupabaseClient,
  table:
    string,
  ids:
    string[],
): Promise<UnknownRow[]> {
  const uniqueIds =
    [
      ...new Set(
        ids.filter(
          Boolean,
        ),
      ),
    ];

  if (
    uniqueIds.length ===
    0
  ) {
    return [];
  }

  const {
    data,
    error,
  } =
    await admin
      .from(
        table,
      )
      .select(
        '*',
      )
      .in(
        'id',
        uniqueIds,
      );

  if (error) {
    throw new Error(
      `Unable to load ${table}: ${error.message}`,
    );
  }

  return (
    data ??
    []
  ) as UnknownRow[];
}

function mapById(
  rows:
    UnknownRow[],
) {
  const map =
    new Map<
      string,
      UnknownRow
    >();

  for (
    const row of
      rows
  ) {
    const id =
      asString(
        row.id,
      );

    if (id) {
      map.set(
        id,
        row,
      );
    }
  }

  return map;
}

export async function getStudentPortalIdentity(
  studentId: string,
): Promise<StudentPortalIdentity | null> {
  const admin =
    adminClient();

  const {
    data,
    error,
  } =
    await admin
      .from(
        'students',
      )
      .select(
        `
          id,
          admission_number,
          full_name,
          lifecycle_status,
          current_cohort_id,
          details_verified_at,
          programme:programmes!students_programme_id_fkey(code, name),
          department:departments!students_department_id_fkey(name),
          current_cohort:cohorts!students_current_cohort_id_fkey(
            id,
            name,
            current_academic_period_number
          )
        `,
      )
      .eq(
        'id',
        studentId,
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load student portal identity: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  const programme =
    Array.isArray(
      data.programme,
    )
      ? data.programme[0]
      : data.programme;

  const department =
    Array.isArray(
      data.department,
    )
      ? data.department[0]
      : data.department;

  const cohort =
    Array.isArray(
      data.current_cohort,
    )
      ? data.current_cohort[0]
      : data.current_cohort;

  if (
    !programme ||
    !department
  ) {
    return null;
  }

  return {
    id:
      data.id as
        string,
    admissionNumber:
      data.admission_number as
        string,
    fullName:
      data.full_name as
        string,
    programmeName:
      programme.name as
        string,
    programmeCode:
      programme.code as
        string,
    departmentName:
      department.name as
        string,
    cohortId:
      cohort
        ? cohort.id as
            string
        : null,
    cohortName:
      cohort
        ? cohort.name as
            string
        : null,
    academicPeriodNumber:
      cohort
        ? Number(
            cohort.current_academic_period_number,
          )
        : null,
    lifecycleStatus:
      data.lifecycle_status as
        string,
    detailsVerifiedAt:
      data.details_verified_at as
        string |
        null,
  };
}

export async function getActiveStudentPortalPeriod():
Promise<StudentPortalPeriod | null> {
  const admin =
    adminClient();

  const {
    data,
    error,
  } =
    await admin
      .from(
        'academic_periods',
      )
      .select(
        'id, code, name, starts_on, ends_on',
      )
      .eq(
        'status',
        'active',
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load active academic period: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return {
    id:
      data.id as
        string,
    code:
      data.code as
        string,
    name:
      data.name as
        string,
    startsOn:
      data.starts_on as
        string,
    endsOn:
      data.ends_on as
        string,
  };
}

export async function getStudentPortalUnits(
  studentId:
    string,
  academicPeriodId?:
    string | null,
): Promise<StudentPortalUnit[]> {
  const admin =
    adminClient();

  const period =
    academicPeriodId
      ? null
      : await getActiveStudentPortalPeriod();

  const periodId =
    academicPeriodId ??
    period?.id ??
    null;

  if (!periodId) {
    return [];
  }

  const {
    data,
    error,
  } =
    await admin
      .from(
        'student_unit_registrations',
      )
      .select(
        'id, unit_id, registration_status, source, registered_at',
      )
      .eq(
        'student_id',
        studentId,
      )
      .eq(
        'academic_period_id',
        periodId,
      );

  if (error) {
    throw new Error(
      `Unable to load student units: ${error.message}`,
    );
  }

  const registrations =
    (
      data ??
      []
    ) as UnknownRow[];

  const units =
    await rowsByIds(
      admin,
      'units',
      registrations
        .map(
          (row) =>
            asString(
              row.unit_id,
            ),
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(
              value,
            ),
        ),
    );

  const unitById =
    mapById(
      units,
    );

  return registrations
    .map(
      (
        row,
      ): StudentPortalUnit | null => {
        const id =
          asString(
            row.id,
          );

        const unitId =
          asString(
            row.unit_id,
          );

        const unit =
          unitId
            ? unitById.get(
                unitId,
              )
            : undefined;

        if (
          !id ||
          !unitId ||
          !unit
        ) {
          return null;
        }

        return {
          registrationId:
            id,
          unitId,
          unitCode:
            asString(
              unit.code,
            ) ??
            '',
          unitName:
            asString(
              unit.name,
            ) ??
            'Unit',
          registrationStatus:
            asString(
              row.registration_status,
            ) ??
            'registered',
          source:
            asString(
              row.source,
            ) ??
            'department',
          registeredAt:
            asString(
              row.registered_at,
            ) ??
            '',
        };
      },
    )
    .filter(
      (
        unit,
      ): unit is
        StudentPortalUnit =>
        Boolean(
          unit,
        ),
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.unitName
          .localeCompare(
            right.unitName,
          ),
    );
}

export async function getStudentPortalRegistrationContext(
  studentId:
    string,
): Promise<StudentPortalRegistrationContext | null> {
  const [
    student,
    period,
  ] =
    await Promise.all([
      getStudentPortalIdentity(
        studentId,
      ),
      getActiveStudentPortalPeriod(),
    ]);

  if (!student) {
    return null;
  }

  if (!period) {
    return {
      student,
      period:
        null,
      submission:
        null,
      registrationState:
        'not_registered',
      units:
        [],
    };
  }

  const admin =
    adminClient();

  const [
    units,
    submissionResult,
  ] =
    await Promise.all([
      getStudentPortalUnits(
        studentId,
        period.id,
      ),
      admin
        .from(
          'student_unit_registration_submissions',
        )
        .select(
          'id, status, verification_note, submitted_at, verified_at',
        )
        .eq(
          'student_id',
          studentId,
        )
        .eq(
          'academic_period_id',
          period.id,
        )
        .maybeSingle(),
    ]);

  if (
    submissionResult.error
  ) {
    throw new Error(
      `Unable to load registration state: ${submissionResult.error.message}`,
    );
  }

  const submission =
    submissionResult.data
      ? {
          id:
            submissionResult
              .data.id as
              string,
          status:
            submissionResult
              .data.status,
          verificationNote:
            submissionResult
              .data.verification_note as
              string |
              null,
          submittedAt:
            submissionResult
              .data.submitted_at as
              string |
              null,
          verifiedAt:
            submissionResult
              .data.verified_at as
              string |
              null,
        }
      : null;

  return {
    student,
    period,
    submission,
    registrationState:
      deriveStudentRegistrationState(
        units,
        submission
          ?.status ??
          null,
      ),
    units,
  };
}

export async function getStudentPortalTimetable(
  studentId:
    string,
): Promise<StudentPortalTimetableSession[]> {
  const [
    student,
    period,
  ] =
    await Promise.all([
      getStudentPortalIdentity(
        studentId,
      ),
      getActiveStudentPortalPeriod(),
    ]);

  if (
    !student
      ?.cohortId ||
    !period
  ) {
    return [];
  }

  const admin =
    adminClient();

  const { data: publishedVersion } = await admin
    .from('timetable_versions')
    .select('id, status, snapshot')
    .eq('academic_period_id', period.id)
    .eq('status', 'published')
    .limit(1)
    .maybeSingle();

  if (!publishedVersion || !publishedVersion.snapshot) {
    return [];
  }

  const snapshotRaw = (publishedVersion.snapshot || []) as any[];
  const sessions = snapshotRaw.filter((row: any) => {
    const primaryCohortId = asString(row.cohortId);
    const participantCohortIds = Array.isArray(row.participantCohortIds)
      ? (row.participantCohortIds as string[])
      : [];
    return (
      primaryCohortId === student.cohortId ||
      participantCohortIds.includes(student.cohortId)
    );
  });

  if (sessions.length === 0) {
    return [];
  }

  // Fetch time slots to map startTime to sequence numbers
  const { data: slotsData } = await admin
    .from('time_slots')
    .select('starts_at, sequence_number')
    .eq('academic_period_id', period.id);

  const slotSequenceMap = new Map<string, number>();
  if (slotsData) {
    for (const slot of slotsData) {
      if (slot.starts_at) {
        slotSequenceMap.set(
          asString(slot.starts_at),
          asNumber(slot.sequence_number) ?? 99,
        );
      }
    }
  }

  return sessions
    .map(
      (
        row,
      ): StudentPortalTimetableSession | null => {
        const id = asString(row.id);
        const unitId = asString(row.unitId);
        const startsAt = asString(row.startTime) ?? '';

        if (!id || !unitId) {
          return null;
        }

        return {
          id,
          dayName: asString(row.day) ?? 'day',
          daySequence: asNumber(row.daySequence) ?? 99,
          startSequence: slotSequenceMap.get(startsAt) ?? 99,
          startsAt,
          endsAt: asString(row.endTime) ?? '',
          unitId,
          unitName: asString(row.unitName) ?? 'Unit',
          trainerName: asString(row.trainerName) ?? 'Trainer',
          roomLabel:
            asString(row.roomName) ??
            asString(row.roomCode) ??
            'Unallocated',
          deliveryMode: asString(row.deliveryMode) ?? 'teaching',
        };
      },
    )
    .filter(
      (
        session,
      ): session is StudentPortalTimetableSession =>
        Boolean(session),
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.daySequence - right.daySequence ||
        left.startSequence - right.startSequence ||
        left.unitName.localeCompare(right.unitName),
    );
}

export async function getStudentPortalResults(
  studentId:
    string,
): Promise<StudentPortalResult[]> {
  const admin =
    adminClient();

  const {
    data,
    error,
  } =
    await admin
      .from(
        'assessment_results',
      )
      .select(
        '*',
      )
      .eq(
        'student_id',
        studentId,
      );

  if (error) {
    throw new Error(
      `Unable to load student results: ${error.message}`,
    );
  }

  const results =
    (
      data ??
      []
    ) as UnknownRow[];

  const events =
    await rowsByIds(
      admin,
      'assessment_events',
      results
        .map(
          (row) =>
            asString(
              row.assessment_event_id,
            ),
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(
              value,
            ),
        ),
    );

  const publishedEvents =
    events.filter(
      (event) =>
        Boolean(
          asString(
            event.published_at,
          ),
        ) &&
        [
          'cat',
          'exam',
        ].includes(
          asString(
            event.operational_assessment_type,
          ) ??
            '',
        ),
    );

  const eventById =
    mapById(
      publishedEvents,
    );

  const [
    units,
    periods,
  ] =
    await Promise.all([
      rowsByIds(
        admin,
        'units',
        publishedEvents
          .map(
            (event) =>
              asString(
                event.unit_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
      rowsByIds(
        admin,
        'academic_periods',
        publishedEvents
          .map(
            (event) =>
              asString(
                event.academic_period_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
    ]);

  const unitById =
    mapById(
      units,
    );

  const periodById =
    mapById(
      periods,
    );

  const {
    data:
      ruleRows,
    error:
      ruleError,
  } =
    await admin
      .from(
        'assessment_rules',
      )
      .select(
        '*',
      );

  if (ruleError) {
    throw new Error(
      `Unable to load assessment rules: ${ruleError.message}`,
    );
  }

  const ruleByScope =
    new Map<
      string,
      UnknownRow
    >();

  for (
    const rule of
      (
        ruleRows ??
        []
      ) as UnknownRow[]
  ) {
    const periodId =
      asString(
        rule.academic_period_id,
      );

    const unitId =
      asString(
        rule.unit_id,
      );

    const type =
      asString(
        rule.assessment_type,
      );

    if (
      periodId &&
      unitId &&
      type
    ) {
      ruleByScope.set(
        `${periodId}:${unitId}:${type}`,
        rule,
      );
    }
  }

  return results
    .map(
      (
        result,
      ): StudentPortalResult | null => {
        const id =
          asString(
            result.id,
          );

        const assessmentId =
          asString(
            result.assessment_event_id,
          );

        const event =
          assessmentId
            ? eventById.get(
                assessmentId,
              )
            : undefined;

        if (
          !id ||
          !assessmentId ||
          !event
        ) {
          return null;
        }

        const type =
          asString(
            event.operational_assessment_type,
          );

        const unitId =
          asString(
            event.unit_id,
          );

        const periodId =
          asString(
            event.academic_period_id,
          );

        const publishedAt =
          asString(
            event.published_at,
          );

        if (
          (
            type !==
              'cat' &&
            type !==
              'exam'
          ) ||
          !unitId ||
          !periodId ||
          !publishedAt
        ) {
          return null;
        }

        const rule =
          ruleByScope.get(
            `${periodId}:${unitId}:${type}`,
          );

        const rawComponents =
          result.component_marks &&
          typeof result.component_marks ===
            'object' &&
          !Array.isArray(
            result.component_marks,
          )
            ? result.component_marks as
                UnknownRow
            : null;

        const componentMarks =
          type ===
            'exam' &&
          rawComponents
            ? {
                assignment:
                  asNumber(
                    rawComponents.assignment,
                  ),
                presentation:
                  asNumber(
                    rawComponents.presentation,
                  ),
                rat:
                  asNumber(
                    rawComponents.rat,
                  ),
                cat:
                  asNumber(
                    rawComponents.cat1,
                  ) ??
                  asNumber(
                    rawComponents.cat,
                  ),
                ratCatAverage:
                  asNumber(
                    rawComponents.ratCatAverage,
                  ),
                coursework:
                  asNumber(
                    rawComponents.coursework,
                  ),
                exam:
                  asNumber(
                    rawComponents.exam,
                  ),
              }
            : null;

        return {
          id,
          assessmentId,
          assessmentType:
            type,
          unitId,
          unitName:
            asString(
              unitById.get(
                unitId,
              )?.name,
            ) ??
            'Unit',
          periodName:
            asString(
              periodById.get(
                periodId,
              )?.name,
            ) ??
            'Academic Period',
          mark:
            asNumber(
              result.operational_mark,
            ),
          maximumMark:
            asNumber(
              rule?.maximum_mark,
            ),
          passMark:
            asNumber(
              rule?.pass_mark,
            ),
          resultStatus:
            asString(
              result.operational_result_status,
            ) ??
            'pending',
          componentMarks,
          publishedAt,
        };
      },
    )
    .filter(
      (
        result,
      ): result is
        StudentPortalResult =>
        Boolean(
          result,
        ),
    )
    .sort(
      (
        left,
        right,
      ) =>
        right.publishedAt
          .localeCompare(
            left.publishedAt,
          ) ||
        left.unitName.localeCompare(
          right.unitName,
        ),
    );
}

export async function getStudentPortalDocuments(
  studentId:
    string,
): Promise<StudentPortalDocument[]> {
  const student =
    await getStudentPortalIdentity(
      studentId,
    );

  if (
    !student
      ?.cohortId
  ) {
    return [];
  }

  const admin =
    adminClient();

  const {
    data,
    error,
  } =
    await admin
      .from(
        'teaching_documents',
      )
      .select(
        'id, unit_id, document_type, version_number, approved_at, student_published_at, status',
      )
      .eq(
        'cohort_id',
        student.cohortId,
      )
      .eq(
        'status',
        'approved',
      )
      .not(
        'student_published_at',
        'is',
        null,
      );

  if (error) {
    throw new Error(
      `Unable to load student documents: ${error.message}`,
    );
  }

  const rows =
    (
      data ??
      []
    ) as UnknownRow[];

  const units =
    await rowsByIds(
      admin,
      'units',
      rows
        .map(
          (row) =>
            asString(
              row.unit_id,
            ),
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(
              value,
            ),
        ),
    );

  const unitById =
    mapById(
      units,
    );

  return rows
    .map(
      (
        row,
      ): StudentPortalDocument | null => {
        const id =
          asString(
            row.id,
          );

        const unitId =
          asString(
            row.unit_id,
          );

        const documentType =
          asString(
            row.document_type,
          );

        if (
          !id ||
          !unitId ||
          !documentType
        ) {
          return null;
        }

        return {
          id,
          documentType:
            teachingDocumentLabel(
              documentType as
                TeachingDocumentType,
            ),
          unitName:
            asString(
              unitById.get(
                unitId,
              )?.name,
            ) ??
            'Unit',
          versionNumber:
            asNumber(
              row.version_number,
            ) ??
            1,
          approvedAt:
            asString(
              row.approved_at,
            ),
        };
      },
    )
    .filter(
      (
        document,
      ): document is
        StudentPortalDocument =>
        Boolean(
          document,
        ),
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.unitName
          .localeCompare(
            right.unitName,
          ) ||
        left.documentType
          .localeCompare(
            right.documentType,
          ),
    );
}

export async function getStudentPortalProfileDetails(
  studentId:
    string,
): Promise<StudentPortalProfileDetails | null> {
  const admin =
    adminClient();

  const {
    data,
    error,
  } =
    await admin
      .from(
        'students',
      )
      .select(
        'admission_number, full_name, kcse_index_number, national_id_number, phone_number, email, details_verified_at',
      )
      .eq(
        'id',
        studentId,
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load student profile: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return {
    admissionNumber:
      data.admission_number as
        string,
    fullName:
      data.full_name as
        string,
    kcseIndexNumber:
      data.kcse_index_number as
        string |
        null,
    nationalIdNumber:
      data.national_id_number as
        string |
        null,
    phoneNumber:
      data.phone_number as
        string |
        null,
    email:
      data.email as
        string |
        null,
    detailsVerifiedAt:
      data.details_verified_at as
        string |
        null,
  };
}
