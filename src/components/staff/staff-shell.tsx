import type {
  ReactNode,
} from 'react';
import {
  BookOpenCheck,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';

import {
  logoutAction,
} from '@/features/auth/actions';
import type {
  AuthenticatedProfile,
} from '@/features/auth/types';

export function StaffShell({
  profile,
  children,
}: {
  profile: AuthenticatedProfile;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-subtle/30">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/staff"
            className="flex min-w-0 items-center gap-2.5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-header-blue text-white">
              <BookOpenCheck
                className="size-4.5"
                aria-hidden="true"
              />
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-text-primary">
                Staff workspace
              </span>

              <span className="block truncate text-[10px] text-text-muted">
                Academic Planner
              </span>
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-semibold text-text-primary">
                {
                  profile.fullName
                }
              </p>

              <p className="truncate text-[10px] text-text-muted">
                Trainer
              </p>
            </div>

            <form
              action={
                logoutAction
              }
            >
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
              >
                <LogOut
                  className="size-3.5"
                  aria-hidden="true"
                />

                <span className="hidden sm:inline">
                  Sign out
                </span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
          <Link
            href="/staff"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            Overview
          </Link>

          <Link
            href="/staff/units"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            My Units
          </Link>

          <Link
            href="/staff/documents"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            Documents
          </Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        {
          children
        }
      </main>
    </div>
  );
}
