import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, FileText, Layers, Upload } from 'lucide-react';

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
              className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs transition hover:border-primary/40 hover:bg-surface-subtle hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <BookOpen className="size-5" aria-hidden="true" />
                </div>
                {unit.jobCount > 0 && (
                  <Badge variant="success" dot>
                    {unit.jobCount} generated
                  </Badge>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary group-hover:text-primary">
                  {unit.unitCode} — {unit.unitName}
                </p>
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  {unit.cohortName} · {unit.academicPeriodName}
                </p>
              </div>

              <div className="flex items-center gap-3 border-t border-border-soft pt-3 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  <Upload className="size-3.5" aria-hidden="true" />
                  {unit.materialCount} material{unit.materialCount === 1 ? '' : 's'}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="size-3.5" aria-hidden="true" />
                  {unit.jobCount} note{unit.jobCount === 1 ? '' : 's'}
                </span>
                {unit.materialCount === 0 && (
                  <span className="ml-auto flex items-center gap-1 font-medium text-warning">
                    <Layers className="size-3.5" aria-hidden="true" />
                    Add materials
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
