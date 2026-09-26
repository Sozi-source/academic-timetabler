import {
  BookOpen,
  CalendarCheck2,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  PlusCircle,
  UsersRound,
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
        title={context.allocation.unitName}
        description={context.allocation.cohortName}
      />

      {/* TEACHING DOCUMENTS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">
              Teaching Documents
            </h2>
            <p className="text-xs text-text-muted">
              Official unit files.
            </p>
          </div>
          <Badge variant="success">Official</Badge>
        </div>

        <div className="portal-card-grid" data-columns="3">
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
                Outcomes, schedule, grading, and references.
              </p>
            </div>
            <div className="mt-4 flex gap-2 border-t border-border pt-3">
              <Link
                href={`/staff/units/${allocationId}/documents/course-outline`}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <BookOpen className="size-3.5" />
                View Outline
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
                Weekly lessons, activities, and resources.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex gap-2">
              <Link
                href={`/staff/units/${allocationId}/documents/scheme-of-work`}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <FileSpreadsheet className="size-3.5" />
                View Scheme
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
                Weekly delivery and attendance log.
              </p>
              <div className="mt-2 text-[10px] font-semibold text-primary">
                {uniqueWeeksCount} of 14 Weeks Logged ({entriesCount} sessions)
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-primary/20">
              <Link
                href={`/staff/units/${allocationId}/documents/record-of-work`}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <PlusCircle className="size-3.5" />
                Log Progress
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* ATTENDANCE & SIGNING SHEETS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">
              Attendance & Signing Sheets
            </h2>
            <p className="text-xs text-text-muted">
              Pre-populated registers with registered students.
            </p>
          </div>
          <Badge variant="neutral">3 Sheets</Badge>
        </div>

        <div className="portal-card-grid" data-columns="3">
          {/* Card 1: Class Attendance Register */}
          <Card className="flex flex-col justify-between p-4 shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <UsersRound className="size-4" />
                </span>
                <Badge variant="neutral">14 Weeks</Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">
                Class Attendance Sheet
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                Weekly lesson attendance roll for student signatures.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <a
                href={`/api/staff/units/${allocationId}/attendance-sheet/class?format=pdf`}
                download
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-[0.99]"
                title="Download Class Attendance PDF"
              >
                <Download className="size-3.5" />
                Download PDF
              </a>
            </div>
          </Card>

          {/* Card 2: CAT Signing Sheet */}
          <Card className="flex flex-col justify-between p-4 shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-amber-50 p-2 text-amber-700">
                  <FileSpreadsheet className="size-4" />
                </span>
                <Badge variant="neutral">Test Register</Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">
                CAT Attendance List
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                Candidate test attendance and signature roll.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <a
                href={`/api/staff/units/${allocationId}/attendance-sheet/cat?format=pdf`}
                download
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-[0.99]"
                title="Download CAT Attendance PDF"
              >
                <Download className="size-3.5" />
                Download PDF
              </a>
            </div>
          </Card>

          {/* Card 3: Exam Attendance List */}
          <Card className="flex flex-col justify-between p-4 shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                  <FileSpreadsheet className="size-4" />
                </span>
                <Badge variant="neutral">Final Exam</Badge>
              </div>
              <h3 className="mt-3 text-sm font-bold text-text-primary">
                Exam Attendance List
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                Official candidate examination and script booklet register.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <a
                href={`/api/staff/units/${allocationId}/attendance-sheet/exam?format=pdf`}
                download
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-[0.99]"
                title="Download Exam Attendance PDF"
              >
                <Download className="size-3.5" />
                Download PDF
              </a>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
