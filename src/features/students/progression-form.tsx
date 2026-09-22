'use client';

import { LoaderCircle, Save } from 'lucide-react';
import { useActionState, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Select } from '@/components/ui/select';

import { recordStudentProgressionAction } from './actions';
import { initialStudentProgressionActionState, type StudentCohortOption, type StudentLifecycleStatus } from './types';

interface ProgressionFormProps {
  studentId: string;
  status: StudentLifecycleStatus;
  academicPhase?: 'in_class' | 'clinical_rotation' | 'attachment' | 'deferred' | 'dropped_out' | 'awaiting_graduation' | 'graduated';
  reportingStatus?: 'pending' | 'reported' | 'deferred' | 'dropped_out';
  currentCohortId?: string;
  cohorts?: StudentCohortOption[];
}

/**
 * Virtual status values used only in this form's UI.
 * 'in_class' and 'on_attachment' both map to lifecycle_status='active'
 * and differ only in academicPlacement.
 */
type VirtualStatus = StudentLifecycleStatus | 'in_class' | 'on_attachment';

const statusOptions: [VirtualStatus, string][] = [
  ['in_class', 'In Class'],
  ['on_attachment', 'On Attachment'],
  ['deferred', 'Deferred'],
  ['dropped_out', 'Dropped Out'],
  ['suspended', 'Suspended'],
  ['completed', 'Completed'],
  ['graduated', 'Graduated'],
];

/** Map a VirtualStatus to the real lifecycle_status value sent to the server. */
function deriveTargetStatus(virtual: VirtualStatus): StudentLifecycleStatus {
  if (virtual === 'in_class' || virtual === 'on_attachment') return 'active';
  return virtual as StudentLifecycleStatus;
}

/** Map a VirtualStatus to the academicPlacement value sent to the server. */
function deriveAcademicPlacement(virtual: VirtualStatus): 'in_class' | 'attachment' {
  return virtual === 'on_attachment' ? 'attachment' : 'in_class';
}

/** Convert current lifecycle_status + academic_phase to a VirtualStatus for initial form state. */
function toVirtualStatus(
  status: StudentLifecycleStatus,
  phase: string | undefined | null,
): VirtualStatus {
  if (status === 'active' || status === 'admitted') {
    return phase === 'attachment' ? 'on_attachment' : 'in_class';
  }
  return status;
}

export function ProgressionForm({
  studentId,
  status,
  academicPhase,
  reportingStatus,
  currentCohortId,
  cohorts,
}: ProgressionFormProps) {
  const effectiveReportingStatus = reportingStatus ?? 'reported';
  const [virtualStatus, setVirtualStatus] = useState<VirtualStatus>(
    toVirtualStatus(status, academicPhase),
  );
  const [targetReporting, setTargetReporting] = useState<'reported' | 'not_reported'>(
    effectiveReportingStatus === 'reported' ? 'reported' : 'not_reported',
  );
  const [state, formAction, pending] = useActionState(
    recordStudentProgressionAction,
    initialStudentProgressionActionState,
  );
  const options = useMemo(() => statusOptions, []);

  const initialVirtual = toVirtualStatus(status, academicPhase);
  const initialReporting: 'reported' | 'not_reported' =
    effectiveReportingStatus === 'reported' ? 'reported' : 'not_reported';
  const isUnchanged =
    virtualStatus === initialVirtual && targetReporting === initialReporting;

  // Derived hidden-input values
  const derivedTargetStatus = deriveTargetStatus(virtualStatus);
  const derivedPlacement = deriveAcademicPlacement(virtualStatus);

  // suppress unused-var warnings — cohorts/currentCohortId reserved for future cohort selector
  void currentCohortId;
  void cohorts;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="eventType" value="status_update" />
      <input type="hidden" name="targetStatus" value={derivedTargetStatus} />
      <input type="hidden" name="academicPlacement" value={derivedPlacement} />

      {state.message ? (
        <FormStatusMessage
          status={state.status === 'success' ? 'success' : 'error'}
          message={state.message}
        />
      ) : null}

      <label className="block text-xs font-semibold text-text-primary">
        Student status
        <Select
          name="_virtualStatus"
          value={virtualStatus}
          onChange={(event) => setVirtualStatus(event.target.value as VirtualStatus)}
          className="mt-1 h-9 rounded-lg text-xs"
          hasError={Boolean(state.fieldErrors?.targetStatus?.[0])}
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>

      <label className="block text-xs font-semibold text-text-primary">
        Semester reporting
        <Select
          name="reportingStatus"
          value={targetReporting}
          onChange={(event) =>
            setTargetReporting(event.target.value as 'reported' | 'not_reported')
          }
          className="mt-1 h-9 rounded-lg text-xs"
        >
          <option value="reported">Reported</option>
          <option value="not_reported">Not Reported</option>
        </Select>
      </label>

      <p className="text-[0.6875rem] text-text-muted">
        Select the status and reporting state, then save. No reason is required.
      </p>

      <div className="flex justify-end border-t border-border pt-3">
        <Button
          type="submit"
          disabled={pending || isUnchanged}
          size="sm"
          leadingIcon={
            pending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )
          }
        >
          {pending ? 'Saving' : 'Save status'}
        </Button>
      </div>
    </form>
  );
}
