import type { ReactNode } from 'react';
import { BookOpen, LogOut } from 'lucide-react';

import { logoutAction } from '@/features/auth/actions';

import { ExternalTrainerNavigation } from './external-trainer-navigation';

export function ExternalTrainerShell({
  trainerName,
  children,
}: {
  trainerName: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f7f6] text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border bg-white shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <BookOpen className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">Trainer Portal</p>
              <p className="truncate text-[11px] text-text-muted">{trainerName}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6">
          <ExternalTrainerNavigation />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        {children}
      </main>
    </div>
  );
}
