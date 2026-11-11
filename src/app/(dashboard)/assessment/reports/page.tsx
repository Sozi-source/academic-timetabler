import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { ConsolidatedMarksheetViewer } from '@/features/assessment/reports/consolidated-marksheet-viewer';
import { getActiveAssessmentPeriodReportData } from '@/features/assessment/reports/queries';
import { getAssessmentReportReadiness } from '@/features/assessment/reports/readiness';
import { requireHodAccess } from '@/features/auth/authorization';

interface PageProps {
  searchParams: Promise<{
    periodId?: string;
    view?: 'cohort' | 'unit';
    cohortId?: string;
    unitId?: string;
  }>;
}

function ReportCard({
  title,
  href,
  ready,
  status,
}: {
  title: string;
  href: string;
  ready: boolean;
  status: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xs font-bold text-slate-900">{title}</h2>
          <div
            className={`flex size-7 items-center justify-center rounded-lg ${
              ready
                ? 'bg-slate-100 text-slate-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {ready ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <TriangleAlert className="size-3.5" />
            )}
          </div>
        </div>

        <p className="mt-3 text-[11px] font-semibold text-slate-700">{status}</p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200">
        {ready ? (
          <a
            href={href}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <Download className="size-3.5" />
            Download Word (.docx)
          </a>
        ) : (
          <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-600">
            Awaiting mark submissions
          </span>
        )}
      </div>
    </div>
  );
}

export default async function AssessmentReportsPage({ searchParams }: PageProps) {
  await requireHodAccess();
  const params = await searchParams;
  const data = await getActiveAssessmentPeriodReportData(params.periodId);

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Examination Reports & Broadsheets Centre"
          icon={FileText}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No active academic period or departmental assessment records found.
        </div>
      </div>
    );
  }

  const readiness = getAssessmentReportReadiness(data);

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Examination Reports & Broadsheets Centre"
        description={`${data.periodName} · Academic Board Broadsheets, Unit Marksheets & Documentation`}
        icon={FileSpreadsheet}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/assessment"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <ArrowLeft className="size-3.5 text-slate-500" />
              <span>Assessment Hub</span>
            </Link>
          </div>
        }
      />

      {/* Interactive Consolidated Marksheets & Broadsheet Viewer */}
      <ConsolidatedMarksheetViewer
        data={data}
        initialView={params.view === 'unit' ? 'unit' : 'cohort'}
        initialCohortId={params.cohortId}
        initialUnitId={params.unitId}
      />

      {/* Official Documentation & External Broadsheet Downloads */}
      <section className="space-y-3 pt-4 border-t border-slate-200 print:hidden">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Official Examination Board Downloads & Oversight
          </h2>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <ReportCard
            title="CAT Marks Report"
            href="/api/assessment/reports/cat"
            ready={readiness.catReady}
            status={
              readiness.catReady
                ? `${readiness.catMarkedRows} marks in ${readiness.unitCount} units.`
                : 'No committed CAT marks.'
            }
          />

          <ReportCard
            title="Final Exam Broadsheet"
            href="/api/assessment/reports/exam"
            ready={readiness.examReady}
            status={
              readiness.examReady
                ? `${readiness.examFinalRows} finalized records.`
                : readiness.examAttendancePendingRows > 0
                  ? `${readiness.examAttendancePendingRows} records pending.`
                  : 'Exam marks in progress.'
            }
          />

          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xs font-bold text-slate-900">Attendance Oversight</h2>
                <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <CheckCircle2 className="size-3.5" />
                </div>
              </div>
              <p className="mt-3 text-[11px] font-medium text-slate-600">
                {readiness.examAttendancePendingRows > 0
                  ? `${readiness.examAttendancePendingRows} registers pending review.`
                  : 'All exam registers submitted.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href="/operations/attendance"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                Review Attendance
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xs font-bold text-slate-900">Marks Control Center</h2>
                <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <CheckCircle2 className="size-3.5" />
                </div>
              </div>
              <p className="mt-3 text-[11px] font-medium text-slate-600">
                {readiness.unitCount} units monitored in {data.periodName}.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href="/assessment"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                Control Center
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
