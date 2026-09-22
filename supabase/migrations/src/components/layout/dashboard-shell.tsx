'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import type { AuthenticatedProfile } from '@/features/auth/types';

import { AssessmentShell } from './assessment-shell';
import { PlatformShell } from './platform-shell';
import { StudentShell } from './student-shell';
import { TimetableShell } from './timetable-shell';

interface DashboardShellProps {
  profile: AuthenticatedProfile;
  children: ReactNode;
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const pathname = usePathname();

  if (pathname.startsWith('/timetable')) {
    return <TimetableShell profile={profile}>{children}</TimetableShell>;
  }

  if (pathname.startsWith('/students')) {
    return <StudentShell profile={profile}>{children}</StudentShell>;
  }

  if (pathname.startsWith('/assessment')) {
    return <AssessmentShell profile={profile}>{children}</AssessmentShell>;
  }

  return <PlatformShell profile={profile}>{children}</PlatformShell>;
}
