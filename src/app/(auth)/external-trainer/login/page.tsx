import type { Metadata } from 'next';
import { BookOpenCheck } from 'lucide-react';

import { ExternalTrainerPinForm } from '@/features/trainer-access/external-trainer-pin-form';

export const metadata: Metadata = {
  title: 'External Trainer Sign In | Academic Planning System',
  description: 'Access your assigned units, mark entry, and signing sheets.',
};

export default function ExternalTrainerLoginPage() {
  return (
    <main className="external-trainer relative flex min-h-screen items-center justify-center bg-[#f4f7f6] px-4 py-8 sm:px-6">
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#dce7e4] bg-white p-5 shadow-[0_20px_60px_rgba(20,55,48,0.10)] sm:p-6" aria-labelledby="pin-login-title">
        <span className="absolute inset-x-0 top-0 h-1 bg-[#e5bd32]" aria-hidden="true" />
        <header className="mb-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#e8f4f2] text-[#0f766e]">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[12px] font-bold leading-tight tracking-tight text-[#183b35]">Imperial College of Medical and Health Sciences</p>
              <p className="mt-0.5 text-[11px] font-medium text-[#667a74]">External Trainer Portal</p>
            </div>
          </div>
          <h1 id="pin-login-title" className="text-xl font-bold tracking-tight text-[#173b35]">Sign in</h1>
        </header>
        <ExternalTrainerPinForm />
      </section>
    </main>
  );
}
