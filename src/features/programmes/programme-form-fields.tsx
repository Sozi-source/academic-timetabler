import {
  FormField,
  getFormFieldDescriptionId,
} from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  programmeAwardLevelOptions,
  programmeDurationUnitOptions,
  type Programme,
  type ProgrammeActionState,
} from './types';

interface ProgrammeFormFieldsProps {
  state: ProgrammeActionState;
  programme?: Programme;
  pending: boolean;
}

export function ProgrammeFormFields({
  state,
  programme,
  pending,
}: ProgrammeFormFieldsProps) {
  const codeError =
    state.fieldErrors?.code?.[0];

  const nameError =
    state.fieldErrors?.name?.[0];

  const shortNameError =
    state.fieldErrors?.shortName?.[0];

  const awardLevelError =
    state.fieldErrors?.awardLevel?.[0];

  const awardingBodyError =
    state.fieldErrors?.awardingBody?.[0];

  const durationValueError =
    state.fieldErrors?.durationValue?.[0];

  const durationUnitError =
    state.fieldErrors?.durationUnit?.[0];

  const totalAcademicPeriodsError =
    state.fieldErrors?.totalAcademicPeriods?.[0];

  const maximumCohortSizeError =
    state.fieldErrors?.maximumCohortSize?.[0];

  const notesError =
    state.fieldErrors?.notes?.[0];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="programme-code"
          label="Programme code"
          required
          error={codeError}
          description="Use the institution's official programme identifier."
        >
          <Input
            id="programme-code"
            name="code"
            required
            disabled={pending}
            defaultValue={programme?.code ?? ''}
            hasError={Boolean(codeError)}
            aria-describedby={getFormFieldDescriptionId(
              'programme-code',
              {
                hasDescription: true,
                hasError: Boolean(codeError),
              },
            )}
            placeholder="DHN"
          />
        </FormField>

        <FormField
          id="programme-short-name"
          label="Short name"
          optional
          error={shortNameError}
        >
          <Input
            id="programme-short-name"
            name="shortName"
            disabled={pending}
            defaultValue={
              programme?.shortName ?? ''
            }
            hasError={Boolean(shortNameError)}
            placeholder="Diploma HND"
          />
        </FormField>
      </div>

      <FormField
        id="programme-name"
        label="Official programme name"
        required
        error={nameError}
      >
        <Input
          id="programme-name"
          name="name"
          required
          disabled={pending}
          defaultValue={programme?.name ?? ''}
          hasError={Boolean(nameError)}
          placeholder="Diploma in Human Nutrition and Dietetics"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="programme-award-level"
          label="Award level"
          required
          error={awardLevelError}
        >
          <Select
            id="programme-award-level"
            name="awardLevel"
            required
            disabled={pending}
            defaultValue={
              programme?.awardLevel ??
              'diploma'
            }
            hasError={Boolean(awardLevelError)}
          >
            {programmeAwardLevelOptions.map(
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
          id="programme-awarding-body"
          label="Awarding body"
          optional
          error={awardingBodyError}
        >
          <Input
            id="programme-awarding-body"
            name="awardingBody"
            disabled={pending}
            defaultValue={
              programme?.awardingBody ?? ''
            }
            hasError={Boolean(awardingBodyError)}
            placeholder="TVET CDACC"
          />
        </FormField>
      </div>

      <section className="space-y-4 rounded-xl border border-border-soft bg-surface-subtle p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Programme duration
          </h3>

          <p className="mt-1 text-xs leading-5 text-text-muted">
            Define the official programme duration and
            expected number of Academic Periods.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="programme-duration-value"
            label="Duration"
            required
            error={durationValueError}
          >
            <Input
              id="programme-duration-value"
              name="durationValue"
              type="number"
              min={0.5}
              max={20}
              step={0.5}
              required
              disabled={pending}
              defaultValue={
                programme?.durationValue ?? 3
              }
              hasError={Boolean(
                durationValueError,
              )}
            />
          </FormField>

          <FormField
            id="programme-duration-unit"
            label="Duration unit"
            required
            error={durationUnitError}
          >
            <Select
              id="programme-duration-unit"
              name="durationUnit"
              required
              disabled={pending}
              defaultValue={
                programme?.durationUnit ??
                'years'
              }
              hasError={Boolean(
                durationUnitError,
              )}
            >
              {programmeDurationUnitOptions.map(
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="programme-periods"
            label="Total Academic Periods"
            required
            error={totalAcademicPeriodsError}
            description="The expected number of terms, semesters or other configured periods."
          >
            <Input
              id="programme-periods"
              name="totalAcademicPeriods"
              type="number"
              min={1}
              max={60}
              required
              disabled={pending}
              defaultValue={
                programme?.totalAcademicPeriods ??
                9
              }
              hasError={Boolean(
                totalAcademicPeriodsError,
              )}
              aria-describedby={getFormFieldDescriptionId(
                'programme-periods',
                {
                  hasDescription: true,
                  hasError: Boolean(
                    totalAcademicPeriodsError,
                  ),
                },
              )}
            />
          </FormField>

          <FormField
            id="programme-cohort-size"
            label="Maximum cohort size"
            optional
            error={maximumCohortSizeError}
            description="Optional planning limit for one cohort."
          >
            <Input
              id="programme-cohort-size"
              name="maximumCohortSize"
              type="number"
              min={1}
              max={5000}
              disabled={pending}
              defaultValue={
                programme?.maximumCohortSize ??
                ''
              }
              hasError={Boolean(
                maximumCohortSizeError,
              )}
              aria-describedby={getFormFieldDescriptionId(
                'programme-cohort-size',
                {
                  hasDescription: true,
                  hasError: Boolean(
                    maximumCohortSizeError,
                  ),
                },
              )}
              placeholder="50"
            />
          </FormField>
        </div>
      </section>

      <FormField
        id="programme-notes"
        label="Notes"
        optional
        error={notesError}
      >
        <Textarea
          id="programme-notes"
          name="notes"
          rows={4}
          maxLength={1500}
          disabled={pending}
          defaultValue={programme?.notes ?? ''}
          hasError={Boolean(notesError)}
          placeholder="Add optional curriculum, accreditation or planning information."
        />
      </FormField>
    </>
  );
}