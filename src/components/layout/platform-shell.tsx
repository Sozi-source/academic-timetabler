'use client';

import { LayoutGrid, Menu as MenuIcon, UserRound, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import type { AuthenticatedProfile } from '@/features/auth/types';

import { AdminHeader } from './admin-header';
import { adminNavItems, AdminSidebar, isNavItemActive } from './admin-sidebar';
import { MobileBottomNav } from './mobile-bottom-nav';

interface PlatformShellProps {
  profile: AuthenticatedProfile;
  children: ReactNode;
}

// The five most-used destinations, plus a "More" tab that opens the same
// drawer the header's menu button opens — the rest of adminNavItems still
// lives there rather than being crammed into the bar.
const BOTTOM_TABS = [
  { label: 'Home', href: '/dashboard', icon: LayoutGrid },
  { label: 'Action', href: '/operations/action-center', icon: Zap },
  { label: 'Staff', href: '/trainers', icon: UserRound },
] as const;

export function PlatformShell({ profile, children }: PlatformShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Deep Teal Admin Sidebar */}
      <AdminSidebar
        departmentName={profile.departmentName || 'Human Nutrition & Dietetics'}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[var(--sidebar-width)]">
        {/* Top Header */}
        <AdminHeader
          profile={profile}
          title="Department Operations"
          activePeriodName="September-December 2026"
          onOpenMobileNav={() => setMobileOpen(true)}
        />

        {/* Page Content */}
        <main className="admin-screen mx-auto w-full max-w-[var(--content-max-width)] flex-1 px-[var(--content-gutter)] py-3.5 pb-20 sm:py-5 lg:py-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Android/iOS-style bottom tab bar — mobile & tablet only; the desktop
          sidebar already covers this same navigation on large screens. */}
      <MobileBottomNav
        items={[
          ...BOTTOM_TABS.map((tab) => ({
            ...tab,
            isActive: isNavItemActive(
              pathname,
              tab.href,
              adminNavItems.map((item) => item.href),
              tab.href === '/dashboard',
            ),
          })),
          {
            label: 'More',
            icon: MenuIcon,
            onClick: () => setMobileOpen(true),
          },
        ]}
      />
    </div>
  );
}
