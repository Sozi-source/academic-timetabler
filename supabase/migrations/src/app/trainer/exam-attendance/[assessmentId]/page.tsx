import { ArrowLeft, CheckCircle2, ClipboardCheck, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AbsenceSelector } from '@/features/trainer-exam-attendance/absence-selector';
import { getTrainerAttendanceWorkspace } from '@/features/trainer-exam-attendance/queries';

interface Props {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}

export default async function TrainerExamAttendanceWorkspacePage({
  params,
  searchParams,
}: Props) {
  const { assessmentId } = await params;
  const query = await searchParams;
  const workspace = await getTrainerAttendanceWorkspace(assessmentId);

  if (!workspace) notFound();

  const locked = Boolean(workspace.examMarksFinalizedAt);
  const confirmed = Boolean(workspace.attendanceFinalizedAt);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/trainer/exam-attendance"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary"
          >
            <ArrowLeft className="size-3.5" />
            My units
          </Link>
          <p className="mt-3 text-xs font-semibold text-text-muted">{workspace.unitCode}</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-text-primary">{workspace.unitName}</h1>
          <p className="mt-1 text-sm text-text-muted">{workspace.academicPeriodName}</p>
        </div>

        <Badge variant={locked || confirmed ? 'success' : 'neutral'}>
          {locked ? 'Locked' : confirmed ? 'Attendance confirmed' : 'Attendance pending'}
        </Badge>
      </div>

      {query.saved ? (
        <div className="flex items-center gap-2 rounded-lg bg-success-subtle px-3 py-2 text-xs font-semibold text-success">
          <CheckCircle2 className="size-4" />
          Exam attendance saved.
        </div>
      ) : null}

      {query.error ? (
        <div className="rounded-lg bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">
          {decodeURIComponent(query.error)}
        </div>
      ) : null}

      <Card className="p-4">
        <div className="flex items-start gap-3 border-b border-border pb-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-subtle text-primary">
            {locked ? <LockKeyhole className="size-4" /> : <ClipboardCheck className="size-4" />}
          </span>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Record absentees only</h2>
            <p className="mt-1 text-xs text-text-muted">
              Everyone is treated as present unless you mark them absent from the physical signed attendance sheet.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <AbsenceSelector
            assessmentId={workspace.assessmentId}
            students={workspace.students}
            locked={locked}
          />
        </div>
      </Card>
    </div>
  );
}
