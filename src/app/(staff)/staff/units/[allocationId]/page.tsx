import {
  BookOpen,
  CalendarCheck2,
  ChevronRight,
  FileSpreadsheet,
  Keyboard,
  Pencil,
  PlusCircle,
  Printer,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Card,
} from '@/components/ui/card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  requireStaffAllocation,
} from '@/features/staff-assessment/queries';
import type {
  StaffAssessmentSummary,
} from '@/features/staff-assessment/types';
import {
  getRecordOfWorkContext,
} from '@/features/teaching-documents/record-of-work-online/queries';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

function MarksCard({
  allocationId,
  assessment,
}: {
  allocationId: string;
  assessment: StaffAssessmentSummary | null;
}) {
  if (!assessment) {
    return (
      <article className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-muted">
            <Keyboard className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Marks Entry</h3>
            <p className="text-xs text-text-muted">Pending assessment setup</p>
          </div>
        </div>

        <Badge variant="neutral">Not configured</Badge>
      </article>
    );
  }

  return (
    <Link
      href={`/staff/units/${allocationId}/assessment/${assessment.assessmentId}`}
      className="group flex items-center justify-between rounded-xl border border-border border-l-4 border-l-primary bg-surface p-4 shadow-xs transition hover:border-border-strong hover:bg-surface-subtle"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Keyboard className="size-4.5" aria-hidden="true" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text-primary">Marks Entry</h3>
            <Badge variant="neutral">{assessment.workflowStatus}</Badge>
            {assessment.published ? <Badge variant="success">Published</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            {assessment.registered} registered · {assessment.absent} absent
          </p>
        </div>
      </div>

      <ChevronRight className="size-5 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

export default async function StaffUnitPage({
  params,
}: PageProps) {
  const profile = await requireTrainerAccess();
  const { allocationId } = await params;

  const [context, rowContext] = await Promise.all([
    requireStaffAllocation({
      profileId: profile.id,
      allocationId,
    }),
    getRecordOfWorkContext(allocationId),
  ]);

  if (!context) {
    notFound();
  }

  const { allocation } = context;
  const entriesCount = rowContext?.entries.length ?? 0;
  const uniqueWeeksCount = new Set(rowContext?.entries.map((e) => e.weekNumber) ?? []).size;
  const syllabusRate = Math.min(100, Math.round((uniqueWeeksCount / 14) * 100));

  return (
    <div className="space-y-5">
      <PageHeader
        title={allocation.unitName}
        description={allocation.cohortName}
        backHref="/staff/units"
        backLabel="Units"
        actions={
          <Badge variant="institutional" className="capitalize">
            {allocation.allocationStatus}
          </Badge>
        }
      />

      {/* 1. Assessment & Marks */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Assessment & Marks
        </h2>
        <MarksCard
          allocationId={allocation.allocationId}
          assessment={allocation.exam}
        />
      </section>

      {/* 2. Teaching Documents */}
      <section className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Teaching Documents
        </h2>

        <div className="portal-card-grid" data-columns="3">
          {/* Course Outline */}
          <Card className="flex flex-col justify-between p-4 shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <BookOpen className="size-4" />
                </span>
                <Badge variant="neutral">Syllabus</Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">Course Outline</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Outcomes & schedule
              </p>
            </div>
            <div className="mt-4 flex gap-2 border-t border-border pt-3">
              <Link
                href={`/staff/units/${allocationId}/documents/course-outline`}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-white transition hover:bg-primary-hover"
              >
                <Printer className="size-3.5" />
                View & Print
              </Link>
              <Link
                href={`/teaching-documents/curriculum/editor?unitId=${context.allocation.unitId}`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
                title="Edit Course Outline online"
              >
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </div>
          </Card>

          {/* Scheme of Work */}
          <Card className="flex flex-col justify-between p-4 shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FileSpreadsheet className="size-4" />
                </span>
                <Badge variant="neutral">14 Weeks</Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">Scheme of Work</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Weekly lesson plan
              </p>
            </div>
            <div className="mt-4 flex gap-2 border-t border-border pt-3">
              <Link
                href={`/staff/units/${allocationId}/documents/scheme-of-work`}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-white transition hover:bg-primary-hover"
              >
                <Printer className="size-3.5" />
                View & Print
              </Link>
              <Link
                href={`/teaching-documents/curriculum/editor?unitId=${context.allocation.unitId}`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
                title="Edit Scheme online"
              >
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </div>
          </Card>

          {/* Record of Work */}
          <Card className="flex flex-col justify-between border-primary/30 bg-primary/5 p-4 shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-primary p-2 text-white">
                  <CalendarCheck2 className="size-4" />
                </span>
                <Badge variant={entriesCount > 0 ? 'success' : 'neutral'}>
                  {entriesCount > 0 ? `${syllabusRate}% Delivered` : 'No logs'}
                </Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">Record of Work</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                {uniqueWeeksCount}/14 weeks logged · {entriesCount} sessions
              </p>
            </div>
            <div className="mt-4 flex gap-2 border-t border-primary/20 pt-3">
              <Link
                href={`/staff/units/${allocationId}/documents/record-of-work`}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-semibold text-white transition hover:bg-primary-hover"
              >
                <PlusCircle className="size-3.5" />
                Log Progress
              </Link>
              <Link
                href={`/staff/units/${allocationId}/documents/record-of-work/print`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border-strong bg-white px-2.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
                title="Print Official Record"
              >
                <Printer className="size-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* 3. Class Attendance */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Class Register
        </h2>
        <Link
          href={`/staff/attendance?allocationId=${allocation.allocationId}`}
          className="group flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-xs transition hover:border-border-strong hover:bg-surface-subtle"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <UsersRound className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Class Attendance Register
              </h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Record and view class session attendance
              </p>
            </div>
          </div>
          <ChevronRight className="size-5 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
      </section>
    </div>
  );
}


