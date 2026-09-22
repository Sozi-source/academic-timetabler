'use client';

import { LoaderCircle, Save } from 'lucide-react';
import { useActionState, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Select } from '@/components/ui/select';

import { recordStudentProgressionAction } from './actions';
import { initialStudentProgressionActionState, type StudentLifecycleStatus } from './types';

interface ProgressionFormProps {
  studentId: string;
  status: StudentLifecycleStatus;
  academicPhase: 'in_class' | 'clinical_rotation' | 'attachment' | 'deferred' | 'dropped_out' | 'awaiting_graduation' | 'graduated';
  reportingStatus: 'pending' | 'reported' | 'deferred' | 'dropped_out';
}

const statusOptions = [
  ['active', 'Active'],
  ['deferred', 'Deferred'],
  ['dropped_out', 'Dropped Out'],
  ['suspended', 'Suspended'],
  ['completed', 'Completed'],
  ['graduated', 'Graduated'],
] as const;

export function ProgressionForm({ studentId, status, academicPhase, reportingStatus }: ProgressionFormProps) {
  const [targetStatus, setTargetStatus] = useState<StudentLifecycleStatus>(status === 'admitted' ? 'active' : status);
  const [targetPlacement, setTargetPlacement] = useState<'in_class' | 'attachment'>(academicPhase === 'attachment' ? 'attachment' : 'in_class');
  const [targetReporting, setTargetReporting] = useState<'reported' | 'not_reported'>(reportingStatus === 'reported' ? 'reported' : 'not_reported');
  const [state, formAction, pending] = useActionState(
    recordStudentProgressionAction,
    initialStudentProgressionActionState,
  );
  const options = useMemo(() => statusOptions, []);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="eventType" value="status_update" />

      {state.message ? (
        <FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} />
      ) : null}

      <label className="block text-xs font-semibold text-text-primary">
        Student status
        <Select
          name="targetStatus"
          value={targetStatus}
          onChange={(event) => setTargetStatus(event.target.value as StudentLifecycleStatus)}
          className="mt-1 h-9 rounded-lg text-xs"
          hasError={Boolean(state.fieldErrors?.targetStatus?.[0])}
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-text-primary">
          Academic placement
          <Select name="academicPlacement" value={targetPlacement} onChange={(event) => setTargetPlacement(event.target.value as 'in_class' | 'attachment')} className="mt-1 h-9 rounded-lg text-xs">
            <option value="in_class">In Class</option>
            <option value="attachment">Attachment</option>
          </Select>
        </label>
        <label className="block text-xs font-semibold text-text-primary">
          Semester reporting
          <Select name="reportingStatus" value={targetReporting} onChange={(event) => setTargetReporting(event.target.value as 'reported' | 'not_reported')} className="mt-1 h-9 rounded-lg text-xs">
            <option value="reported">Reported</option>
            <option value="not_reported">Not Reported</option>
          </Select>
        </label>
      </div>

      <p className="text-[0.6875rem] text-text-muted">Select the status, placement and reporting state, then save. No reason is required.</p>

      <div className="flex justify-end border-t border-border pt-3">
        <Button type="submit" disabled={pending || (targetStatus === status && targetPlacement === (academicPhase === 'attachment' ? 'attachment' : 'in_class') && targetReporting === (reportingStatus === 'reported' ? 'reported' : 'not_reported'))} size="sm" leadingIcon={pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}>
          {pending ? 'Saving' : 'Save status'}
        </Button>
      </div>
    </form>
  );
}
