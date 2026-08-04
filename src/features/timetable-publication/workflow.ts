import type { TimetableVersionStatus } from './types';

export function getAllowedTimetableTransitions(
  status: TimetableVersionStatus,
): TimetableVersionStatus[] {
  switch (status) {
    case 'draft':
      return ['under_review'];
    case 'under_review':
      return ['approved', 'draft'];
    case 'approved':
      return ['published', 'under_review'];
    case 'published':
      return ['archived'];
    case 'archived':
      return [];
  }
}

export function getTransitionLabel(status: TimetableVersionStatus) {
  switch (status) {
    case 'under_review': return 'Submit for review';
    case 'approved': return 'Approve timetable';
    case 'published': return 'Publish timetable';
    case 'archived': return 'Archive timetable';
    case 'draft': return 'Return to draft';
  }
}
