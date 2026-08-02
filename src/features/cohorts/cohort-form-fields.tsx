import {
  FormField,
  getFormFieldDescriptionId,
} from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Programme } from '@/features/programmes/types';

import {
  cohortStatusOptions,
  type Cohort,
  type CohortActionState,
} from './types';

interface CohortFormFieldsProps {
  state: CohortActionState;
  programmes: Programme[];
  cohort?: Cohort;
  pending: boolean;
}

export function CohortFormFields({
  state,
  programmes,
  cohort,
  pending,
}: CohortFormFieldsProps) {
  const programmeError =
    state.fieldErrors?.programmeId?.[0];

  const codeError =
    state.fieldErrors?.code?.[0];

  const nameError =
    state.fieldErrors?.name?.[0];

  const intakeDateError =
    state.fieldErrors?.intakeDate?.[0];

  const completionDateError =
    state.fieldErrors?.expectedCompletionDate?.[0];

  const currentPeriodError =
    state.fieldErrors?.currentAcademicPeriodNumber?.[0];

  const plannedSizeError =
    state.fieldErrors?.plannedSize?.[0];

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
        description="Select the parent programme for this cohort."
      >
        <Select
          id="cohort-programme"
          name="programmeId"
          required
          disabled={pending}
          defaultValue={
            cohort?.programmeId ?? ''
          }
          hasError={Boolean(programmeError)}
          aria-describedby={getFormFieldDescriptionId(
            'cohort-programme',
            {
              hasDescription: true,
              hasError: Boolean(programmeError),
            },
          )}
        >
          <option value="" disabled>
            Select programme
          </option>

          {programmes.map((programme) => (
            <option
              key={programme.id}
              value={programme.id}
            >
              {programme.code} - {programme.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="cohort-code"
          label="Cohort code"
          required
          error={codeError}
          description="Example: DHN-SEP-2026."
        >
          <Input
            id="cohort-code"
            name="code"
            required
            disabled={pending}
            defaultValue={cohort?.code ?? ''}
            hasError={Boolean(codeError)}
            aria-describedby={getFormFieldDescriptionId(
              'cohort-code',
              {
                hasDescription: true,
                hasError: Boolean(codeError),
              },
            )}
            placeholder="DHN-SEP-2026"
          />
        </FormField>

        <FormField
          id="cohort-status"
          label="Lifecycle status"
          required
          error={statusError}
        >
          <Select
            id="cohort-status"
            name="status"
            required
            disabled={pending}
            defaultValue={
              cohort?.status ?? 'planned'
            }
            hasError={Boolean(statusError)}
          >
            {cohortStatusOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

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
          defaultValue={cohort?.name ?? ''}
          hasError={Boolean(nameError)}
          placeholder="DHN September 2026"
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
            defaultValue={cohort?.intakeDate ?? ''}
            hasError={Boolean(intakeDateError)}
          />
        </FormField>

        <FormField
          id="cohort-completion-date"
          label="Expected completion date"
          required
          error={completionDateError}
        >
          <Input
            id="cohort-completion-date"
            name="expectedCompletionDate"
            type="date"
            required
            disabled={pending}
            defaultValue={
              cohort?.expectedCompletionDate ?? ''
            }
            hasError={Boolean(
              completionDateError,
            )}
          />
        </FormField>
      </div>

      <section className="space-y-4 rounded-xl border border-border-soft bg-surface-subtle p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Academic progress and enrolment
          </h3>

          <p className="mt-1 text-xs leading-5 text-text-muted">
            Define the current programme period and
            learner numbers used during timetable planning.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            id="cohort-current-period"
            label="Current period"
            required
            error={currentPeriodError}
            description="The cohort's current programme period number."
          >
            <Input
              id="cohort-current-period"
              name="currentAcademicPeriodNumber"
              type="number"
              min={1}
              max={60}
              required
              disabled={pending}
              defaultValue={
                cohort?.currentAcademicPeriodNumber ??
                1
              }
              hasError={Boolean(
                currentPeriodError,
              )}
              aria-describedby={getFormFieldDescriptionId(
                'cohort-current-period',
                {
                  hasDescription: true,
                  hasError: Boolean(
                    currentPeriodError,
                  ),
                },
              )}
            />
          </FormField>

          <FormField
            id="cohort-planned-size"
            label="Planned size"
            optional
            error={plannedSizeError}
          >
            <Input
              id="cohort-planned-size"
              name="plannedSize"
              type="number"
              min={1}
              max={5000}
              disabled={pending}
              defaultValue={
                cohort?.plannedSize ?? ''
              }
              hasError={Boolean(
                plannedSizeError,
              )}
              placeholder="50"
            />
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
              hasError={Boolean(actualSizeError)}
            />
          </FormField>
        </div>
      </section>

      <FormField
        id="cohort-notes"
        label="Notes"
        optional
        error={notesError}
      >
        <Textarea
          id="cohort-notes"
          name="notes"
          rows={4}
          maxLength={1500}
          disabled={pending}
          defaultValue={cohort?.notes ?? ''}
          hasError={Boolean(notesError)}
          placeholder="Add optional intake, enrolment or scheduling information."
        />
      </FormField>
    </>
  );
}