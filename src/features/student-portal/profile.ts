import { z } from 'zod';

export const studentProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(180),
  kcseIndexNumber: z
    .string()
    .trim()
    .min(11, 'KCSE index number is required (e.g. 12345678/001).')
    .refine(
      (value) => /^(\d{8}\/\d{3}|\d{11})$/.test(value.replace(/\s+/g, '')),
      'Enter a valid KCSE index number (12345678/001 or 11 digits).',
    ),
  nationalIdNumber: z
    .string()
    .trim()
    .min(7, 'National ID number is required (7–8 digits).')
    .refine(
      (value) => /^\d{7,8}$/.test(value.replace(/\s+/g, '')),
      'National ID must contain 7 or 8 digits.',
    ),
  phoneNumber: z
    .string()
    .trim()
    .min(7, 'Phone number is required (7–30 characters).')
    .max(30),
  birthCertificateEntryNumber: z
    .string()
    .trim()
    .min(4, 'Birth certificate entry number is required.')
    .max(40),
  email: z.string().trim().email('Enter a valid email address.').max(254).optional().or(z.literal('')),
});

export function getMissingKnecBiodataFields(profile: {
  kcseIndexNumber?: string | null;
  nationalIdNumber?: string | null;
  phoneNumber?: string | null;
  birthCertificateEntryNumber?: string | null;
} | null | undefined): string[] {
  const missing: string[] = [];
  if (!profile?.kcseIndexNumber?.trim()) missing.push('KCSE Index Number');
  if (!profile?.nationalIdNumber?.trim()) missing.push('National ID Number');
  if (!profile?.phoneNumber?.trim()) missing.push('Phone Number');
  if (!profile?.birthCertificateEntryNumber?.trim()) missing.push('Birth Certificate Entry Number');
  return missing;
}
