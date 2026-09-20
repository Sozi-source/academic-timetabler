'use server';

import { revalidatePath } from 'next/cache';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import {
  createAutomaticPlannerInput,
  createGeneratorPreview,
} from './data-adapter';
import {
  evaluateTrainerExchangeSuggestion,
} from './exchange-repair';
import {
  isProtectedTimetableExchangeError,
} from './exchange-action-validation';
import {
  generateTimetablePlan,
} from './planner';
import {
  getGeneratorSourceData,
} from './queries';
import {
  parseGeneratorRequest,
} from './request-validation';
import type {
  GeneratorActionState,
  GeneratorDraftLifecycleActionState,
  GeneratorExchangeActionState,
  GeneratorPersistActionState,
  GeneratorResetActionState,
} from './server-types';

function readExchangeRequest(formData: FormData) {
  return {
    academicPeriodId: String(formData.get('academicPeriodId') ?? ''),
    targetTeachingAllocationId: String(
      formData.get('targetTeachingAllocationId') ?? '',
    ),
    targetSessionNumber: Number(
      formData.get('targetSessionNumber') ?? 0,
    ),
    partnerTeachingAllocationId: String(
      formData.get('partnerTeachingAllocationId') ?? '',
    ),
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * A shared class must be delivered by exactly one live allocation. If the
 * database ever holds two, the generator would place the class twice and it
 * would collide with itself, so generation and saving stop with a clear message.
 */
async function findDuplicateSharedAllocationMessage(
  academicPeriodId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'audit_duplicate_shared_allocations',
    { p_academic_period_id: academicPeriodId },
  );

  if (error) {
    throw new Error(
      `Unable to verify shared-class allocations: ${error.message}`,
    );
  }

  const rows = (data ?? []) as Array<{
    unit_code: string;
    cohort_code: string;
    keep_rank: number;
  }>;

  if (rows.length === 0) {
    return null;
  }

  const listed = rows
    .map((row) => `${row.unit_code} (${row.cohort_code})`)
    .join(', ');

  return `A shared class has more than one live allocation: ${listed}. Retire the duplicate (run retire_duplicate_shared_allocations) before generating or saving.`;
}

export async function clearTimetableHistoryAction(
  _previousState: GeneratorResetActionState,
  formData: FormData,
): Promise<GeneratorResetActionState> {
  await requireHodAccess();

  const academicPeriodId = String(formData.get('academicPeriodId') ?? '');
  const confirmed = formData.get('confirmReset') === 'CLEAR';

  if (!isUuid(academicPeriodId) || !confirmed) {
    return {
      status: 'error',
      message: 'Select the confirmation checkbox before clearing timetable history.',
      academicPeriodId,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('clear_department_timetable_history_authorized', {
    target_academic_period_id: academicPeriodId,
  });

  if (error) {
    return {
      status: 'error',
      message: `Timetable history was not cleared: ${error.message}`,
      academicPeriodId,
    };
  }

  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/editor');
  revalidatePath('/timetable/conflicts');
  revalidatePath('/timetable/published');
  revalidatePath('/timetable/reports');

  const result = data as {
    deletedSessions?: number;
    deletedGenerationRuns?: number;
    deletedVersions?: number;
    deletedAttendanceSessions?: number;
    deletedRecordOfWorkEntries?: number;
    deletedDailyReportLessons?: number;
    deletedDailyReports?: number;
  } | null;

  return {
    status: 'success',
    message: `Clean slate created: ${result?.deletedRecordOfWorkEntries ?? 0} record-of-work entries, ${result?.deletedDailyReportLessons ?? 0} daily-report lessons, ${result?.deletedDailyReports ?? 0} empty daily reports, ${result?.deletedAttendanceSessions ?? 0} attendance sessions, ${result?.deletedSessions ?? 0} timetable sessions, ${result?.deletedGenerationRuns ?? 0} generation runs and ${result?.deletedVersions ?? 0} timetable versions removed. Allocations and setup were preserved.`,
    academicPeriodId,
  };
}

export async function generateTimetablePreviewAction(
  _previousState: GeneratorActionState,
  formData: FormData,
): Promise<GeneratorActionState> {
  await requireHodAccess();

  const parsed =
    parseGeneratorRequest(
      formData,
    );

  if (parsed.success === false) {
    return {
      status: 'error',
      message:
        'Review the generator form and correct the highlighted field.',
      fieldErrors:
        parsed.fieldErrors,
    };
  }

  try {
    const duplicateAllocationMessage =
      await findDuplicateSharedAllocationMessage(
        parsed.data.academicPeriodId,
      );

    if (duplicateAllocationMessage) {
      return {
        status: 'error',
        message: duplicateAllocationMessage,
      };
    }

    const sourceData =
      await getGeneratorSourceData(
        parsed.data.academicPeriodId,
      );

    if (!sourceData) {
      return {
        status: 'error',
        message:
          'The selected Academic Period could not be found.',
        fieldErrors: {
          academicPeriodId: [
            'Select an Academic Period that still exists.',
          ],
        },
      };
    }

    const preview =
      createGeneratorPreview({
        sourceData,
        overwriteExisting:
          parsed.data
            .overwriteExisting,
      });

    if (!preview.readiness.isReady) {
      return {
        status: 'error',
        message:
          'The timetable cannot be generated until the readiness issues are resolved.',
        preview,
      };
    }

    const scheduledCount =
      preview.statistics
        .scheduledSessionCount;

    const unscheduledCount =
      preview.statistics
        .unscheduledSessionCount;

    const blockedCount =
      preview.statistics
        .blockedConflictCount;

    if (
      !parsed.data.overwriteExisting &&
      scheduledCount === 0 &&
      unscheduledCount === 0 &&
      preview.readiness
        .existingSessionCount > 0
    ) {
      return {
        status: 'success',
        message:
          `All ${preview.readiness.existingSessionCount} existing session${
            preview.readiness.existingSessionCount === 1
              ? ''
              : 's'
          } already satisfy the timetable requirements. Select Replace existing editable sessions to build a fresh preview.`,
        preview,
      };
    }

    if (
      scheduledCount === 0 &&
      unscheduledCount > 0
    ) {
      return {
        status: 'error',
        message:
          `No sessions could be scheduled. ${unscheduledCount} session${
            unscheduledCount === 1
              ? ''
              : 's'
          } remain unresolved.`,
        preview,
      };
    }

    if (
      unscheduledCount > 0 ||
      blockedCount > 0
    ) {
      return {
        status: 'success',
        message:
          `Timetable preview generated with ${scheduledCount} scheduled session${
            scheduledCount === 1
              ? ''
              : 's'
          } and ${unscheduledCount} unresolved session${
            unscheduledCount === 1
              ? ''
              : 's'
          }.`,
        preview,
      };
    }

    return {
      status: 'success',
      message:
        `Timetable preview generated successfully with ${scheduledCount} session${
          scheduledCount === 1
            ? ''
            : 's'
        }.`,
      preview,
    };
  }
  catch (error) {
    console.error(
      'Timetable preview generation failed.',
      error,
    );

    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'The timetable preview could not be generated.',
    };
  }
}

export async function applyTrainerExchangeAction(
  _previousState: GeneratorExchangeActionState,
  formData: FormData,
): Promise<GeneratorExchangeActionState> {
  await requireHodAccess();

  const request = readExchangeRequest(formData);
  const exchangeAttempt = {
    academicPeriodId:
      request.academicPeriodId,
    targetTeachingAllocationId:
      request.targetTeachingAllocationId,
    targetSessionNumber:
      request.targetSessionNumber,
    partnerTeachingAllocationId:
      request.partnerTeachingAllocationId,
  };
  if (
    !isUuid(request.academicPeriodId) ||
    !isUuid(request.targetTeachingAllocationId) ||
    !isUuid(request.partnerTeachingAllocationId) ||
    !Number.isInteger(request.targetSessionNumber) ||
    request.targetSessionNumber < 1
  ) {
    return {
      status: 'error',
      message: 'The selected trainer exchange is incomplete. Regenerate the preview and try again.',
      ...exchangeAttempt,
    };
  }

  try {
    const sourceData = await getGeneratorSourceData(
      request.academicPeriodId,
    );
    if (!sourceData) {
      return {
        status: 'error',
        message: 'The selected Academic Period could not be found.',
        ...exchangeAttempt,
      };
    }

    const plannerInput = createAutomaticPlannerInput({
      sourceData,
      overwriteExisting: true,
    });
    const baseline = generateTimetablePlan(plannerInput);
    const suggestion = evaluateTrainerExchangeSuggestion({
      input: plannerInput,
      baseline,
      targetTeachingAllocationId:
        request.targetTeachingAllocationId,
      targetSessionNumber:
        request.targetSessionNumber,
      partnerTeachingAllocationId:
        request.partnerTeachingAllocationId,
    });

    if (!suggestion) {
      return {
        status: 'error',
        message: 'That exchange is no longer a valid repair. Regenerate the preview to see the current options.',
        ...exchangeAttempt,
      };
    }

    const targetTrainerName = sourceData.trainers.find((trainer) =>
      trainer.id === suggestion.targetTrainerId,
    )?.fullName ?? 'The original trainer';
    const partnerTrainerName = sourceData.trainers.find((trainer) =>
      trainer.id === suggestion.partnerTrainerId,
    )?.fullName ?? 'The exchange trainer';
    const partnerAllocation = sourceData.allocations.find((allocation) =>
      allocation.id === suggestion.partnerTeachingAllocationId,
    );
    const partnerUnitCode = sourceData.units.find((unit) =>
      unit.id === partnerAllocation?.unitId,
    )?.code ?? 'the exchanged unit';

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      'apply_same_department_trainer_exchange',
      {
        target_allocation_id:
          suggestion.targetTeachingAllocationId,
        partner_allocation_id:
          suggestion.partnerTeachingAllocationId,
        // The RPC still blocks any review, approved or published version.
        // Once the dedicated lifecycle action has made the timetable
        // editable, this permits replacement of its affected locked sessions.
        allow_protected_reopen:
          true,
      },
    );

    if (error) {
      const requiresTimetableReopen =
        isProtectedTimetableExchangeError(error.message);

      return {
        status: 'error',
        message: requiresTimetableReopen
          ? 'This timetable is protected. Select Return timetable to draft, then apply the exchange again.'
            : `The exchange was not applied: ${error.message}`,
        requiresTimetableReopen,
        ...exchangeAttempt,
      };
    }

    const exchangeResult = data as {
      reopenedVersionCount?: number;
      archivedPublishedVersionCount?: number;
    } | null;
    const reopenedVersionCount =
      exchangeResult?.reopenedVersionCount ?? 0;
    const archivedPublishedVersionCount =
      exchangeResult?.archivedPublishedVersionCount ?? 0;
    const reopenSummary = archivedPublishedVersionCount > 0
      ? ' The previous published snapshot was archived safely and remains in timetable history.'
      : reopenedVersionCount > 0
        ? ' The protected timetable was returned to draft automatically and the transition was recorded.'
        : '';

    const updatedSourceData = {
      ...sourceData,
      allocations: sourceData.allocations.map((allocation) => {
        if (allocation.id === suggestion.targetTeachingAllocationId) {
          return {
            ...allocation,
            trainerId: suggestion.partnerTrainerId,
          };
        }

        if (allocation.id === suggestion.partnerTeachingAllocationId) {
          return {
            ...allocation,
            trainerId: suggestion.targetTrainerId,
          };
        }

        return allocation;
      }),
    };
    const preview = createGeneratorPreview({
      sourceData: updatedSourceData,
      overwriteExisting: true,
      includeExchangeSuggestions: false,
    });

    revalidatePath('/timetable/generator');
    revalidatePath('/timetable/teaching-allocations');
    revalidatePath('/timetable/editor');
    revalidatePath('/timetable/conflicts');
    revalidatePath('/timetable/readiness');

    return {
      status: 'success',
      message:
        `${partnerTrainerName} now takes the unresolved unit and ${targetTrainerName} takes ${partnerUnitCode}.${reopenSummary} Review the regenerated preview, then select Save draft timetable to save the new placements.`,
      preview,
      requiresTimetableReopen: false,
      ...exchangeAttempt,
    };
  }
  catch (error) {
    console.error('Smart trainer exchange failed.', error);
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'The trainer exchange could not be applied.',
      ...exchangeAttempt,
    };
  }
}

