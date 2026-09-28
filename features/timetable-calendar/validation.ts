import { z } from 'zod';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(value: string) {
  const [hours, minutes] = value
    .split(':')
    .map(Number);

  return hours * 60 + minutes;
}

export const workingDayFormSchema = z.object({
  academicPeriodId: z.uuid(
    'Select a valid Academic Period.',
  ),

  dayOfWeek: z.enum([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]),

  sequenceNumber: z.coerce
    .number()
    .int('The sequence must be a whole number.')
    .min(1, 'The sequence must be at least 1.')
    .max(7, 'The sequence cannot exceed 7.'),

  notes: z
    .string()
    .trim()
    .max(
      500,
      'Notes cannot exceed 500 characters.',
    )
    .optional(),
});

export const timeSlotFormSchema = z
  .object({
    academicPeriodId: z.uuid(
      'Select a valid Academic Period.',
    ),

    name: z
      .string()
      .trim()
      .min(2, 'Enter a time slot name.')
      .max(
        80,
        'The name cannot exceed 80 characters.',
      ),

    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, 'Enter a time slot code.')
      .max(
        30,
        'The code cannot exceed 30 characters.',
      )
      .regex(
        /^[A-Z0-9-]+$/,
        'Use letters, numbers and hyphens only.',
      ),

    slotType: z.enum([
      'teaching',
      'break',
      'lunch',
      'assembly',
      'other',
    ]),

    startsAt: z
      .string()
      .regex(
        timePattern,
        'Enter a valid start time.',
      ),

    endsAt: z
      .string()
      .regex(
        timePattern,
        'Enter a valid end time.',
      ),

    sequenceNumber: z.coerce
      .number()
      .int('The sequence must be a whole number.')
      .min(1, 'The sequence must be at least 1.')
      .max(50, 'The sequence cannot exceed 50.'),

    notes: z
      .string()
      .trim()
      .max(
        500,
        'Notes cannot exceed 500 characters.',
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      timePattern.test(value.startsAt) &&
      timePattern.test(value.endsAt) &&
      timeToMinutes(value.endsAt) <=
        timeToMinutes(value.startsAt)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message:
          'The end time must be after the start time.',
      });
    }
  });

export const timetableCalendarIdSchema = z.uuid(
  'The record identifier is invalid.',
);

export const academicPeriodIdSchema = z.uuid(
  'The Academic Period identifier is invalid.',
);