import { AlertTriangle, ArrowLeft, BarChart3, BookOpenCheck, CheckCircle2, FileUp, GraduationCap, History, Paperclip, RefreshCw, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStudentSummary } from '@/features/students/queries';

export default async function StudentsModulePage() {
  await requireHodAccess();
  const summary = await getStudentSummary();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Module 02"
        title="Student Lifecycle"
        description="Department student operations."
        icon={GraduationCap}
        context={<Badge variant="success">Active</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Dashboard
            </Link>
            <Button asChild>
              <Link href="/students/registry">Student registry</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 sm:gap-3">
        <MetricCard label="In Class" value={String(summary.inClass)} description="Current" icon={CheckCircle2} />
        <MetricCard label="On Attachment" value={String(summary.onAttachment)} description="Active phase" icon={Paperclip} />
        <MetricCard label="Deferred" value={String(summary.deferred)} description="Expected back" icon={History} />
        <MetricCard label="Dropped out" value={String(summary.droppedOut)} description="Follow-up" icon={AlertTriangle} />
        <MetricCard label="Completed" value={String(summary.completed)} description="Awaiting graduation" icon={GraduationCap} />
        <MetricCard label="Graduated" value={String(summary.graduated)} description="Historical" icon={GraduationCap} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 sm:gap-3">
        <Card className="flex items-center justify-between gap-3 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 sm:size-9 items-center justify-center rounded-lg bg-primary text-white"><UsersRound className="size-4" /></span>
            <div><p className="text-xs sm:text-sm font-bold text-text-primary">Student registry</p><p className="text-[11px] sm:text-xs text-text-muted">{summary.total} records</p></div>
          </div>
          <Link href="/students/registry" className="text-xs font-semibold text-primary hover:underline">Open</Link>
        </Card>

        <Card className="flex items-center justify-between gap-3 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 sm:size-9 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink"><RefreshCw className="size-4" /></span>
            <div><p className="text-xs sm:text-sm font-bold text-text-primary">Update statuses</p><p className="text-[11px] sm:text-xs text-text-muted">Inline bulk update</p></div>
          </div>
          <Link href="/students/status" className="text-xs font-semibold text-primary hover:underline">Open</Link>
        </Card>

        <Card className="flex items-center justify-between gap-3 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 sm:size-9 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink"><BookOpenCheck className="size-4" /></span>
            <div><p className="text-xs sm:text-sm font-bold text-text-primary">Unit registration</p><p className="text-[11px] sm:text-xs text-text-muted">Roster &amp; verification</p></div>
          </div>
          <Link href="/students/unit-registration" className="text-xs font-semibold text-primary hover:underline">Open</Link>
        </Card>

        <Card className="flex items-center justify-between gap-3 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 sm:size-9 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink"><FileUp className="size-4" /></span>
            <div><p className="text-xs sm:text-sm font-bold text-text-primary">Student onboarding</p><p className="text-[11px] sm:text-xs text-text-muted">Excel import</p></div>
          </div>
          <Link href="/students/registry/import" className="text-xs font-semibold text-primary hover:underline">Open</Link>
        </Card>

        <Card className="flex items-center justify-between gap-3 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 sm:size-9 items-center justify-center rounded-lg bg-primary text-white"><BarChart3 className="size-4" /></span>
            <div><p className="text-xs sm:text-sm font-bold text-text-primary">Student reports</p><p className="text-[11px] sm:text-xs text-text-muted">Census &amp; Excel</p></div>
          </div>
          <Link href="/students/reports" className="text-xs font-semibold text-primary hover:underline">Open</Link>
        </Card>
      </div>
    </div>
  );
}
