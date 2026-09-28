'use client';

import {
  CalendarCheck2,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';

import {
  FormField,
} from '@/components/ui/form-field';
import {
  Input,
} from '@/components/ui/input';
import {
  Select,
} from '@/components/ui/select';
import {
  Textarea,
} from '@/components/ui/textarea';
import type {
  AcademicPeriod,
} from '@/features/academic-periods/types';
import type {
  Programme,
} from '@/features/programmes/types';

import {
  calculateCohortProgression,
} from './calculations';
import {
  cohortStatusOptions,
  type Cohort,
  type CohortActionState,
} from './types';

interface CohortFormFieldsProps {
  state: CohortActionState;
  programmes: Programme[];
  academicPeriods: AcademicPeriod[];
  cohort?: Cohort;
  pending: boolean;
}

function generateCohortCode(
  programmeCode: string,
  intakeDate: string,
) {
  if (
    !programmeCode ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      intakeDate,
    )
  ) {
    return '';
  }

  const monthLabels = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ] as const;

  const [year, month] =
    intakeDate.split('-');

  const monthIndex =
    Number(month) - 1;

  const monthLabel =
    monthLabels[monthIndex];

  if (!monthLabel) {
    return '';
  }

  return `${programmeCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')}-${monthLabel}-${year}`;
}
function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'en-KE',
    {
      dateStyle: 'long',
      timeZone: 'UTC',
    },
  ).format(
    new Date(
      `${value}T00:00:00Z`,
    ),
  );
}

function getProgressionLabel(
  progressionState:
    | 'not_started'
    | 'in_progress'
    | 'completed',
  currentPeriod:
    number | null,
) {
  switch (progressionState) {
    case 'not_started':
      return 'Not started';

    case 'completed':
      return 'Completed';

    case 'in_progress':
      return currentPeriod
        ? `Period ${currentPeriod}`
        : '—';
  }
}

