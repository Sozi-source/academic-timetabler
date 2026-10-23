import type { Metadata } from 'next';
import { CalendarDays, KeyRound } from 'lucide-react';

import { UnifiedLoginCard } from '@/features/auth/unified-login-card';

export const metadata: Metadata = {
  title: 'External Trainer Sign In | Academic Planning System',
  description: 'Sign in to access teaching allocations assigned by the department.',
};

export default function ExternalTrainerLoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-institutional-yellow" aria-hidden="true" />
      <div className="w-full max-w-[390px] space-y-3">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
              <KeyRound className="size-4" aria-hidden="true" />
            </span>
            <h1 className="text-sm font-bold text-text-primary">External Trainer Access</h1>
          </div>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            For trainers from other departments with an active trainer record and assigned teaching allocations.
            Sign in to access marks entry and signing sheets for your units.
          </p>
        </div>
        <UnifiedLoginCard defaultRole="staff" nextPath="/external-trainer" />
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-text-muted">
          <CalendarDays className="size-3" aria-hidden="true" />
          Access is enabled by the department after your trainer details are linked.
        </p>
      </div>
    </main>
  );
}
