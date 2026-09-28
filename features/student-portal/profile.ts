import { z } from 'zod';

export const studentProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(180),
  kcseIndexNumber: z.string().trim().optional().refine((value) => !value || /^(\d{8}\/\d{3}|\d{11})$/.test(value.replace(/\s+/g, '')), 'Enter a valid KCSE index number.'),
  nationalIdNumber: z.string().trim().optional().refine((value) => !value || /^\d{7,8}$/.test(value.replace(/\s+/g, '')), 'National ID must contain 7 or 8 digits.'),
  phoneNumber: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Enter a valid email address.').max(254).optional().or(z.literal('')),
});