export async function returnTimetableToEditableDraftAction(
  _previousState: GeneratorDraftLifecycleActionState,
  formData: FormData,
): Promise<GeneratorDraftLifecycleActionState> {
  await requireHodAccess();

  const academicPeriodId = String(
    formData.get('academicPeriodId') ?? '',
  );
  if (!isUuid(academicPeriodId)) {
    return {
      status: 'error',
      message: 'Select a valid Academic Period before returning the timetable to draft.',
      academicPeriodId,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      'return_timetable_to_editable_draft',
      {
        target_academic_period_id: academicPeriodId,
      },
    );

    if (error) {
      return {
        status: 'error',
        message: `The timetable could not be returned to draft: ${error.message}`,
        academicPeriodId,
      };
    }

    const result = data as {
      reopenedVersionCount?: number;
      archivedPublishedVersionCount?: number;
    } | null;
    const reopenedVersionCount =
      result?.reopenedVersionCount ?? 0;
    const archivedPublishedVersionCount =
      result?.archivedPublishedVersionCount ?? 0;

    revalidatePath('/timetable/generator');
    revalidatePath('/timetable/published');
    revalidatePath('/timetable/editor');
    revalidatePath('/timetable/conflicts');

    const message = archivedPublishedVersionCount > 0
      ? 'The published snapshot was archived safely and remains in history. The live timetable is now editable; apply the exchange again.'
      : reopenedVersionCount > 0
        ? 'The timetable was returned to draft and the audit history was updated. Apply the exchange again.'
        : 'The timetable is already editable. Apply the exchange again.';

    return {
      status: 'success',
      message,
      academicPeriodId,
      reopenedVersionCount,
      archivedPublishedVersionCount,
    };
  }
  catch (error) {
    console.error('Return timetable to draft failed.', error);
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'The timetable could not be returned to draft.',
      academicPeriodId,
    };
  }
}

