'use server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';

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