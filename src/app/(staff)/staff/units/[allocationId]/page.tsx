import {
  BookOpen,
  CalendarCheck2,
  ChevronRight,
  Download,
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
  StaffUnitAllocation,
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
  allocation,
}: {
  allocation: StaffUnitAllocation;
}) {
  const assessment = allocation.exam;
  const assessmentId = assessment?.assessmentId ?? 'exam';
  const registeredCount = assessment?.registered ?? 0;
  const absentCount = assessment?.absent ?? 0;
  const status = assessment?.workflowStatus ?? 'draft';

  return (
    <Link
      href={`/staff/units/${allocation.allocationId}/assessment/${assessmentId}/marks`}
      className="group flex items-center justify-between rounded-xl border border-border border-l-4 border-l-primary bg-surface p-4 shadow-xs transition hover:border-border-strong hover:bg-surface-subtle"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Keyboard className="size-4.5" aria-hidden="true" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text-primary">Marks Entry</h3>
            <Badge variant="neutral" className="capitalize">{status}</Badge>
            {assessment?.published ? <Badge variant="success">Published</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            {registeredCount} registered students{absentCount > 0 ? ` · ${absentCount} absent` : ''}
          </p>
        </div>
      </div>

      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-xs transition group-hover:bg-primary-hover">
        <Keyboard className="size-3.5" />
        Enter marks
      </span>
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
          allocation={allocation}
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

      {/* 3. Attendance Registers */}
      <section className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Attendance Registers
        </h2>

        <div className="portal-card-grid" data-columns="3">
          {/* 1. Class Attendance Sheet */}
          <Card className="flex flex-col justify-between p-3.5 border-slate-200 bg-white shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded bg-slate-100 text-slate-700">
                  <UsersRound className="size-3.5" />
                </span>
                <h3 className="text-xs font-bold text-slate-900">
                  Class Attendance
                </h3>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Monthly lesson roll
              </p>
            </div>
            <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-2.5">
              <Link
                href={`/staff/units/${allocationId}/documents/class-attendance`}
                className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Printer className="size-3" />
                Print
              </Link>
              <a
                href={`/api/staff/units/${allocationId}/attendance-sheet/class`}
                className="inline-flex h-7 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                title="Download Word format"
              >
                <Download className="size-3" />
                .docx
              </a>
            </div>
          </Card>

          {/* 2. CAT Attendance List */}
          <Card className="flex flex-col justify-between p-3.5 border-slate-200 bg-white shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded bg-slate-100 text-slate-700">
                  <FileSpreadsheet className="size-3.5" />
                </span>
                <h3 className="text-xs font-bold text-slate-900">
                  CAT Attendance
                </h3>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Test signatures & marks
              </p>
            </div>
            <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-2.5">
              <Link
                href={`/staff/units/${allocationId}/documents/cat-attendance`}
                className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Printer className="size-3" />
                Print
              </Link>
              <a
                href={`/api/staff/units/${allocationId}/attendance-sheet/cat`}
                className="inline-flex h-7 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                title="Download Word format"
              >
                <Download className="size-3" />
                .docx
              </a>
            </div>
          </Card>

          {/* 3. Exam Attendance List */}
          <Card className="flex flex-col justify-between p-3.5 border-slate-200 bg-white shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded bg-slate-100 text-slate-700">
                  <FileSpreadsheet className="size-3.5" />
                </span>
                <h3 className="text-xs font-bold text-slate-900">
                  Exam Attendance
                </h3>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Scripts & candidate register
              </p>
            </div>
            <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-2.5">
              <Link
                href={`/staff/units/${allocationId}/documents/exam-attendance`}
                className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Printer className="size-3" />
                Print
              </Link>
              <a
                href={`/api/staff/units/${allocationId}/attendance-sheet/exam`}
                className="inline-flex h-7 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                title="Download Word format"
              >
                <Download className="size-3" />
                .docx
              </a>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
