'use client';

import { useState } from 'react';
import {
  BookOpen,
  Clock3,
  GraduationCap,
  ShieldCheck,
  User,
} from 'lucide-react';

import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  trainerEmploymentTypeOptions,
  type Trainer,
  type TrainerActionState,
  type TrainerEmploymentType,
  type TrainerWorkloadRole,
} from './types';

const fixedWorkloadTargets: Partial<Record<TrainerWorkloadRole, number>> = {
  hod: 10,
  course_coordinator: 16,
  full_time_trainer: 20,
};

interface TrainerFormFieldsProps {
  state: TrainerActionState;
  trainer?: Trainer;
  pending: boolean;
  departments: Array<{ id: string; name: string; schoolName: string }>;
}

export function TrainerFormFields({
  state,
  trainer,
  pending,
  departments,
}: TrainerFormFieldsProps) {
  const initialRole = trainer?.workloadRole ?? 'full_time_trainer';
  const [workloadRole, setWorkloadRole] = useState<TrainerWorkloadRole>(initialRole);

  const initialEmploymentType = trainer?.employmentType ?? 'full_time';
  const [employmentType, setEmploymentType] = useState<TrainerEmploymentType>(initialEmploymentType);

  const availabilityMode =
    trainer?.availabilityMode ??
    (['part_time', 'visiting', 'contract'].includes(employmentType)
      ? 'selected_slots_only'
      : 'generally_available');

  const initialTarget =
    fixedWorkloadTargets[initialRole] === undefined
      ? trainer?.normalWeeklyHours ?? 12
      : 12;

  const [customTarget, setCustomTarget] = useState(String(initialTarget));
  const fixedTarget = fixedWorkloadTargets[workloadRole];
  const weeklyTargetValue = fixedTarget === undefined ? customTarget : String(fixedTarget);

  const staffNumberError = state.fieldErrors?.staffNumber?.[0];
  const fullNameError = state.fieldErrors?.fullName?.[0];
  const emailError = state.fieldErrors?.email?.[0];
  const phoneNumberError = state.fieldErrors?.phoneNumber?.[0];
  const employmentTypeError = state.fieldErrors?.employmentType?.[0];
  const specializationError = state.fieldErrors?.specialization?.[0];
  const qualificationsError = state.fieldErrors?.qualifications?.[0];
  const maximumDailyHoursError = state.fieldErrors?.maximumDailyHours?.[0];
  const normalWeeklyHoursError = state.fieldErrors?.normalWeeklyHours?.[0];
  const notesError = state.fieldErrors?.notes?.[0];

  return (
    <div className="space-y-5">
      <input type="hidden" name="availabilityMode" value={availabilityMode} />
      <input type="hidden" name="homeDepartment" value={trainer?.homeDepartment ?? ''} />
      <input type="hidden" name="maximumWeeklyHours" value="80" />

      {/* Section 1: Institutional & Employment Profile */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700">
          <ShieldCheck className="size-4 text-[#033B36]" />
          <span>Institutional & Role Profile</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            id="trainer-department-id"
            label="Department / School"
            required
            error={state.fieldErrors?.departmentId?.[0]}
          >
            <Select
              id="trainer-department-id"
              name="departmentId"
              required
              disabled={pending}
              defaultValue={trainer?.departmentId ?? departments[0]?.id ?? ''}
            >
              <option value="">Select workspace</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="trainer-staff-number"
            label="Staff Number"
            error={staffNumberError}
          >
            <Input
              id="trainer-staff-number"
              name="staffNumber"
              placeholder="Auto-generated if blank"
              disabled={pending}
              defaultValue={trainer?.staffNumber ?? ''}
              hasError={Boolean(staffNumberError)}
            />
          </FormField>

          <FormField
            id="trainer-employment-type"
            label="Employment Type"
            required
            error={employmentTypeError}
          >
            <Select
              id="trainer-employment-type"
              name="employmentType"
              required
              disabled={pending}
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as TrainerEmploymentType)}
              hasError={Boolean(employmentTypeError)}
            >
              {trainerEmploymentTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="trainer-workload-role"
            label="Workload Role"
            required
            error={state.fieldErrors?.workloadRole?.[0]}
          >
            <Select
              id="trainer-workload-role"
              name="workloadRole"
              required
              disabled={pending}
              value={workloadRole}
              onChange={(e) => setWorkloadRole(e.target.value as TrainerWorkloadRole)}
            >
              <option value="hod">Head of Department (10h target)</option>
              <option value="course_coordinator">Course Coordinator (16h target)</option>
              <option value="full_time_trainer">Full-time Trainer (20h target)</option>
              <option value="part_time">Part-time Trainer (Custom target)</option>
              <option value="external">External / Service Trainer (Custom)</option>
            </Select>
          </FormField>
        </div>
      </div>

      {/* Section 2: Identity & Contact Info */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700">
          <User className="size-4 text-[#033B36]" />
          <span>Identity & Contact Details</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField
              id="trainer-full-name"
              label="Full Name"
              required
              error={fullNameError}
            >
              <Input
                id="trainer-full-name"
                name="fullName"
                required
                disabled={pending}
                placeholder="e.g. Dr. Fiona Kwamboka"
                defaultValue={trainer?.fullName ?? ''}
                hasError={Boolean(fullNameError)}
              />
            </FormField>
          </div>

          <FormField
            id="trainer-email"
            label="College Email"
            optional
            error={emailError}
          >
            <Input
              id="trainer-email"
              name="email"
              type="email"
              disabled={pending}
              placeholder="name@college.ac.ke"
              defaultValue={trainer?.email ?? ''}
              hasError={Boolean(emailError)}
            />
          </FormField>

          <FormField
            id="trainer-phone"
            label="Phone Number"
            optional
            error={phoneNumberError}
          >
            <Input
              id="trainer-phone"
              name="phoneNumber"
              type="tel"
              disabled={pending}
              placeholder="+254 700 000000"
              defaultValue={trainer?.phoneNumber ?? ''}
              hasError={Boolean(phoneNumberError)}
            />
          </FormField>
        </div>
      </div>

      {/* Section 3: Workload & Availability Safeguards */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700">
          <Clock3 className="size-4 text-[#033B36]" />
          <span>Workload Limits & Safeguards</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            id="trainer-normal-hours"
            label="Weekly Target Hours"
            required
            error={normalWeeklyHoursError}
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
              onChange={(e) => setCustomTarget(e.target.value)}
              className={fixedTarget !== undefined ? 'bg-gray-100/80 font-bold text-gray-700' : undefined}
              hasError={Boolean(normalWeeklyHoursError)}
            />
          </FormField>

          <FormField
            id="trainer-daily-hours"
            label="Max Daily Limit (Hours)"
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
              defaultValue={trainer?.maximumDailyHours ?? 6}
              hasError={Boolean(maximumDailyHoursError)}
            />
          </FormField>
        </div>
      </div>

      {/* Section 4: Academic Background & Notes */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700">
          <GraduationCap className="size-4 text-[#033B36]" />
          <span>Specialization & Qualifications</span>
        </div>

        <FormField
          id="trainer-specialization"
          label="Teaching Specialization"
          optional
          error={specializationError}
        >
          <Input
            id="trainer-specialization"
            name="specialization"
            disabled={pending}
            placeholder="e.g. Clinical Nutrition, Food Microbiology, Dietetics"
            defaultValue={trainer?.specialization ?? ''}
            hasError={Boolean(specializationError)}
          />
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            id="trainer-qualifications"
            label="Academic Qualifications"
            optional
            error={qualificationsError}
          >
            <Textarea
              id="trainer-qualifications"
              name="qualifications"
              rows={2}
              maxLength={1000}
              disabled={pending}
              placeholder="e.g. MSc. Clinical Nutrition (UoN), BSc. Food Science"
              defaultValue={trainer?.qualifications ?? ''}
              hasError={Boolean(qualificationsError)}
            />
          </FormField>

          <FormField
            id="trainer-notes"
            label="Administrative Notes"
            optional
            error={notesError}
          >
            <Textarea
              id="trainer-notes"
              name="notes"
              rows={2}
              maxLength={1000}
              disabled={pending}
              placeholder="Additional departmental notes or constraints..."
              defaultValue={trainer?.notes ?? ''}
              hasError={Boolean(notesError)}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
