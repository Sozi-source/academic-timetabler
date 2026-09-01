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
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 sm:px-8 shadow-xs">
      {/* Left: Mobile Toggle & Page Title & Subtitle */}
      <div className="flex items-center gap-3.5">
        {onOpenMobileNav ? (
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation menu"
            className="flex size-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        ) : null}

        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
            {title}
          </h1>
          <p className="text-xs font-normal text-[#6B7280] mt-0.5">
            {departmentLabel} <span className="mx-1">•</span> {activePeriodName}
          </p>
        </div>
      </div>

      {/* Right: Notifications & User Profile */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-[#EAB308]" />
        </button>

        {/* Vertical Divider */}
        <div className="h-8 w-px bg-[#E5E7EB]" aria-hidden="true" />

        {/* User Badge with Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-3 rounded-xl p-1 text-left transition hover:bg-gray-50 focus:outline-none"
            aria-expanded={dropdownOpen}
          >
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold leading-tight text-[#111827]">
                {displayName}
              </p>
              <p className="text-xs text-[#6B7280] leading-tight mt-0.5">
                {roleLabel}
              </p>
            </div>

            {/* Deep Teal Avatar */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#033B36] text-sm font-bold text-white shadow-xs">
              {initial}
            </div>

            <ChevronDown className="size-4 text-gray-400 transition-transform duration-200" />
          </button>

          {/* User Dropdown Menu */}
          {dropdownOpen ? (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 z-40 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="text-xs font-semibold text-gray-900">{profile.fullName}</p>
                  <p className="truncate text-xs text-gray-500">{profile.email}</p>
                </div>

                <div className="py-1">
                  <Link
                    href="/staff"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <User className="size-4 text-gray-400" />
                    <span>My Staff Workspace</span>
                  </Link>
                </div>

                <div className="border-t border-gray-100 pt-1">
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
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
