import {
  FormField,
} from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  trainerEmploymentTypeOptions,
  type Trainer,
  type TrainerActionState,
} from './types';

interface TrainerFormFieldsProps {
  state: TrainerActionState;
  trainer?: Trainer;
  pending: boolean;
}

export function TrainerFormFields({
  state,
  trainer,
  pending,
}: TrainerFormFieldsProps) {
  const staffNumberError =
    state.fieldErrors?.staffNumber?.[0];

  const fullNameError =
    state.fieldErrors?.fullName?.[0];

  const emailError =
    state.fieldErrors?.email?.[0];

  const phoneNumberError =
    state.fieldErrors?.phoneNumber?.[0];

  const employmentTypeError =
    state.fieldErrors?.employmentType?.[0];

  const specializationError =
    state.fieldErrors?.specialization?.[0];

  const qualificationsError =
    state.fieldErrors?.qualifications?.[0];

  const maximumWeeklyHoursError =
    state.fieldErrors?.maximumWeeklyHours?.[0];

  const maximumDailyHoursError =
    state.fieldErrors?.maximumDailyHours?.[0];

  const notesError =
    state.fieldErrors?.notes?.[0];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="trainer-staff-number"
          label="Staff number"
          required
          error={staffNumberError}
        >
          <Input
            id="trainer-staff-number"
            name="staffNumber"
            required
            disabled={pending}
            defaultValue={
              trainer?.staffNumber ?? ''
            }
            hasError={Boolean(staffNumberError)}
          />
        </FormField>

        <FormField
          id="trainer-employment-type"
          label="Employment type"
          required
          error={employmentTypeError}
        >
          <Select
            id="trainer-employment-type"
            name="employmentType"
            required
            disabled={pending}
            defaultValue={
              trainer?.employmentType ??
              'full_time'
            }
            hasError={Boolean(
              employmentTypeError,
            )}
          >
            {trainerEmploymentTypeOptions.map(
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

      <FormField
        id="trainer-full-name"
        label="Full name"
        required
        error={fullNameError}
      >
        <Input
          id="trainer-full-name"
          name="fullName"
          required
          disabled={pending}
          defaultValue={trainer?.fullName ?? ''}
          hasError={Boolean(fullNameError)}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="trainer-email"
          label="Email address"
          optional
          error={emailError}
        >
          <Input
            id="trainer-email"
            name="email"
            type="email"
            disabled={pending}
            defaultValue={trainer?.email ?? ''}
            hasError={Boolean(emailError)}
          />
        </FormField>

        <FormField
          id="trainer-phone"
          label="Phone number"
          optional
          error={phoneNumberError}
        >
          <Input
            id="trainer-phone"
            name="phoneNumber"
            type="tel"
            disabled={pending}
            defaultValue={
              trainer?.phoneNumber ?? ''
            }
            hasError={Boolean(phoneNumberError)}
          />
        </FormField>
      </div>

      <FormField
        id="trainer-specialization"
        label="Specialization"
        optional
        error={specializationError}
      >
        <Input
          id="trainer-specialization"
          name="specialization"
          disabled={pending}
          defaultValue={
            trainer?.specialization ?? ''
          }
          hasError={Boolean(
            specializationError,
          )}
        />
      </FormField>

      <FormField
        id="trainer-qualifications"
        label="Qualifications"
        optional
        error={qualificationsError}
      >
        <Textarea
          id="trainer-qualifications"
          name="qualifications"
          rows={4}
          maxLength={1000}
          disabled={pending}
          defaultValue={
            trainer?.qualifications ?? ''
          }
          hasError={Boolean(
            qualificationsError,
          )}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="trainer-weekly-hours"
          label="Maximum weekly hours"
          required
          error={maximumWeeklyHoursError}
        >
          <Input
            id="trainer-weekly-hours"
            name="maximumWeeklyHours"
            type="number"
            min={0.5}
            max={80}
            step={0.5}
            required
            disabled={pending}
            defaultValue={
              trainer?.maximumWeeklyHours ?? 24
            }
            hasError={Boolean(
              maximumWeeklyHoursError,
            )}
          />
        </FormField>

        <FormField
          id="trainer-daily-hours"
          label="Maximum daily hours"
          required
          error={maximumDailyHoursError}
        >
          <Input
            id="trainer-daily-hours"
            name="maximumDailyHours"
            type="number"
            min={0.5}
            max={16}
            step={0.5}
            required
            disabled={pending}
            defaultValue={
              trainer?.maximumDailyHours ?? 6
            }
            hasError={Boolean(
              maximumDailyHoursError,
            )}
          />
        </FormField>
      </div>

      <FormField
        id="trainer-notes"
        label="Notes"
        optional
        error={notesError}
      >
        <Textarea
          id="trainer-notes"
          name="notes"
          rows={4}
          maxLength={1000}
          disabled={pending}
          defaultValue={trainer?.notes ?? ''}
          hasError={Boolean(notesError)}
        />
      </FormField>
    </>
  );
}