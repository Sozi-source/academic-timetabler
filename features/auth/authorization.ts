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

/**
 * Trainer workspace access is capability-based.
 *
 * HODs and system administrators are often also trainers, so they must not
 * lose their management role merely to use the trainer portal. The trainer
 * workspace subsequently verifies that the authenticated profile is linked
 * to an active trainer record and allocated to the requested unit.
 */
export async function requireTrainerAccess():
Promise<AuthenticatedProfile> {
  return requireRole([
    'trainer',
    'hod',
    'system_admin',
  ]);
}
