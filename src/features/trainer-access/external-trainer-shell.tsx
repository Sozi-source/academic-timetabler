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
    <div className="external-trainer min-h-screen bg-[#fbfaf7] text-text-primary">
      <header className="sticky top-0 z-20 border-b border-[#ece7de] bg-white/95 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <BookOpen className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">Trainer Portal</p>
              <p className="truncate text-[11px] text-text-muted">{trainerName}</p>
            </div>
          </div>
          <div className="ml-auto hidden lg:block">
            <ExternalTrainerNavigation />
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e4ded3] bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-[#f6f3ec] hover:text-text-primary"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-12 sm:pt-6 lg:px-8">
        {children}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#ece7de] bg-white/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_20px_rgba(28,57,51,0.06)] backdrop-blur-md lg:hidden">
        <div className="mx-auto max-w-lg">
          <ExternalTrainerNavigation />
        </div>
      </div>
    </div>
  );
}
