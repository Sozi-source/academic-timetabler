import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => value === null || value === undefined || String(value).trim() === '' ? undefined : String(value).trim(),
  z.string().optional(),
);

const optionalDate = z.preprocess(
  (value) => value === null || value === undefined || String(value).trim() === '' ? undefined : String(value).trim(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.').optional(),
);

const optionalKcseIndex = z.preprocess(
  (value) => value === null || value === undefined || String(value).trim() === '' ? undefined : String(value).replace(/\s+/g, ''),
  z.string().regex(/^(\d{8}\/\d{3}|\d{11})$/, 'Use a valid KCSE index number, e.g. 12345678/001.').optional(),
);

const optionalNationalId = z.preprocess(
  (value) => value === null || value === undefined || String(value).trim() === '' ? undefined : String(value).replace(/\s+/g, ''),
  z.string().regex(/^\d{7,8}$/, 'National ID must contain 7 or 8 digits.').optional(),
);

export const studentImportBaseSchema = z.object({
  admissionNumber: z.preprocess((value) => String(value ?? '').trim().toUpperCase(), z.string().min(3, 'Admission Number is required.').max(80)),
  fullName: z.preprocess((value) => String(value ?? '').trim(), z.string().min(2, 'Full Name is required.').max(180)),
  programmeCode: optionalText,
  admissionCohortCode: optionalText,
  currentCohortCode: optionalText,
  currentCohortEffectiveDate: optionalDate,
  lifecycleStatus: z.preprocess(
    (value) => String(value ?? '').trim().toLowerCase(),
    z.enum(['active','deferred','dropped_out','completed','graduated'], { message: 'Select Active, Deferred, Dropped out, Completed or Graduated.' }),
  ),
  academicPhase: z.preprocess(
    (value) => String(value ?? 'in_class').trim().toLowerCase() || 'in_class',
    z.enum(['in_class','clinical_rotation','attachment','deferred','dropped_out','awaiting_graduation','graduated']),
  ),
  statusEffectiveDate: optionalDate,
  statusReason: optionalText,
  admissionDate: optionalDate,
  projectedCompletionDate: optionalDate,
  kcseIndexNumber: optionalKcseIndex,
  nationalIdNumber: optionalNationalId,
  notes: optionalText,
});
