'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  PublicationActionState,
  TimetableVersionStatus,
} from './types';
import { getAllowedTimetableTransitions } from './workflow';

function refresh() {
  revalidatePath('/timetable/published');
  revalidatePath('/timetable/editor');
  revalidatePath('/timetable/generator');
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
      title: 'Create an updated version',
      message:
        'This version no longer matches the current timetable. Create a new version from the latest timetable, then continue with approval.',
    };
  }

  if (normalized.includes('conflict')) {
    return {
      status: 'error',
      title: 'Resolve timetable conflicts first',
      message:
        'The timetable still contains a blocking conflict. Open Conflict review, correct the highlighted session, then try again.',
      actionHref: `/timetable/conflicts?academicPeriodId=${encodeURIComponent(academicPeriodId)}`,
      actionLabel: 'Open Conflict review',
    };
  }

  return {
    status: 'error',
    title: 'The timetable was not changed',
    message:
      'We could not complete this step. Check the timetable and try again. If the problem continues, refresh the page before retrying.',
  };
}

export async function createTimetableVersionAction(
  _previousState: PublicationActionState,
  formData: FormData,
): Promise<PublicationActionState> {
  await requireHodAccess();
  const academicPeriodId = String(formData.get('academicPeriodId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const changeSummary = String(formData.get('changeSummary') ?? '').trim();
  if (!academicPeriodId || title.length < 3) {
    return {
      status: 'error',
      title: 'Add a version title',
      message: 'Select an Academic Period and enter a clear title of at least three characters.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_timetable_version', {
    target_academic_period_id: academicPeriodId,
    version_title: title,
    version_change_summary: changeSummary || null,
  });
  if (error) {
    return friendlyPublicationError({
      message: error.message,
      academicPeriodId,
    });
  }
  refresh();
  return {
    status: 'success',
    title: 'Version created',
    message: 'The current timetable has been saved as a new controlled version.',
  };
}

export async function transitionTimetableVersionAction(
  _previousState: PublicationActionState,
  formData: FormData,
): Promise<PublicationActionState> {
  await requireHodAccess();
  const versionId = String(formData.get('versionId') ?? '');
  const academicPeriodId = String(formData.get('academicPeriodId') ?? '');
  const currentStatus = String(formData.get('currentStatus') ?? '') as TimetableVersionStatus;
  const targetStatus = String(formData.get('targetStatus') ?? '') as TimetableVersionStatus;
  const note = String(formData.get('note') ?? '').trim();
  if (!versionId || !getAllowedTimetableTransitions(currentStatus).includes(targetStatus)) {
    return {
      status: 'error',
      title: 'Refresh this timetable version',
      message: 'The version status has changed or this action is no longer available. Refresh the page and try again.',
    };
  }
  if (['approved', 'published', 'archived'].includes(targetStatus) && note.length < 3) {
    return {
      status: 'error',
      title: 'Add a short note',
      message: 'Enter a brief approval or publication note before continuing.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_timetable_version', {
    target_version_id: versionId,
    target_status: targetStatus,
    transition_note: note || null,
  });
  if (error) {
    return friendlyPublicationError({
      message: error.message,
      academicPeriodId,
    });
  }
  refresh();
  const successMessages: Record<TimetableVersionStatus, string> = {
    draft: 'The timetable has been returned to draft.',
    under_review: 'The timetable has been submitted for review.',
    approved: 'The timetable has been approved.',
    published: 'The timetable has been published successfully.',
    archived: 'The timetable has been archived.',
  };

  return {
    status: 'success',
    title: 'Timetable updated',
    message: successMessages[targetStatus],
  };
}
