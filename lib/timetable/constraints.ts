export const hardConstraintCodes = [
  'TRAINER_DOUBLE_BOOKED',
  'COHORT_DOUBLE_BOOKED',
  'ROOM_DOUBLE_BOOKED',
  'TRAINER_UNAVAILABLE',
  'COHORT_UNAVAILABLE',
  'ROOM_UNAVAILABLE',
  'ROOM_CAPACITY_EXCEEDED',
  'ROOM_TYPE_MISMATCH',
  'BREAK_SLOT_USED',
  'NON_CONSECUTIVE_SESSION',
] as const;

export const softConstraintCodes = [
  'TRAINER_TIME_PREFERENCE',
  'EXCESSIVE_CONSECUTIVE_HOURS',
  'COHORT_TIMETABLE_GAP',
  'REPEATED_UNIT_SAME_DAY',
  'LATE_FRIDAY_SESSION',
] as const;

export type HardConstraintCode =
  (typeof hardConstraintCodes)[number];

export type SoftConstraintCode =
  (typeof softConstraintCodes)[number];
