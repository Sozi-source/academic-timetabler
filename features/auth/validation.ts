import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.'),

  password: z
    .string()
    .min(8, 'Password must contain at least 8 characters.'),

  nextPath: z
    .string()
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export function getSafeInternalPath(
  value: string | undefined,
  fallback = '/dashboard',
) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return fallback;
  }

  return value;
}