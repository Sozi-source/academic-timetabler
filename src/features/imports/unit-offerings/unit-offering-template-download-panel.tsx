'use client';

import {
  Download,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';

import {
  TemplateDownloadLink,
} from '@/features/imports/template-download-link';

export interface UnitOfferingAcademicPeriodOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface UnitOfferingTemplateDownloadPanelProps {
  academicPeriods:
    UnitOfferingAcademicPeriodOption[];
}

export function UnitOfferingTemplateDownloadPanel({
  academicPeriods,
}: UnitOfferingTemplateDownloadPanelProps) {
  const defaultPeriod =
    academicPeriods.find(
      (period) =>
        period.status === 'active',
    ) ??
    academicPeriods[0] ??
    null;

  const [
    academicPeriodId,
    setAcademicPeriodId,
  ] = useState(
    defaultPeriod?.id ?? '',
  );

  const selectedPeriod =
    useMemo(
      () =>
        academicPeriods.find(
          (period) =>
            period.id ===
            academicPeriodId,
        ) ?? null,
      [
        academicPeriodId,
        academicPeriods,
      ],
    );

  const prefilledHref =
    academicPeriodId
      ? `/api/import-templates/unit_offerings/prefilled?academicPeriodId=${encodeURIComponent(
          academicPeriodId,
        )}`
      : null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-text-secondary">
            <FileSpreadsheet
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-text-primary">
              Blank template
            </h2>

            <p className="mt-1 text-sm leading-6 text-text-muted">
              Download an empty standardized workbook
              and enter the Semester Units on Offer
              manually.
            </p>

            <TemplateDownloadLink
              entityType="unit_offerings"
              label="Download blank template"
              className="mt-4"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary-subtle p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Sparkles
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-text-primary">
              Prefilled semester template
            </h2>

            <p className="mt-1 text-sm leading-6 text-text-muted">
              Generate a workbook from the programme
              units you registered for each active
              cohort&apos;s current stage.
            </p>

            <label
              htmlFor="unit-offering-academic-period"
              className="mt-4 block text-sm font-semibold text-text-secondary"
            >
              Academic Period
            </label>

            <select
              id="unit-offering-academic-period"
              value={academicPeriodId}
              onChange={(event) =>
                setAcademicPeriodId(
                  event.target.value,
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {academicPeriods.length ===
              0 ? (
                <option value="">
                  No Academic Periods available
                </option>
              ) : null}

              {academicPeriods.map(
                (period) => (
                  <option
                    key={period.id}
                    value={period.id}
                  >
                    {period.name} ({period.code})
                  </option>
                ),
              )}
            </select>

            {prefilledHref ? (
              <a
                href={prefilledHref}
                download
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Download
                  className="size-4"
                  aria-hidden="true"
                />
                Download prefilled template
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="mt-4 inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-surface-muted px-4 text-sm font-semibold text-text-muted opacity-70"
              >
                <Download
                  className="size-4"
                  aria-hidden="true"
                />
                Download prefilled template
              </button>
            )}

            {selectedPeriod ? (
              <p className="mt-3 text-xs leading-5 text-text-muted">
                The workbook will use only database
                records eligible for{' '}
                <span className="font-semibold text-text-secondary">
                  {selectedPeriod.name}
                </span>
                .
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}