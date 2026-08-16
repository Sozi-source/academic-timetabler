'use client';

import { useState } from 'react';

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
  type TrainerWorkloadRole,
} from './types';

const fixedWorkloadTargets: Partial<
  Record<TrainerWorkloadRole, number>
> = {
  hod: 10,
  course_coordinator: 16,
  full_time_trainer: 20,
};

interface TrainerFormFieldsProps {
  state: TrainerActionState;
  trainer?: Trainer;
  pending: boolean;
  departments: Array<{id:string;name:string;schoolName:string}>;
}

export function TrainerFormFields({
  state,
  trainer,
  pending,
  departments,
}: TrainerFormFieldsProps) {
  const initialRole =
    trainer?.workloadRole ??
    'full_time_trainer';

  const [workloadRole, setWorkloadRole] =
    useState<TrainerWorkloadRole>(initialRole);

  const initialTarget =
    fixedWorkloadTargets[initialRole] === undefined
      ? trainer?.normalWeeklyHours ?? 12
      : 12;

  const [customTarget, setCustomTarget] =
    useState(String(initialTarget));

  const fixedTarget =
    fixedWorkloadTargets[workloadRole];

  const weeklyTargetValue =
    fixedTarget === undefined
      ? customTarget
      : String(fixedTarget);

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

  const maximumDailyHoursError =
    state.fieldErrors?.maximumDailyHours?.[0];
  const normalWeeklyHoursError = state.fieldErrors?.normalWeeklyHours?.[0];

  const notesError =
    state.fieldErrors?.notes?.[0];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="trainer-department-id" label="Home school / department" required error={state.fieldErrors?.departmentId?.[0]}>
          <Select id="trainer-department-id" name="departmentId" required disabled={pending} defaultValue={trainer?.departmentId ?? departments[0]?.id ?? ''}>
            <option value="">Select workspace</option>{departments.map(department=><option key={department.id} value={department.id}>{department.name}</option>)}
          </Select>
        </FormField>
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
        <FormField id="trainer-workload-role" label="Workload role" required error={state.fieldErrors?.workloadRole?.[0]}>
          <Select id="trainer-workload-role" name="workloadRole" required disabled={pending} value={workloadRole} onChange={(event) => setWorkloadRole(event.target.value as TrainerWorkloadRole)}>
            <option value="hod">Head of Department — 10h target</option><option value="course_coordinator">Course coordinator — 16h target</option><option value="full_time_trainer">Full-time trainer — 20h target</option><option value="part_time">Part-time trainer — custom target</option><option value="external">External/service trainer — custom target</option>
          </Select>
        </FormField>
        <input type="hidden" name="homeDepartment" value={trainer?.homeDepartment ?? ''}/>
      </div>
      <FormField id="trainer-availability-mode" label="Availability rule" required error={state.fieldErrors?.availabilityMode?.[0]}>
        <Select id="trainer-availability-mode" name="availabilityMode" required disabled={pending} defaultValue={trainer?.availabilityMode ?? 'generally_available'}><option value="generally_available">Generally available</option><option value="selected_slots_only">Selected free times only</option></Select>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="trainer-normal-hours"
          label="Weekly target hours"
          required
          error={normalWeeklyHoursError}
          description={
            fixedTarget === undefined
              ? 'Enter the approved weekly target for this part-time or external trainer.'
              : 'Automatically fixed by the selected workload role. Extra hours remain allowed and are reported separately.'
          }
        >
          <Input
            id="trainer-normal-hours"
            name="normalWeeklyHours"
            type="number"
            min={0.5}
            max={80}
            step={0.5}
            required
            disabled={pending}
            readOnly={fixedTarget !== undefined}
            value={weeklyTargetValue}
            onChange={(event) => setCustomTarget(event.target.value)}
            className={fixedTarget !== undefined ? 'bg-surface-subtle font-semibold text-text-secondary' : undefined}
            hasError={Boolean(normalWeeklyHoursError)}
          />
        </FormField>
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

      <input type="hidden" name="maximumWeeklyHours" value="80" />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="trainer-daily-hours"
          label="Daily scheduling limit"
          required
          error={maximumDailyHoursError}
          description="This remains a hard safeguard during timetable generation."
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
