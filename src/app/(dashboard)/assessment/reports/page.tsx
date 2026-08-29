import { ArrowLeft, CheckCircle2, Download, FileText, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { getActiveAssessmentPeriodReportData } from '@/features/assessment/reports/queries';
import { getAssessmentReportReadiness } from '@/features/assessment/reports/readiness';
import { requireHodAccess } from '@/features/auth/authorization';

function ReportCard({
  title,
  description,
  href,
  ready,
  status,
}: {
  title: string;
  description: string;
  href: string;
  ready: boolean;
  status: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
          </div>
          <div
            className={`flex size-7 items-center justify-center rounded-lg ${
              ready
                ? 'bg-slate-100 text-slate-700'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            {ready ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <TriangleAlert className="size-3.5" />
            )}
          </div>
        </div>

        <p className="mt-3 text-[11px] font-medium text-slate-600">{status}</p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100">
        {ready ? (
          <a
            href={href}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <Download className="size-3.5" />
            Download Word (.docx)
          </a>
        ) : (
          <span className="inline-flex h-8 items-center rounded-lg border border-slate-100 bg-slate-50 px-3 text-xs font-semibold text-slate-400">
            Awaiting mark submissions
          </span>
        )}
      </div>
    </div>
  );
}

export default async function AssessmentReportsPage() {
  await requireHodAccess();
  const data = await getActiveAssessmentPeriodReportData();

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Examination Reports Centre"
          description="No active academic period found"
          icon={FileText}
        />
      </div>
    );
  }

  const readiness = getAssessmentReportReadiness(data);

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Examination Reports Centre"
        description={`${data.periodName} · Academic Board & Departmental Broadsheets`}
        icon={FileText}
        actions={
          <Link
            href="/assessment"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <ArrowLeft className="size-3.5 text-slate-500" />
            <span>Assessment Hub</span>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ReportCard
          title="CAT Performance Report"
          description="Continuous assessment test breakdown by unit and student."
          href="/api/assessment/reports/cat"
          ready={readiness.catReady}
          status={
            readiness.catReady
              ? `${readiness.catMarkedRows} marks available across ${readiness.unitCount} units.`
              : 'No committed CAT marks yet.'
          }
        />

        <ReportCard
          title="Final Exam & Broadsheet Report"
          description="Official end-term grade distributions, means, and pass statistics."
          href="/api/assessment/reports/exam"
          ready={readiness.examReady}
          status={
            readiness.examReady
              ? `${readiness.examFinalRows} finalized exam records available.`
              : readiness.examAttendancePendingRows > 0
                ? `${readiness.examAttendancePendingRows} records pending.`
                : 'Final exam marks in progress.'
          }
        />
      </div>
    </div>
  );
}