export function CohortFormFields({
  state,
  programmes,
  academicPeriods,
  cohort,
  pending,
}: CohortFormFieldsProps) {
  const [
    selectedProgrammeId,
    setSelectedProgrammeId,
  ] = useState(
    cohort?.programmeId ?? '',
  );

  const [
    intakeDate,
    setIntakeDate,
  ] = useState(
    cohort?.intakeDate ?? '',
  );

  const selectedProgramme =
    programmes.find(
      (programme) =>
        programme.id ===
        selectedProgrammeId,
    );

  const generatedCohortCode =
    selectedProgramme
      ? generateCohortCode(
          selectedProgramme.code,
          intakeDate,
        )
      : '';

  const progressionResult =
    useMemo(() => {
      if (
        !selectedProgramme ||
        !intakeDate
      ) {
        return null;
      }

      return calculateCohortProgression({
        intakeDate,

        totalAcademicPeriods:
          selectedProgramme
            .totalAcademicPeriods,

        academicPeriods:
          academicPeriods.map(
            (period) => ({
              id: period.id,
              name: period.name,
              sequenceNumber:
                period.sequenceNumber,
              startsOn:
                period.startsOn,
              endsOn:
                period.endsOn,
              academicYearStartsOn:
                period.academicYear
                  .startsOn,
            }),
          ),

        activeAcademicPeriodIds:
          academicPeriods
            .filter(
              (period) =>
                period.status ===
                'active',
            )
            .map(
              (period) =>
                period.id,
            ),
      });
    }, [
      academicPeriods,
      intakeDate,
      selectedProgramme,
    ]);

  const programmeError =
    state.fieldErrors?.programmeId?.[0];


  const nameError =
    state.fieldErrors?.name?.[0];

  const intakeDateError =
    state.fieldErrors?.intakeDate?.[0];

  const actualSizeError =
    state.fieldErrors?.actualSize?.[0];

  const statusError =
    state.fieldErrors?.status?.[0];

  const notesError =
    state.fieldErrors?.notes?.[0];

  return (
    <>
      <FormField
        id="cohort-programme"
        label="Programme"
        required
        error={programmeError}
      >
        <Select
          id="cohort-programme"
          name="programmeId"
          required
          disabled={pending}
          value={selectedProgrammeId}
          onChange={(event) =>
            setSelectedProgrammeId(
              event.target.value,
            )
          }
          hasError={
            Boolean(programmeError)
          }
        >
          <option
            value=""
            disabled
          >
            Select programme
          </option>

          {programmes.map(
            (programme) => (
              <option
                key={programme.id}
                value={programme.id}
              >
                {programme.code} -{' '}
                {programme.name}
              </option>
            ),
          )}
        </Select>
      </FormField>

      <input
        type="hidden"
        name="code"
        value={
          generatedCohortCode ||
          cohort?.code ||
          ''
        }
      />

      <FormField
        id="cohort-status"
        label="Status"
        required
        error={statusError}
      >
        <Select
          id="cohort-status"
          name="status"
          required
          disabled={pending}
          defaultValue={
            cohort?.status ??
            'planned'
          }
          hasError={
            Boolean(statusError)
          }
        >
          {cohortStatusOptions.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ),
          )}
        </Select>
      </FormField>

      <FormField
        id="cohort-name"
        label="Cohort name"
        required
        error={nameError}
      >
        <Input
          id="cohort-name"
          name="name"
          required
          disabled={pending}
          defaultValue={
            cohort?.name ?? ''
          }
          hasError={
            Boolean(nameError)
          }
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="cohort-intake-date"
          label="Intake date"
          required
          error={intakeDateError}
        >
          <Input
            id="cohort-intake-date"
            name="intakeDate"
            type="date"
            required
            disabled={pending}
            value={intakeDate}
            onChange={(event) =>
              setIntakeDate(
                event.target.value,
              )
            }
            hasError={
              Boolean(
                intakeDateError,
              )
            }
          />
        </FormField>

        <FormField
          id="cohort-completion-date"
          label="Expected completion"
          error={
            progressionResult
              ?.status === 'error'
              ? progressionResult.message
              : undefined
          }
        >
          <div className="flex min-h-11 items-center rounded-xl border border-border-strong bg-surface-subtle px-3 text-sm">
            {progressionResult
              ?.status ===
            'success' ? (
              <span className="flex items-center gap-2 font-semibold text-text-primary">
                <CalendarCheck2
                  className="size-4 text-success"
                  aria-hidden="true"
                />

                {formatDate(
                  progressionResult
                    .calculation
                    .expectedCompletionDate,
                )}
              </span>
            ) : (
              <span className="text-text-muted">
                —
              </span>
            )}
          </div>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="cohort-current-period"
          label="Current period"
        >
          <div className="flex min-h-11 items-center rounded-xl border border-border-strong bg-surface-subtle px-3 text-sm font-semibold text-text-primary">
            {progressionResult
              ?.status ===
            'success'
              ? getProgressionLabel(
                  progressionResult
                    .calculation
                    .progressionState,
                  progressionResult
                    .calculation
                    .currentAcademicPeriodNumber,
                )
              : '—'}
          </div>
        </FormField>

        <FormField
          id="cohort-actual-size"
          label="Actual size"
          required
          error={actualSizeError}
        >
          <Input
            id="cohort-actual-size"
            name="actualSize"
            type="number"
            min={0}
            max={5000}
            required
            disabled={pending}
            defaultValue={
              cohort?.actualSize ?? 0
            }
            hasError={
              Boolean(
                actualSizeError,
              )
            }
          />
        </FormField>
      </div>

      <FormField
        id="cohort-notes"
        label="Notes"
        optional
        error={notesError}
      >
        <Textarea
          id="cohort-notes"
          name="notes"
          rows={3}
          maxLength={1500}
          disabled={pending}
          defaultValue={
            cohort?.notes ?? ''
          }
          hasError={
            Boolean(notesError)
          }
        />
      </FormField>
    </>
  );
}