interface SaveGeneratedTimetableResult {
  generation_run_id: string;
  saved_session_count: number;
  locked_session_count: number;
  unscheduled_session_count: number;
  skipped_overflow_session_count?: number;
  skipped_overflow_allocation_ids?: string[];
}

export async function saveGeneratedTimetableDraftAction(
  _previousState: GeneratorPersistActionState,
  formData: FormData,
): Promise<GeneratorPersistActionState> {
  await requireHodAccess();

  const parsed = parseGeneratorRequest(formData);
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Select a valid Academic Period before saving the draft timetable.',
    };
  }

  try {
    const duplicateAllocationMessage =
      await findDuplicateSharedAllocationMessage(parsed.data.academicPeriodId);
    if (duplicateAllocationMessage) {
      return { status: 'error', message: duplicateAllocationMessage };
    }

    const sourceData = await getGeneratorSourceData(parsed.data.academicPeriodId);
    if (!sourceData) {
      return { status: 'error', message: 'The selected Academic Period could not be found.' };
    }

    const preview = createGeneratorPreview({
      sourceData,
      overwriteExisting: true,
    });

    if (!preview.readiness.isReady) {
      return {
        status: 'error',
        message: 'The timetable is not ready to save. Resolve all readiness blockers first.',
      };
    }

    if (preview.statistics.unscheduledSessionCount > 0) {
      return {
        status: 'error',
        message: `${preview.statistics.unscheduledSessionCount} required session${preview.statistics.unscheduledSessionCount === 1 ? '' : 's'} remain unscheduled. Resolve them before saving the draft.`,
      };
    }

    if (preview.statistics.blockedConflictCount > 0) {
      return {
        status: 'error',
        message: 'The generated timetable contains blocked conflicts and cannot be saved.',
      };
    }

    const supabase = await createClient();

    // Ensure teaching_allocations duration matches the scheduled session duration before database trigger validation
    const sessionAllocations120 = Array.from(
      new Set(
        preview.sessions
          .filter((s) => s.durationMinutes === 120)
          .map((s) => s.teachingAllocationId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (sessionAllocations120.length > 0) {
      await supabase
        .from('teaching_allocations')
        .update({
          session_duration_minutes: 120,
          is_full_day_session: false,
          updated_at: new Date().toISOString(),
        })
        .in('id', sessionAllocations120)
        .neq('session_duration_minutes', 120);
    }

    const sessionAllocations480 = Array.from(
      new Set(
        preview.sessions
          .filter((s) => s.durationMinutes >= 480)
          .map((s) => s.teachingAllocationId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (sessionAllocations480.length > 0) {
      await supabase
        .from('teaching_allocations')
        .update({
          session_duration_minutes: 480,
          is_full_day_session: true,
          updated_at: new Date().toISOString(),
        })
        .in('id', sessionAllocations480)
        .neq('session_duration_minutes', 480);
    }

    const payload = preview.sessions.map((session) => ({
      academicPeriodId: session.academicPeriodId,
      teachingAllocationId: session.teachingAllocationId,
      cohortId: session.cohortId,
      unitId: session.unitId,
      trainerId: session.trainerId,
      workingDayId: session.workingDayId,
      startTimeSlotId: session.startTimeSlotId,
      endTimeSlotId: session.endTimeSlotId,
      roomId: session.roomId,
      sessionNumber: session.sessionNumber,
      deliveryMode: session.deliveryMode,
      isLocked: session.isLocked,
    }));

    const { data, error } = await supabase.rpc('save_generated_timetable_draft', {
      target_academic_period_id: parsed.data.academicPeriodId,
      generated_sessions: payload,
      generation_summary: {
        requestedSessionCount: preview.statistics.requestedSessionCount,
        scheduledSessionCount: preview.statistics.scheduledSessionCount,
        unscheduledSessionCount: preview.statistics.unscheduledSessionCount,
        conflictCount: preview.statistics.conflictCount,
        blockedConflictCount: preview.statistics.blockedConflictCount,
        warningCount: preview.statistics.warningCount,
        trainerUtilizationPercentage: preview.statistics.trainerUtilizationPercentage,
        roomUtilizationPercentage: preview.statistics.roomUtilizationPercentage,
        generatedAt: preview.generatedAt,
      },
    });

    if (error) {
      return { status: 'error', message: `The draft timetable could not be saved: ${error.message}` };
    }

    const result = (data as SaveGeneratedTimetableResult[] | null)?.[0];
    if (!result) {
      return { status: 'error', message: 'The timetable save completed without returning a generation result.' };
    }

    revalidatePath('/timetable/generator');
    revalidatePath('/timetable/editor');
    revalidatePath('/timetable/conflicts');
    revalidatePath('/timetable/published');
    revalidatePath('/timetable/reports');

    const skippedOverflowCount = result.skipped_overflow_session_count ?? 0;
    const skippedOverflowAllocationIds = result.skipped_overflow_allocation_ids ?? [];
    const overflowNote = skippedOverflowCount > 0
      ? ` ${skippedOverflowCount} generated session${skippedOverflowCount === 1 ? '' : 's'} could not be saved because ${skippedOverflowAllocationIds.length === 1 ? 'a teaching allocation' : 'some teaching allocations'} already had all required weekly sessions scheduled — check allocation${skippedOverflowAllocationIds.length === 1 ? '' : 's'} ${skippedOverflowAllocationIds.join(', ')}.`
      : '';

    return {
      status: 'success',
      message: `${result.saved_session_count} generated session${result.saved_session_count === 1 ? '' : 's'} saved as a draft. ${result.locked_session_count} locked session${result.locked_session_count === 1 ? '' : 's'} preserved.${overflowNote}`,
      generationRunId: result.generation_run_id,
      savedSessionCount: result.saved_session_count,
      lockedSessionCount: result.locked_session_count,
      unscheduledSessionCount: result.unscheduled_session_count,
    };
  }
  catch (error) {
    console.error('Timetable draft persistence failed.', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'The draft timetable could not be saved.',
    };
  }
}