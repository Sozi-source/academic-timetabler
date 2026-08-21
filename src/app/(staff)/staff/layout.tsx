import type {
  ReactNode,
} from 'react';

import {
  StaffShell,
} from '@/components/staff/staff-shell';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';

export default async function StaffLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const profile =
    await requireTrainerAccess();

  return (
    <StaffShell
      profile={
        profile
      }
    >
      {
        children
      }
    </StaffShell>
  );
}
