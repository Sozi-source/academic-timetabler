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

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-text-secondary">
            <FileSpreadsheet
              className="size-4"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text-primary">
              Blank template
            </h2>

            <p className="mt-1 text-xs leading-5 text-text-muted">
              Download an empty standardized workbook
              and enter the Semester Units on Offer
              manually.
            </p>

            <TemplateDownloadLink
              entityType="unit_offerings"
              label="Download blank template"
              className="mt-3"
            />
          </div>
        </div>
      </Card>

      <Card className="border-primary/20 bg-primary-subtle p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Sparkles
              className="size-4"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text-primary">
              Prefilled semester template
            </h2>

            <p className="mt-1 text-xs leading-5 text-text-muted">
              Generate a workbook from the programme
              units you registered for each active
              cohort&apos;s current stage.
            </p>

            <label
              htmlFor="unit-offering-academic-period"
              className="mt-3 block text-sm font-medium text-text-secondary"
            >
              Academic Period
            </label>

            <Select
              id="unit-offering-academic-period"
              value={academicPeriodId}
              onChange={(event) =>
                setAcademicPeriodId(
                  event.target.value,
                )
              }
              className="mt-1.5"
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
            </Select>

            {academicPeriodId ? (
              <form
                action="/api/import-templates/unit_offerings/prefilled"
                method="get"
                className="mt-3"
              >
                <input
                  type="hidden"
                  name="academicPeriodId"
                  value={academicPeriodId}
                />

                <Button
                  type="submit"
                  leadingIcon={<Download className="size-4" aria-hidden="true" />}
                >
                  Download prefilled template
                </Button>
              </form>
            ) : (
              <Button
                type="button"
                disabled
                className="mt-3"
                leadingIcon={<Download className="size-4" aria-hidden="true" />}
              >
                Download prefilled template
              </Button>
            )}

            {selectedPeriod ? (
              <p className="mt-2.5 text-xs leading-5 text-text-muted">
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
      </Card>
    </div>
  );
}
