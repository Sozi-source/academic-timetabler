import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getLectureNotesUnitList } from '@/features/lecture-notes/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lecture Notes Generator',
  description: 'Generate grounded lecture notes from course outlines and your uploaded materials.',
};

export default async function LectureNotesPage() {
  const profile = await requireTrainerAccess();
  const units = await getLectureNotesUnitList(profile);

  return (
    <div className="admin-screen space-y-6">
      <PageHeader
        eyebrow="Teaching tools"
        title="Lecture Notes Generator"
        backHref="/teaching-documents"
        backLabel="Teaching Documents"
        context={
          <Badge variant="neutral">
            {units.length} unit{units.length === 1 ? '' : 's'}
          </Badge>
        }
      />

      {units.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No active teaching allocations"
          description="You need at least one active or draft teaching allocation to generate lecture notes. Check your assignments under Timetabling."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((unit) => (
            <Link
              key={unit.allocationId}
              href={`/lecture-notes/${unit.unitId}`}
              className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs transition hover:border-primary/40 hover:bg-surface-subtle hover:shadow-sm"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <BookOpen className="size-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary group-hover:text-primary">
                  {unit.unitCode}
                </p>
                <p className="truncate text-xs text-text-secondary">{unit.unitName}</p>
              </div>

              {unit.jobCount > 0 && (
                <Badge variant="success" dot className="shrink-0">
                  {unit.jobCount}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
