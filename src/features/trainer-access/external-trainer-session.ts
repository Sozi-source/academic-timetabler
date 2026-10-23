import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

import { getServerEnvironment } from '@/lib/validation/environment';

export const externalTrainerSessionCookieName = 'external-trainer-session';

export function createExternalTrainerSessionToken(profileId: string): string {
  const signature = createHmac('sha256', getServerEnvironment().SUPABASE_SERVICE_ROLE_KEY)
    .update(profileId)
    .digest('hex');

  return `${profileId}.${signature}`;
}

export async function isExternalTrainerSession(profileId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(externalTrainerSessionCookieName)?.value;
  const [cookieProfileId, signature] = value?.split('.') ?? [];

  if (!cookieProfileId || cookieProfileId !== profileId || !signature) {
    return false;
  }

  const expectedSignature = createExternalTrainerSessionToken(profileId).split('.')[1];
  if (!expectedSignature) {
    return false;
  }

  const expected = Buffer.from(expectedSignature, 'hex');
  const received = Buffer.from(signature, 'hex');

  return received.length === expected.length && timingSafeEqual(received, expected);
}
