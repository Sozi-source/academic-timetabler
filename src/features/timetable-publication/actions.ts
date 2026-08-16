'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import {
  getTimetableConflictCenterData,
} from '@/features/timetable-conflicts/queries';

import type { PublicationActionState } from './types';

function refresh() {
  revalidatePath('/timetable/published');
  revalidatePath('/timetable/editor');
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/conflicts');
}

function friendlyPublicationError({
  message,
  academicPeriodId,
}: {
  message: string;
  academicPeriodId: string;
}): PublicationActionState {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('selected-availability')
    || normalized.includes('selected availability')
    || normalized.includes('trainer availability')
  ) {
    return {
      status: 'error',
      title: 'Trainer availability needs attention',
      message:
        'This timetable cannot move forward yet because one or more assigned sessions fall outside the trainer’s saved available times. Review the highlighted conflicts, move those sessions to available periods, then try again.',
      actionHref: `/timetable/conflicts?academicPeriodId=${encodeURIComponent(academicPeriodId)}`,
      actionLabel: 'Review availability conflicts',
    };
  }

  if (normalized.includes('incomplete snapshot')) {
    return {
      status: 'error',
      title: 'Refresh the timetable draft',
      message:
        'The current timetable snapshot is incomplete. Refresh the timetable and try publishing again.',
    };
  }

  if (normalized.includes('conflict')) {
    return {
      status: 'error',
      title: 'Resolve timetable conflicts first',
      message:
        'The timetable still contains a blocking conflict. Correct the highlighted session, then publish again.',
      actionHref: `/timetable/conflicts?academicPeriodId=${encodeURIComponent(academicPeriodId)}`,
      actionLabel: 'Review issues',
    };
  }

  return {
    status: 'error',
    title: 'The timetable was not changed',
    message:
      'We could not complete this step. Check the timetable and try again. If the problem continues, refresh the page before retrying.',
  };
}

async function getPublicationBlocker(
  academicPeriodId: string,
): Promise<PublicationActionState | null> {
  let conflictData: Awaited<
    ReturnType<typeof getTimetableConflictCenterData>
  >;
  try {
    conflictData = await getTimetableConflictCenterData(
      academicPeriodId,
    );
  }
  catch (error) {
    console.error('Publication validation failed.', error);
    return {
      status: 'error',
      title: 'Timetable validation is temporarily unavailable',
      message:
        'The system could not complete the final conflict check. Refresh the page and try publishing again.',
    };
  }

  const blockingCount = conflictData.conflicts.filter(
    (conflict) => conflict.severity === 'blocked',
  ).length;

  if (blockingCount === 0) {
    return null;
  }

  return {
    status: 'error',
    title: 'Resolve timetable conflicts first',
    message:
      `${blockingCount} blocking conflict${
        blockingCount === 1 ? '' : 's'
      } remain. Unassigned trainers and rooms are allowed as warnings, but availability, workload, overlap and hard scheduling constraints must be corrected first.`,
    actionHref: `/timetable/conflicts?academicPeriodId=${encodeURIComponent(academicPeriodId)}`,
    actionLabel: 'Review issues',
  };
}

export async function publishCurrentTimetableAction(
  _previousState: PublicationActionState,
  formData: FormData,
): Promise<PublicationActionState> {
  await requireHodAccess();
  const academicPeriodId = String(
    formData.get('academicPeriodId') ?? '',
  );
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(academicPeriodId)) {
    return {
      status: 'error',
      title: 'Select an Academic Period',
      message: 'Choose the timetable that should be published and try again.',
    };
  }

  const blocker = await getPublicationBlocker(academicPeriodId);
  if (blocker) return blocker;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('publish_current_timetable', {
    target_academic_period_id: academicPeriodId,
  });
  if (error) {
    return friendlyPublicationError({
      message: error.message,
      academicPeriodId,
    });
  }

  const result = data as {
    title?: string;
    versionNumber?: number;
    sessionCount?: number;
    archivedVersionCount?: number;
  } | null;
  const title = result?.title ?? 'The new timetable version';
  const archivedVersionCount = result?.archivedVersionCount ?? 0;

  refresh();
  return {
    status: 'success',
    title: 'Timetable published',
    message: archivedVersionCount > 0
      ? `${title} is now public. The former published version was archived automatically.`
      : `${title} is now public.`,
  };
}
