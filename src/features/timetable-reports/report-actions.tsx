'use client';

import { Download, FileText, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { TimetableReportKind } from './types';

export function TimetableReportActions({
  academicPeriodId,
  report,
}: {
  academicPeriodId: string;
  report: TimetableReportKind;
}) {
  const exportBase = `/api/timetable/reports/export?academicPeriodId=${encodeURIComponent(
    academicPeriodId,
  )}&report=${encodeURIComponent(report)}`;
  const csvHref = `${exportBase}&format=csv`;
  const pdfHref = `${exportBase}&format=pdf`;
  const docxHref = `${exportBase}&format=docx`;
  const hasTemplatePdf = report === 'master' || report === 'trainer';
  const hasEditableDocx = report === 'master' || report === 'trainer';

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        leadingIcon={<Printer className="size-4" aria-hidden="true" />}
        onClick={() => window.print()}
      >
        Print
      </Button>
      <a
        href={csvHref}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-primary shadow-sm transition hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35"
      >
        <Download className="size-4" aria-hidden="true" />
        Export CSV
      </a>
      {hasEditableDocx ? (
        <a
          href={docxHref}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-primary shadow-sm transition hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35"
        >
          <FileText className="size-4" aria-hidden="true" />
          Export editable Word
        </a>
      ) : null}
      {hasTemplatePdf ? (
        <a
          href={pdfHref}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35"
        >
          <Download className="size-4" aria-hidden="true" />
          Export template PDF
        </a>
      ) : null}
    </div>
  );
}
