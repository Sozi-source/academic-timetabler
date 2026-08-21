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

  const {
    data,
    error,
  } =
    await admin
      .from(
        'scheduled_sessions',
      )
      .select(
        '*',
      )
      .eq(
        'academic_period_id',
        period.id,
      )
      .eq(
        'cohort_id',
        student.cohortId,
      )
      .eq(
        'status',
        'locked',
      );

  if (error) {
    throw new Error(
      `Unable to load student timetable: ${error.message}`,
    );
  }

  const sessions =
    (
      data ??
      []
    ) as UnknownRow[];

  if (
    sessions.length ===
    0
  ) {
    return [];
  }

  const [
    days,
    slots,
    units,
    trainers,
    rooms,
  ] =
    await Promise.all([
      rowsByIds(
        admin,
        'working_days',
        sessions
          .map(
            (row) =>
              asString(
                row.working_day_id,
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
        'time_slots',
        sessions
          .flatMap(
            (row) => [
              asString(
                row.start_time_slot_id,
              ),
              asString(
                row.end_time_slot_id,
              ),
            ],
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
        'units',
        sessions
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
      ),
      rowsByIds(
        admin,
        'trainers',
        sessions
          .map(
            (row) =>
              asString(
                row.trainer_id,
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
        'rooms',
        sessions
          .map(
            (row) =>
              asString(
                row.room_id,
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

  const dayById =
    mapById(
      days,
    );

  const slotById =
    mapById(
      slots,
    );

  const unitById =
    mapById(
      units,
    );

  const trainerById =
    mapById(
      trainers,
    );

  const roomById =
    mapById(
      rooms,
    );

  return sessions
    .map(
      (
        row,
      ): StudentPortalTimetableSession | null => {
        const id =
          asString(
            row.id,
          );

        const day =
          dayById.get(
            asString(
              row.working_day_id,
            ) ??
              '',
          );

        const startSlot =
          slotById.get(
            asString(
              row.start_time_slot_id,
            ) ??
              '',
          );

        const endSlot =
          slotById.get(
            asString(
              row.end_time_slot_id,
            ) ??
              '',
          );

        const unitId =
          asString(
            row.unit_id,
          );

        const unit =
          unitById.get(
            unitId ??
              '',
          );

        const trainer =
          trainerById.get(
            asString(
              row.trainer_id,
            ) ??
              '',
          );

        const room =
          roomById.get(
            asString(
              row.room_id,
            ) ??
              '',
          );

        if (
          !id ||
          !unitId ||
          !unit
        ) {
          return null;
        }

        return {
          id,
          dayName:
            asString(
              day?.day_of_week,
            ) ??
            'day',
          daySequence:
            asNumber(
              day?.sequence_number,
            ) ??
            99,
          startSequence:
            asNumber(
              startSlot
                ?.sequence_number,
            ) ??
            99,
          startsAt:
            asString(
              startSlot
                ?.starts_at,
            ) ??
            '',
          endsAt:
            asString(
              endSlot
                ?.ends_at,
            ) ??
            asString(
              startSlot
                ?.ends_at,
            ) ??
            '',
          unitId,
          unitName:
            asString(
              unit.name,
            ) ??
            'Unit',
          trainerName:
            asString(
              trainer
                ?.full_name,
            ) ??
            'Trainer',
          roomLabel:
            asString(
              room
                ?.name,
            ) ??
            'Unallocated',
          deliveryMode:
            asString(
              row.delivery_mode,
            ) ??
            'teaching',
        };
      },
    )
    .filter(
      (
        session,
      ): session is
        StudentPortalTimetableSession =>
        Boolean(
          session,
        ),
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.daySequence -
          right.daySequence ||
        left.startSequence -
          right.startSequence ||
        left.unitName.localeCompare(
          right.unitName,
        ),
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
        'id, unit_id, document_type, version_number, approved_at, status',
      )
      .eq(
        'cohort_id',
        student.cohortId,
      )
      .eq(
        'status',
        'approved',
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
