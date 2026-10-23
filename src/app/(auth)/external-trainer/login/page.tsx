import type { Metadata } from 'next';

import { ExternalTrainerPinForm } from '@/features/trainer-access/external-trainer-pin-form';

export const metadata: Metadata = {
  title: 'External Trainer Sign In | Academic Planning System',
  description: 'Access your assigned units, mark entry, and signing sheets.',
};

export default function ExternalTrainerLoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-institutional-yellow" aria-hidden="true" />
      <section className="w-full max-w-[390px] rounded-xl border border-border bg-white p-5 shadow-lg" aria-labelledby="pin-login-title">
        <h1 id="pin-login-title" className="mb-4 text-sm font-bold text-text-primary">Sign in</h1>
        <ExternalTrainerPinForm />
      </section>
    </main>
  );
}
