import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';

import { ExternalTrainerPinForm } from '@/features/trainer-access/external-trainer-pin-form';

export const metadata: Metadata = {
  title: 'External Trainer Sign In | Academic Planning System',
  description: 'Access your assigned units, mark entry, and signing sheets.',
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
            <h1 className="text-sm font-bold text-text-primary">External Trainer Portal</h1>
          </div>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            Access your assigned units, mark entry, and signing sheets.
          </p>
        </div>
        <section className="rounded-xl border border-border bg-white p-5 shadow-lg" aria-labelledby="pin-login-title">
          <h2 id="pin-login-title" className="mb-3 text-sm font-bold text-text-primary">Sign in with your PIN</h2>
          <ExternalTrainerPinForm />
        </section>
      </div>
    </main>
  );
}
