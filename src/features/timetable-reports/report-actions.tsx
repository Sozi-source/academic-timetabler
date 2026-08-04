'use client';

import { Download, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { TimetableReportKind } from './types';

export function TimetableReportActions({
  academicPeriodId,
  report,
}: {
  academicPeriodId: string;
  report: TimetableReportKind;
}) {
  const href = `/api/timetable/reports/export?academicPeriodId=${encodeURIComponent(
    academicPeriodId,
  )}&report=${encodeURIComponent(report)}`;

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
        href={href}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35"
      >
        <Download className="size-4" aria-hidden="true" />
        Export CSV
      </a>
    </div>
  );
}
