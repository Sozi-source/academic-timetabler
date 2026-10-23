import { BookOpenCheck, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { requireStaffAllocation } from '@/features/staff-assessment/queries';

interface PageProps {
  params: Promise<{ allocationId: string }>;
}

export default async function ExternalTrainerUnitPage({ params }: PageProps) {
  const profile = await requireTrainerAccess();
  const { allocationId } = await params;
  const context = await requireStaffAllocation({ profileId: profile.id, allocationId });

  if (!context) notFound();

  const { allocation } = context;
  const assessmentId = allocation.exam?.assessmentId ?? 'exam';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${allocation.unitCode} · ${allocation.academicPeriodName}`}
        title={allocation.unitName}
        description={allocation.cohortName}
        backHref="/external-trainer/units"
        backLabel="My Units"
      />
      <section aria-labelledby="marks-entry-title" className="rounded-xl border border-border bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="marks-entry-title" className="text-sm font-bold text-text-primary">Marks entry</h2>
              <p className="mt-0.5 text-xs text-text-muted">Enter, save, and submit each mark component separately.</p>
            </div>
          </div>
          <Link
            href={`/external-trainer/units/${allocationId}/assessment/${assessmentId}/marks`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Enter marks
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
