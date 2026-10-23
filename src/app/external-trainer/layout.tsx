import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getAuthenticatedProfile } from '@/features/auth/queries';
import { ExternalTrainerShell } from '@/features/trainer-access/external-trainer-shell';

export default async function ExternalTrainerLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const profile = await getAuthenticatedProfile();

  if (!profile) {
    redirect('/external-trainer/login');
  }

  if (profile.role !== 'trainer') {
    redirect('/unauthorized');
  }

  return (
    <ExternalTrainerShell trainerName={profile.fullName}>
      {children}
    </ExternalTrainerShell>
  );
}
