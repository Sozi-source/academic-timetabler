import { redirect } from 'next/navigation';

import { getAuthenticatedProfile } from './queries';
import type {
  AppRole,
  AuthenticatedProfile,
} from './types';

export async function requireAuthenticatedProfile():
Promise<AuthenticatedProfile> {
  const profile = await getAuthenticatedProfile();

  if (!profile) {
    redirect('/login');
  }

  return profile;
}

export async function requireRole(
  allowedRoles: readonly AppRole[],
): Promise<AuthenticatedProfile> {
  const profile =
    await requireAuthenticatedProfile();

  if (!allowedRoles.includes(profile.role)) {
    redirect('/unauthorized');
  }

  return profile;
}

export async function requireHodAccess():
Promise<AuthenticatedProfile> {
  return requireRole([
    'hod',
    'system_admin',
  ]);
}