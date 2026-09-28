import { Archive, FileCheck2, FileDown, FileText } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getQaExportPageData } from '@/features/teaching-documents/qa-export';

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(date);
}

export default async function TeachingDocumentQaExportPage() {
  const data = await getQaExportPageData();

  return (
    <div className="admin-screen space-y-5">
      <PageHeader
        eyebrow="Curriculum & QA"
        title="QA Examination Export"
        description="Package approved trainer outlines and schemes of work by academic period."
        icon={Archive}
        backHref="/teaching-documents"
        backLabel="Documents"
        actions={
          <Link
            href="/teaching-documents/review"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <FileCheck2 className="size-3.5" aria-hidden="true" />
            Review documents
          </Link>
        }
      />

      {!data.departmentSelected ? (
        <EmptyState
          icon={Archive}
          title="Choose a working department"
          description="Select an active department before creating a quality assurance export."
        />
      ) : data.periods.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No trainer allocations found"
          description={`There are no active, completed, or archived trainer allocations for ${data.departmentName}.`}
        />
      ) : (
        <>
          <section className="rounded-xl border border-border bg-white p-4 shadow-2xs sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Archive className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Create examination pack</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">
                  The ZIP includes a folder for every allocated trainer, separate Course Outlines and Schemes of Work folders, and a QA index. Only the exact approved revision is included. The index lists missing or unavailable documents.
                </p>
              </div>
            </div>

            <form
              action="/api/teaching-documents/qa-export"
              method="get"
              className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <label className="grid min-w-0 flex-1 gap-1.5 text-[11px] font-semibold text-text-secondary sm:max-w-xl">
                Academic period
                <select
                  name="academicPeriodId"
                  required
                  defaultValue=""
                  className="h-10 rounded-lg border border-border-strong bg-white px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="" disabled>Select an academic period</option>
                  {data.periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name} ({formatDate(period.startsOn)} – {formatDate(period.endsOn)})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
              >
                <FileDown className="size-4" aria-hidden="true" />
                Download QA ZIP
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-white shadow-2xs">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-xs font-bold text-text-primary">Available periods</h2>
                <p className="mt-0.5 text-[10px] text-text-muted">Approval coverage for the selected department</p>
              </div>
              <Badge variant="info">{data.periods.length} periods</Badge>
            </div>
            <div className="divide-y divide-border">
              {data.periods.map((period) => {
                const missing = Math.max(0, period.expectedDocuments - period.approvedDocuments);
                return (
                  <div key={period.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">{period.name}</p>
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        {formatDate(period.startsOn)} – {formatDate(period.endsOn)} · {period.trainerCount} trainers · {period.allocationCount} allocations
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={missing === 0 ? 'success' : 'warning'}>
                        {period.approvedDocuments}/{period.expectedDocuments} approved
                      </Badge>
                      {missing > 0 ? <span className="text-[10px] text-text-muted">{missing} missing</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
