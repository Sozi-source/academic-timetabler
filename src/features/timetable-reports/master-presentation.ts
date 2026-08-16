import type { TimetableReportRow } from './types';

export interface MasterSessionPresentation {
  unitName: string;
  trainer: string;
  venue: string;
}

export function getMasterSessionPresentation(
  row: TimetableReportRow,
): MasterSessionPresentation {
  const hasAssignedVenue = Boolean(row.roomCode);
  const roomName = row.roomName.trim();

  return {
    unitName: row.unitName.trim() || 'Unnamed unit',
    trainer: row.trainerId
      ? row.trainer
      : 'Unassigned',
    venue: hasAssignedVenue
      ? roomName && roomName !== 'No room assigned'
        ? roomName
        : row.roomCode ?? 'Unallocated'
      : 'Unallocated',
  };
}
