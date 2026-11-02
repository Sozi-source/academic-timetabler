import type { Metadata } from 'next';
import { BookOpenCheck } from 'lucide-react';

import { ExternalTrainerPinForm } from '@/features/trainer-access/external-trainer-pin-form';

export const metadata: Metadata = {
  title: 'External Trainer Sign In | Academic Planning System',
  description: 'Access your assigned units, mark entry, and signing sheets.',
};

export default function ExternalTrainerLoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#f4f7f6] px-4 py-10 sm:px-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-[#0f766e]" aria-hidden="true" />
      <section className="w-full max-w-md rounded-3xl border border-[#dce7e4] bg-white p-6 shadow-[0_20px_60px_rgba(20,55,48,0.10)] sm:p-8" aria-labelledby="pin-login-title">
        <header className="mb-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#e8f4f2] text-[#0f766e]">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-bold leading-tight tracking-tight text-[#183b35]">Imperial College of Medical and Health Sciences</p>
              <p className="mt-0.5 text-[11px] font-medium text-[#667a74]">External Trainer Portal</p>
            </div>
          </div>
          <h1 id="pin-login-title" className="text-2xl font-bold tracking-tight text-[#173b35]">Sign in</h1>
          <p className="mt-1.5 text-sm leading-5 text-[#60736e]">
            Enter the 8-digit access PIN provided by your department.
          </p>
        </header>
        <ExternalTrainerPinForm />
      </section>
    </main>
  );
}
