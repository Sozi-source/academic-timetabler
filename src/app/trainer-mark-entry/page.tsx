import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, ShieldAlert, UserCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Trainer Mark Entry · Academic Planner',
  description: 'Sign in to access your assigned teaching units and enter marks.',
  referrer: 'no-referrer',
};

export default function TrainerMarkEntryPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <ShieldAlert className="size-6" />
        </div>

        <h1 className="mt-4 text-lg font-bold text-slate-900">
          Trainer Marks Entry Notice
        </h1>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Unauthenticated link-based mark entry has been discontinued to ensure academic marks integrity. Please sign in through your designated portal below to access your assigned units and enter marks.
        </p>

        <div className="mt-6 space-y-3">
          <Link
            href="/external-trainer/login"
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 transition hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <KeyRound className="size-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">External Trainer Login</p>
                <p className="text-[11px] text-slate-500">Sign in with your 6-digit access PIN</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-700">Sign In &rarr;</span>
          </Link>

          <Link
            href="/staff"
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 transition hover:border-blue-300 hover:bg-blue-50/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                <UserCheck className="size-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">Staff & Internal Trainer Portal</p>
                <p className="text-[11px] text-slate-500">Sign in with your staff account</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-700">Sign In &rarr;</span>
          </Link>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <p className="text-[11px] text-slate-400">
            Need a PIN? Contact your Head of Department (HOD) to generate your access credentials.
          </p>
        </div>
      </div>
    </main>
  );
}
