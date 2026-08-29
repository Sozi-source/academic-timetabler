import { z } from 'zod';

export type ManualEntryActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

export const initialManualEntryState: ManualEntryActionState = {
  status: 'idle',
  message: null,
};

export const manualTrainerEntrySchema = z.object({
  academicPeriodId: z.string().uuid(),
  trainerId: z.string().uuid(),
  workingDayId: z.string().uuid(),
  timeSlotId: z.string().uuid(),
  unitCode: z.string().trim().max(50).optional(),
  unitName: z.string().trim().min(1).max(200),
  cohortLabel: z.string().trim().min(1).max(200),
  sourceDepartmentId: z.string().uuid(),
  roomId: z.union([z.string().uuid(), z.literal('')]),
  notes: z.string().trim().max(1000).optional(),
});

export const manualTrainerVenueSchema = z.object({
  entryId: z.string().uuid(),
  academicPeriodId: z.string().uuid(),
  roomId: z.union([z.string().uuid(), z.literal('')]),
});

export interface ManualEntryOptions {
  trainers: Array<{ id: string; label: string }>;
  departments: Array<{ id: string; label: string }>;
  rooms: Array<{ id: string; label: string }>;
  workingDays: Array<{ id: string; label: string }>;
  timeSlots: Array<{ id: string; label: string }>;
}
