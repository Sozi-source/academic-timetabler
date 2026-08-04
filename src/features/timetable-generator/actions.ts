'use server';

import { revalidatePath } from 'next/cache';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import {
  createGeneratorPreview,
} from './data-adapter';
import {
  getGeneratorSourceData,
} from './queries';
import {
  parseGeneratorRequest,
} from './request-validation';
import type {
  GeneratorActionState,
  GeneratorPersistActionState,
} from './server-types';

export async function generateTimetablePreviewAction(
  _previousState: GeneratorActionState,
  formData: FormData,
): Promise<GeneratorActionState> {
  await requireHodAccess();

  const parsed =
    parseGeneratorRequest(
      formData,
    );

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the generator form and correct the highlighted field.',
      fieldErrors:
        parsed.fieldErrors,
    };
  }

  try {
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

interface SaveGeneratedTimetableResult {
  generation_run_id: string;
  saved_session_count: number;
  locked_session_count: number;
  unscheduled_session_count: number;
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

    return {
      status: 'success',
      message: `${result.saved_session_count} generated session${result.saved_session_count === 1 ? '' : 's'} saved as a draft. ${result.locked_session_count} locked session${result.locked_session_count === 1 ? '' : 's'} preserved.`,
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
