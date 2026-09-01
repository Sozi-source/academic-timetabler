'use client';

import { useState, type ReactNode } from 'react';

import type { AuthenticatedProfile } from '@/features/auth/types';

import { AdminHeader } from './admin-header';
import { AdminSidebar } from './admin-sidebar';

interface PlatformShellProps {
  profile: AuthenticatedProfile;
  children: ReactNode;
}

export function PlatformShell({ profile, children }: PlatformShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Deep Teal Admin Sidebar */}
      <AdminSidebar
        departmentName={profile.departmentName || 'Human Nutrition & Dietetics'}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-col lg:pl-[250px]">
        {/* Top Header */}
        <AdminHeader
          profile={profile}
          title="Department Operations"
          activePeriodName="Sep – Dec 2026"
          onOpenMobileNav={() => setMobileOpen(true)}
        />

        {/* Page Content */}
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 w-full max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
