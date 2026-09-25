'use client';

import { Bell, ChevronDown, LogOut, Menu, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';

interface AdminHeaderProps {
  profile: AuthenticatedProfile;
  title?: string;
  activePeriodName?: string;
  onOpenMobileNav?: () => void;
}

export function AdminHeader({
  profile,
  title = 'Department Operations',
  activePeriodName = 'Sep – Dec 2026',
  onOpenMobileNav,
}: AdminHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // User display name from email or full name (e.g. wilfred.osozi)
  const displayName = profile.email
    ? profile.email.split('@')[0]
    : profile.fullName.toLowerCase().replace(/\s+/g, '.');

  const initial = (profile.fullName?.[0] || profile.email?.[0] || 'W').toUpperCase();

  const roleLabel =
    profile.role === 'system_admin'
      ? 'System administrator'
      : 'Department administrator';

  const departmentLabel = profile.departmentName || 'Human Nutrition & Dietetics';

  return (
    <header className="admin-shell-header sticky top-0 z-40 flex min-h-[var(--header-height)] items-center justify-between gap-2 border-b border-border-soft bg-surface/95 px-[var(--content-gutter)] shadow-sm backdrop-blur-xl">
      {/* Left: Mobile Toggle & Page Title & Subtitle */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        {onOpenMobileNav ? (
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation menu"
            className="touch-target size-9 rounded-[0.65rem] border border-border bg-surface text-text-secondary shadow-sm transition hover:bg-surface-subtle lg:hidden"
          >
            <Menu className="size-4.5" />
          </button>
        ) : null}

        <div>
          <h1 className="truncate text-sm font-bold tracking-tight text-text-primary sm:text-base lg:text-lg">
            {title}
          </h1>
          <p className="mt-0.5 hidden max-w-[38rem] truncate text-[0.68rem] font-medium leading-none text-text-muted sm:block">
            {departmentLabel} <span className="mx-1 text-gray-300">•</span> {activePeriodName}
          </p>
        </div>
      </div>

      {/* Right: Notifications & User Profile */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="touch-target relative size-9 rounded-full text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
        >
          <Bell className="size-4.5" />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#EAB308]" />
        </button>

        {/* Vertical Divider */}
        <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

        {/* User Badge with Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-xl p-1 text-left transition hover:bg-surface-subtle focus:outline-none"
            aria-expanded={dropdownOpen}
          >
            <div className="hidden max-w-36 text-right lg:block">
              <p className="truncate text-xs font-semibold leading-tight text-text-primary">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-[10px] leading-tight text-text-muted">
                {roleLabel}
              </p>
            </div>

            {/* Deep Teal Avatar */}
            <div className="flex size-8.5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm ring-2 ring-primary-soft">
              {initial}
            </div>

            <ChevronDown className="hidden size-3.5 text-text-subtle sm:block" />
          </button>

          {/* User Dropdown Menu */}
          {dropdownOpen ? (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-border bg-surface p-2.5 shadow-lg">
                <div className="border-b border-border-soft px-3 py-2.5">
                  <p className="text-xs font-semibold text-text-primary">{profile.fullName}</p>
                  <p className="truncate text-[11px] text-text-muted">{profile.email}</p>
                </div>

                <div className="py-1.5">
                  <Link
                    href="/staff"
                    onClick={() => setDropdownOpen(false)}
                    className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                  >
                    <User className="size-4 text-gray-400" />
                    <span>My Staff Workspace</span>
                  </Link>
                </div>

                <div className="border-t border-border-soft pt-1.5">
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-danger hover:bg-danger-surface"
                    >
                      <LogOut className="size-4 text-red-500" />
                      <span>Sign Out</span>
                    </button>
                  </form>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
