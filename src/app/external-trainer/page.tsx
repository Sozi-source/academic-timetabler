import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BookOpenCheck, Download, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/features/auth/actions';
import { getAuthenticatedProfile } from '@/features/auth/queries';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';

export const metadata: Metadata = {
  title: 'External Trainer Portal',
  description: 'Marks entry and signing sheets for allocated teaching units.',
};

export default async function ExternalTrainerPortalPage() {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect('/external-trainer/login');
  if (profile.role !== 'trainer') redirect('/unauthorized');

  const workspace = await getStaffWorkspace(profile.id);
  const units = groupStaffUnitAllocations(workspace.allocations);

  return (
    <main className="min-h-screen bg-background">
      <div className="h-1.5 bg-institutional-yellow" aria-hidden="true" />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div>
            <p className="text-sm font-bold text-text-primary">Trainer Portal</p>
            <p className="text-xs text-text-muted">External department access</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs font-semibold text-text-secondary sm:flex">
              <UserRound className="size-3.5" aria-hidden="true" />
              {workspace.trainerName}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <section>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Your teaching access</p>
          <h1 className="mt-1 text-xl font-bold text-text-primary">Marks and signing sheets</h1>
          <p className="mt-1 text-sm text-text-muted">
            Access is limited to the units assigned to your linked trainer account.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/staff/units" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm transition hover:border-primary/40 hover:bg-primary-subtle/30">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold text-text-primary">Marks entry</span>
              <span className="mt-0.5 block text-xs text-text-muted">{units.length} allocated units</span>
            </span>
          </Link>
          <Link href="/staff/downloads" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm transition hover:border-primary/40 hover:bg-primary-subtle/30">
            <span className="flex size-10 items-center justify-center rounded-lg bg-institutional-yellow-soft text-institutional-yellow-ink">
              <Download className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold text-text-primary">Signing sheets</span>
              <span className="mt-0.5 block text-xs text-text-muted">Download sheets for your units</span>
            </span>
          </Link>
        </div>

        {units.length === 0 ? (
          <section className="rounded-xl border border-border bg-white px-5 py-10 text-center">
            <BookOpenCheck className="mx-auto size-7 text-text-muted" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-text-primary">No units assigned yet</p>
            <p className="mt-1 text-xs text-text-muted">Contact the department to have your trainer account linked to teaching allocations.</p>
          </section>
        ) : (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">Allocated units</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {units.map((unit) => (
                <Link
                  key={unit.primaryAllocationId}
                  href={`/staff/units/${unit.primaryAllocationId}`}
                  className="rounded-xl border border-border bg-white p-3.5 transition hover:border-primary/40 hover:shadow-sm"
                >
                  <p className="text-[11px] font-semibold text-text-muted">{unit.unitCode}</p>
                  <p className="mt-0.5 text-sm font-bold text-text-primary">{unit.unitName}</p>
                  <p className="mt-1 text-xs text-text-secondary">{unit.cohortNames.join(' + ')}</p>
                  <p className="mt-3 text-xs font-semibold text-primary">Open marks entry →</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
