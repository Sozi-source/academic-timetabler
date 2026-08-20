'use client';

import { ClipboardCheck, LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/features/auth/actions';

export function TrainerShell({
  trainerName,
  children,
}: {
  trainerName: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-institutional-yellow" />

      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/trainer/exam-attendance" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white ring-2 ring-institutional-yellow/80 ring-offset-2 ring-offset-surface">
              <ClipboardCheck className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-bold text-text-primary">Trainer Portal</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-semibold text-text-secondary sm:block">{trainerName}</p>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        {children}
      </main>
    </div>
  );
}
