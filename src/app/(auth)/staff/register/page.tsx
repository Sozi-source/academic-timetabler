import type {
  Metadata,
} from 'next';
import {
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';

import {
  TrainerRegistrationForm,
} from '@/features/trainer-access/trainer-registration-form';

export const metadata:
Metadata = {
  title:
    'Staff Registration',
  description:
    'Create a trainer staff account using a pre-registered departmental email.',
};

export default function StaffRegistrationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-subtle/40 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-header-blue text-white">
            <UserRoundCheck
              className="size-4.5"
              aria-hidden="true"
            />
          </span>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              Academic Planner
            </p>

            <h1 className="mt-0.5 text-lg font-bold text-text-primary">
              Staff registration
            </h1>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5 rounded-lg border border-border bg-surface-subtle/60 px-3 py-2.5">
          <ShieldCheck
            className="mt-0.5 size-3.5 shrink-0 text-text-muted"
            aria-hidden="true"
          />

          <p className="text-[11px] leading-5 text-text-secondary">
            Use the same email recorded
            on your trainer profile.
            Unregistered accounts receive
            no staff access.
          </p>
        </div>

        <div className="mt-5">
          <TrainerRegistrationForm />
        </div>
      </section>
    </main>
  );
}
