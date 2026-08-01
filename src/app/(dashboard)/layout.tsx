import type { ReactNode } from 'react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const profile = await requireHodAccess();

  return (
    <DashboardShell profile={profile}>
      {children}
    </DashboardShell>
  );
}