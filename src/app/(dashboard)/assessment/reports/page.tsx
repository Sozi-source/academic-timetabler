import { CheckCircle2, Download, FileText, TriangleAlert } from 'lucide-react';

import { Card } from '@/components/ui/card';
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
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">{title}</h2>
          <p className="mt-1 text-xs text-text-muted">{description}</p>
        </div>
        <div className={`flex size-8 items-center justify-center rounded-lg ${ready ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>
          {ready ? <CheckCircle2 className="size-4" /> : <TriangleAlert className="size-4" />}
        </div>
      </div>

      <p className="mt-3 text-xs font-semibold text-text-secondary">{status}</p>

      {ready ? (
        <a
          href={href}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white"
        >
          <Download className="size-3.5" />
          Download DOCX
        </a>
      ) : (
        <span className="mt-4 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-text-muted">
          Complete current markbooks first
        </span>
      )}
    </Card>
  );
}

export default async function AssessmentReportsPage() {
  await requireHodAccess();
  const data = await getActiveAssessmentPeriodReportData();

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Assessment" title="CAT & exam reports" description="No active academic period" icon={FileText} />
      </div>
    );
  }

  const readiness = getAssessmentReportReadiness(data);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="CAT & exam reports"
        description={data.periodName}
        icon={FileText}
        backHref="/assessment"
        backLabel="Assessments"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ReportCard
          title="CAT analysis report"
          description="Institutional CAT analysis format."
          href="/api/assessment/reports/cat"
          ready={readiness.catReady}
          status={
            readiness.catReady
              ? `${readiness.catMarkedRows} CAT mark record(s) available across ${readiness.unitCount} unit(s).`
              : 'No committed CAT marks are available yet.'
          }
        />

        <ReportCard
          title="Exam analysis report"
          description="Institutional end-term exam analysis format."
          href="/api/assessment/reports/exam"
          ready={readiness.examReady}
          status={
            readiness.examReady
              ? `${readiness.examFinalRows} finalized exam record(s) available.`
              : readiness.examAttendancePendingRows > 0
                ? `${readiness.examAttendancePendingRows} attendance record(s) are still pending.`
                : 'Final exam marks have not been completed.'
          }
        />
      </div>
    </div>
  );
}
