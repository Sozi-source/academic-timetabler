import {
  ArrowLeft,
  BookOpen,
  CalendarCheck2,
  FileSpreadsheet,
  FileText,
  Pencil,
  PlusCircle,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { requireStaffAllocation } from '@/features/staff-assessment/queries';
import { getRecordOfWorkContext } from '@/features/teaching-documents/record-of-work-online/queries';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

export default async function StaffUnitDocumentsPage({ params }: PageProps) {
  const profile = await requireTrainerAccess();
  const { allocationId } = await params;

  const context = await requireStaffAllocation({
    profileId: profile.id,
    allocationId,
  });

  if (!context) {
    notFound();
  }

  const rowContext = await getRecordOfWorkContext(allocationId);

  const entriesCount = rowContext?.entries.length ?? 0;
  const uniqueWeeksCount = new Set(rowContext?.entries.map((e) => e.weekNumber) ?? []).size;
  const syllabusRate = Math.min(100, Math.round((uniqueWeeksCount / 14) * 100));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Units · Documents"
        title={context.allocation.unitName}
        description={`${context.allocation.cohortName} · ${context.allocation.academicPeriodName}`}
        icon={FileText}
        actions={
          <Link
            href={`/staff/units/${allocationId}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Unit
          </Link>
        }
      />

      {/* TEACHING DOCUMENTS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">
              Teaching Documents
            </h2>
            <p className="text-xs text-text-muted">
              Curriculum structures with dynamic trainer and semester details.
            </p>
          </div>
          <Badge variant="success">Official</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {/* Card 1: Course Outline */}
          <Card className="flex flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <BookOpen className="size-4" />
                </span>
                <Badge variant="neutral">Master Outline</Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">Course Outline</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                Competency outcomes, 14-week topical schedule, 5-component grading breakdown, and references.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex gap-2">
              <Link
                href={`/staff/units/${allocationId}/documents/course-outline`}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <Printer className="size-3.5" />
                View & Print
              </Link>
              <Link
                href={`/teaching-documents/curriculum/editor?unitId=${context.allocation.unitId}`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
                title="Edit Course Outline online"
              >
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </div>
          </Card>

          {/* Card 2: Scheme of Work */}
          <Card className="flex flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FileSpreadsheet className="size-4" />
                </span>
                <Badge variant="neutral">14-Week Plan</Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">Scheme of Work</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                Detailed weekly lesson matrix, learning activities, resources, and remarks auto-synthesized from Outline.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex gap-2">
              <Link
                href={`/staff/units/${allocationId}/documents/scheme-of-work`}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <Printer className="size-3.5" />
                View & Print
              </Link>
              <Link
                href={`/teaching-documents/curriculum/editor?unitId=${context.allocation.unitId}`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
                title="Edit Course Outline to update Scheme"
              >
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </div>
          </Card>

          {/* Card 3: Record of Work Covered */}
          <Card className="flex flex-col justify-between p-4 border-primary/40 bg-primary/5">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary text-white p-2">
                  <CalendarCheck2 className="size-4" />
                </span>
                <Badge variant={entriesCount > 0 ? 'success' : 'warning'}>
                  {entriesCount > 0 ? `${syllabusRate}% Delivered` : 'Update Required'}
                </Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">Record of Work Covered</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                Progressively log delivered sessions, student attendance, outcomes, and remarks across the term.
              </p>
              <div className="mt-2 text-[10px] font-semibold text-primary">
                {uniqueWeeksCount} of 14 Weeks Logged ({entriesCount} sessions)
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-primary/20 flex gap-2">
              <Link
                href={`/staff/units/${allocationId}/documents/record-of-work`}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <PlusCircle className="size-3.5" />
                Log Progress
              </Link>
              <Link
                href={`/staff/units/${allocationId}/documents/record-of-work/print`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border-strong bg-white px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
                title="Print Official Record"
              >
                <Printer className="size-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
