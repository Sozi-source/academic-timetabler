'use server';

import {
  revalidatePath,
} from 'next/cache';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  createAdminClient,
} from '@/lib/supabase/admin';

import {
  getOnlineRecordOfWorkContext,
} from './queries';

import type { RecordOfWorkActionState } from './types';

function textValue(
  formData: FormData,
  key: string,
): string {
  return String(
    formData.get(
      key,
    ) ??
      '',
  ).trim();
}

function validateText(
  value: string,
  label: string,
  maximum: number,
  required = true,
): string | null {
  if (
    required &&
    !value
  ) {
    return `${label} is required.`;
  }

  if (
    value.length >
    maximum
  ) {
    return `${label} is too long.`;
  }

  return null;
}

async function ensureParentDocument({
  db,
  allocationId,
  profileId,
  academicPeriodId,
  cohortId,
  unitId,
  trainerId,
}: {
  db: any;
  allocationId: string;
  profileId: string;
  academicPeriodId: string;
  cohortId: string;
  unitId: string;
  trainerId: string;
}): Promise<{
  id: string;
  status: string;
} | null> {
  const {
    data:
      existing,
  } =
    await db
      .from(
        'teaching_documents',
      )
      .select(
        'id,status',
      )
      .eq(
        'allocation_id',
        allocationId,
      )
      .eq(
        'document_type',
        'record_of_work',
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

  if (
    existing
  ) {
    return {
      id:
        String(
          existing.id,
        ),
      status:
        String(
          existing.status,
        ),
    };
  }

  const {
    data:
      template,
  } =
    await db
      .from(
        'teaching_document_templates',
      )
      .select(
        'id',
      )
      .eq(
        'document_type',
        'record_of_work',
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

  if (
    !template
  ) {
    return null;
  }

  const {
    data:
      inserted,
    error,
  } =
    await db
      .from(
        'teaching_documents',
      )
      .insert({
        allocation_id:
          allocationId,
        academic_period_id:
          academicPeriodId,
        cohort_id:
          cohortId,
        unit_id:
          unitId,
        trainer_id:
          trainerId,
        document_type:
          'record_of_work',
        template_id:
          template.id,
        version_number:
          1,
        status:
          'draft',
        original_filename:
          '[]',
        created_by:
          profileId,
        updated_by:
          profileId,
      })
      .select(
        'id,status',
      )
      .single();

  if (
    error ||
    !inserted
  ) {
    return null;
  }

  return {
    id:
      String(
        inserted.id,
      ),
    status:
      String(
        inserted.status,
      ),
  };
}

function legacyPayloadEntry(
  row: any,
) {
  return {
    id:
      String(
        row.id,
      ),
    allocationId:
      String(
        row.allocation_id,
      ),
    weekNumber:
      Number(
        row.week_number,
      ),
    sessionDate:
      String(
        row.occurrence_date,
      ),
    workCovered:
      String(
        row.topic_covered,
      ),
    outcomesAchieved:
      String(
        row.objectives,
      ),
    attendanceSummary:
      'Recorded in class attendance sheet.',
    remarks:
      String(
        row.remarks ??
          '',
      ),
    trainerSignature:
      String(
        row.trainer_name_snapshot,
      ),
    signedAt:
      String(
        row.submitted_at,
      ),
    hodStatus:
      String(
        row.review_status ??
          'pending',
      ),
  };
}

async function syncLegacyDocumentPayload({
  db,
  parentDocumentId,
  allocationId,
  profileId,
}: {
  db: any;
  parentDocumentId: string;
  allocationId: string;
  profileId: string;
}) {
  const {
    data:
      rows,
  } =
    await db
      .from(
        'record_of_work_entries',
      )
      .select(
        `
          id,
          allocation_id,
          week_number,
          occurrence_date,
          topic_covered,
          objectives,
          remarks,
          trainer_name_snapshot,
          submitted_at,
          review_status
        `,
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

  const payload =
    JSON.stringify(
      (
        rows ??
        []
      ).map(
        legacyPayloadEntry,
      ),
    );

  await db
    .from(
      'teaching_documents',
    )
    .update({
      original_filename:
        payload,
      updated_at:
        new Date()
          .toISOString(),
      updated_by:
        profileId,
    })
    .eq(
      'id',
      parentDocumentId,
    );
}

export async function submitOnlineRecordOfWorkAction(
  _previousState:
    RecordOfWorkActionState,
  formData:
    FormData,
): Promise<RecordOfWorkActionState> {
  const profile =
    await requireTrainerAccess();

  const allocationId =
    textValue(
      formData,
      'allocationId',
    );

  const occurrenceKey =
    textValue(
      formData,
      'occurrenceKey',
    );

  if (
    !allocationId ||
    !occurrenceKey
  ) {
    return {
      status:
        'error',
      message:
        'The timetable session could not be identified.',
    };
  }

  const context =
    await getOnlineRecordOfWorkContext(
      allocationId,
    );

  if (
    !context
  ) {
    return {
      status:
        'error',
      message:
        'The teaching allocation was not found.',
    };
  }

  const occurrence =
    context.occurrences.find(
      (item) =>
        item.occurrenceKey ===
        occurrenceKey,
    );

  if (
    !occurrence
  ) {
    return {
      status:
        'error',
      message:
        'This lesson is already recorded or is no longer part of the current published timetable.',
    };
  }



  const topicCovered =
    textValue(
      formData,
      'topicCovered',
    );

  const objectives =
    textValue(
      formData,
      'objectives',
    );

  const deliveryMode =
    textValue(
      formData,
      'deliveryMode',
    ) ||
    occurrence.deliveryMode;

  const remarks =
    textValue(
      formData,
      'remarks',
    );

  const classRepresentativeName =
    textValue(
      formData,
      'classRepresentativeName',
    );

  const classRepresentativeConfirmed =
    formData.get(
      'classRepresentativeConfirmed',
    ) ===
    'on';

  const validationError =
    validateText(
      topicCovered,
      'Topic covered',
      4000,
    ) ??
    validateText(
      objectives,
      'Objectives',
      6000,
    ) ??
    validateText(
      deliveryMode,
      'Mode of delivery',
      120,
    ) ??
    validateText(
      remarks,
      'Remarks',
      3000,
      false,
    ) ??
    validateText(
      classRepresentativeName,
      'Class representative name',
      200,
      false,
    );

  if (
    validationError
  ) {
    return {
      status:
        'error',
      message:
        validationError,
    };
  }

  if (
    classRepresentativeConfirmed &&
    !classRepresentativeName
  ) {
    return {
      status:
        'error',
      message:
        'Enter the class representative name before marking confirmation.',
    };
  }

  const db =
    createAdminClient() as any;

  const parentDocument =
    await ensureParentDocument({
      db,
      allocationId,
      profileId:
        profile.id,
      academicPeriodId:
        context.academicPeriodId,
      cohortId:
        context.cohortId,
      unitId:
        context.unitId,
      trainerId:
        context.trainerId,
    });

  if (
    !parentDocument
  ) {
    return {
      status:
        'error',
      message:
        'The online Record of Work document could not be initialized.',
    };
  }

  if (
    [
      'submitted',
      'approved',
      'archived',
    ].includes(
      parentDocument.status,
    )
  ) {
    return {
      status:
        'error',
      message:
        'This Record of Work has already been finalized.',
    };
  }

  const submittedAt =
    new Date()
      .toISOString();

  const {
    error,
  } =
    await db
      .from(
        'record_of_work_entries',
      )
      .insert({
        allocation_id:
          allocationId,
        academic_period_id:
          context.academicPeriodId,
        cohort_id:
          context.cohortId,
        unit_id:
          context.unitId,
        trainer_id:
          context.trainerId,
        timetable_version_id:
          occurrence.timetableVersionId,
        timetable_version_number:
          occurrence.timetableVersionNumber,
        timetable_title:
          occurrence.timetableTitle,
        timetable_session_id:
          occurrence.timetableSessionId,
        scheme_document_version_id:
          occurrence.schemeDocumentVersionId,
        occurrence_date:
          occurrence.sessionDate,
        week_number:
          occurrence.weekNumber,
        session_number:
          occurrence.sessionNumber,
        start_time:
          occurrence.startTime,
        end_time:
          occurrence.endTime,
        topic_covered:
          topicCovered,
        objectives,
        delivery_mode:
          deliveryMode,
        remarks:
          remarks ||
          null,
        class_representative_name:
          classRepresentativeName ||
          null,
        class_representative_confirmed_at:
          classRepresentativeConfirmed
            ? submittedAt
            : null,
        trainer_profile_id:
          profile.id,
        trainer_name_snapshot:
          context.header
            .trainerName,
        status:
          'submitted',
        review_status:
          'pending',
        submitted_at:
          submittedAt,
        created_by:
          profile.id,
      });

  if (
    error
  ) {
    if (
      String(
        error.code,
      ) ===
      '23505'
    ) {
      return {
        status:
          'error',
        message:
          'This lesson has already been recorded.',
      };
    }

    return {
      status:
        'error',
      message:
        error.message ||
        'The lesson could not be recorded.',
    };
  }

  await syncLegacyDocumentPayload({
    db,
    parentDocumentId:
      parentDocument.id,
    allocationId,
    profileId:
      profile.id,
  });

  revalidatePath(
    `/staff/units/${allocationId}/documents`,
  );

  revalidatePath(
    `/staff/units/${allocationId}/documents/record-of-work`,
  );

  revalidatePath(
    `/staff/units/${allocationId}/documents/record-of-work/print`,
  );

  revalidatePath(
    '/staff/documents',
  );

  return {
    status:
      'success',
    message:
      'Lesson recorded.',
  };
}
