'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  UserX,
  UsersRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  batchReassignStudentCohortAction,
  batchUpdateStudentStatusAction,
} from './actions';
import type { RegistryCohortOption } from './queries';
import {
  initialBatchStudentActionState,
  type StudentRow,
} from './types';

export type BatchActionType =
  | 'confirm_reported'
  | 'defer'
  | 'dropout'
  | 'suspend'
  | 'reassign_cohort';

interface BatchActionDialogsProps {
  openAction: BatchActionType | null;
  onClose: () => void;
  selectedStudents: StudentRow[];
  cohorts: RegistryCohortOption[];
  onSuccess: (message: string) => void;
}

export function BatchActionDialogs({
  openAction,
  onClose,
  selectedStudents,
  cohorts,
  onSuccess,
}: BatchActionDialogsProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const today = new Date().toISOString().slice(0, 10);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [reason, setReason] = useState('');
  const [expectedResumeDate, setExpectedResumeDate] = useState('');
  const [targetCohortId, setTargetCohortId] = useState('');

  const count = selectedStudents.length;

  const resetState = () => {
    setSubmitting(false);
    setErrorMsg(null);
    setEffectiveDate(today);
    setReason('');
    setExpectedResumeDate('');
    setTargetCohortId('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (count === 0) return;

    setSubmitting(true);
    setErrorMsg(null);

    const formData = new FormData();
    for (const student of selectedStudents) {
      formData.append('studentIds', student.id);
    }
    formData.append('effectiveDate', effectiveDate);

    try {
      if (openAction === 'confirm_reported') {
        formData.append('status', 'active');
        formData.append('reason', reason || 'Reporting confirmed by HOD');
        const res = await batchUpdateStudentStatusAction(
          initialBatchStudentActionState,
          formData,
        );
        if (res.status === 'error') {
          setErrorMsg(res.message || 'Failed to confirm reporting.');
          setSubmitting(false);
          return;
        }
        onSuccess(res.message || `${count} student(s) confirmed as active.`);
        resetState();
        onClose();
      } else if (openAction === 'defer') {
        formData.append('status', 'deferred');
        formData.append('expectedResumeDate', expectedResumeDate);
        const res = await batchUpdateStudentStatusAction(
          initialBatchStudentActionState,
          formData,
        );
        if (res.status === 'error') {
          setErrorMsg(res.message || 'Failed to defer students.');
          setSubmitting(false);
          return;
        }
        onSuccess(res.message || `${count} student(s) deferred successfully.`);
        resetState();
        onClose();
      } else if (openAction === 'dropout') {
        formData.append('status', 'dropped_out');
        const res = await batchUpdateStudentStatusAction(
          initialBatchStudentActionState,
          formData,
        );
        if (res.status === 'error') {
          setErrorMsg(res.message || 'Failed to update dropout status.');
          setSubmitting(false);
          return;
        }
        onSuccess(res.message || `${count} student(s) marked as dropped out.`);
        resetState();
        onClose();
      } else if (openAction === 'suspend') {
        formData.append('status', 'suspended');
        const res = await batchUpdateStudentStatusAction(initialBatchStudentActionState, formData);
        if (res.status === 'error') {
          setErrorMsg(res.message || 'Failed to suspend students.');
          setSubmitting(false);
          return;
        }
        onSuccess(res.message || `${count} student(s) suspended successfully.`);
        resetState();
        onClose();
      } else if (openAction === 'reassign_cohort') {
        if (!targetCohortId) {
          setErrorMsg('Please select a target cohort.');
          setSubmitting(false);
          return;
        }
        formData.append('targetCohortId', targetCohortId);
        formData.append('reason', reason || 'Cohort reassignment (repeat/progression)');
        const res = await batchReassignStudentCohortAction(
          initialBatchStudentActionState,
          formData,
        );
        if (res.status === 'error') {
          setErrorMsg(res.message || 'Failed to reassign cohort.');
          setSubmitting(false);
          return;
        }
        onSuccess(res.message || `${count} student(s) reassigned to new cohort.`);
        resetState();
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected system error.');
      setSubmitting(false);
    }
  };

  if (!openAction) return null;

  return (
    <Dialog open={Boolean(openAction)} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 pr-12 border-b border-border shrink-0">
          <DialogTitle className="text-base font-bold text-text-primary flex items-center gap-2">
            {openAction === 'confirm_reported' && (
              <>
                <CheckCircle2 className="size-4.5 text-emerald-600" />
                <span>Confirm Reporting &amp; Activate</span>
              </>
            )}
            {openAction === 'defer' && (
              <>
                <Clock className="size-4.5 text-amber-600" />
                <span>Mark Students as Deferred</span>
              </>
            )}
            {openAction === 'dropout' && (
              <>
                <UserX className="size-4.5 text-rose-600" />
                <span>Mark Students as Dropped Out</span>
              </>
            )}
            {openAction === 'reassign_cohort' && (
              <>
                <UsersRound className="size-4.5 text-primary" />
                <span>Reassign Study Cohort (Repeaters)</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <DialogBody className="px-5 py-3.5 space-y-3.5 overflow-y-auto flex-1">
            {/* Context Badge */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs">
              <span className="font-semibold text-text-primary">
                Selected Students: <strong>{count}</strong>
              </span>
              <span className="text-[11px] text-text-muted truncate max-w-[200px]">
                {selectedStudents.slice(0, 2).map((s) => s.full_name).join(', ')}
                {count > 2 ? ` + ${count - 2} more` : ''}
              </span>
            </div>

            {/* Error message */}
            {errorMsg ? (
              <div
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger flex items-start gap-2"
              >
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            {/* ACTION SPECIFIC FIELDS */}

            {/* 1. CONFIRM REPORTED */}
            {openAction === 'confirm_reported' && (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  Confirm physical reporting for these students. Their status will update to{' '}
                  <strong className="text-emerald-700 font-semibold">Active</strong> and reporting will be logged for the active term.
                </p>
                <div>
                  <label htmlFor="batchEffectiveDate" className="block text-xs font-semibold text-text-secondary">
                    Reporting Date
                  </label>
                  <Input
                    id="batchEffectiveDate"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="batchNotes" className="block text-xs font-semibold text-text-secondary">
                    Note <span className="text-text-muted font-normal">(optional)</span>
                  </label>
                  <Input
                    id="batchNotes"
                    type="text"
                    placeholder="e.g. Confirmed on registrar roster"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>
            )}

            {/* 2. DEFERRAL */}
            {openAction === 'defer' && (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  Formal deferral pauses the student&apos;s active registration. You must specify an effective date, return date, and reason.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="batchEffectiveDate" className="block text-xs font-semibold text-text-secondary">
                      Effective Date
                    </label>
                    <Input
                      id="batchEffectiveDate"
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      required
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="batchResumeDate" className="block text-xs font-semibold text-text-secondary">
                      Expected Return
                    </label>
                    <Input
                      id="batchResumeDate"
                      type="date"
                      value={expectedResumeDate}
                      onChange={(e) => setExpectedResumeDate(e.target.value)}
                      required
                      min={effectiveDate}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="batchReason" className="block text-xs font-semibold text-text-secondary">
                    Reason for Deferral <span className="text-danger">*</span>
                  </label>
                  <Input
                    id="batchReason"
                    type="text"
                    placeholder="e.g. Financial constraints, medical leave, personal request"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>
            )}

            {/* 3. DROPOUT */}
            {openAction === 'dropout' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    Exclusion from Active Operations
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-800">
                    Dropped out students are preserved in history but removed from active class lists, timetable headcounts, and unit registration.
                  </p>
                </div>
                <div>
                  <label htmlFor="batchEffectiveDate" className="block text-xs font-semibold text-text-secondary">
                    Effective Date
                  </label>
                  <Input
                    id="batchEffectiveDate"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="batchReason" className="block text-xs font-semibold text-text-secondary">
                    Reason / Administrative Note <span className="text-danger">*</span>
                  </label>
                  <Input
                    id="batchReason"
                    type="text"
                    placeholder="e.g. Historical non-reporting prior to system adoption, abandoned studies"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>
            )}

            {/* 4. REASSIGN COHORT (REPEATERS) */}
            {openAction === 'reassign_cohort' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-2.5 text-xs text-blue-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-blue-600" />
                    Repeater &amp; Cohort Shift Safety
                  </p>
                  <p className="mt-0.5 text-[11px] text-blue-800">
                    Original admission cohorts (e.g. JAN 24) stay permanently intact for historical identity. Only current study cohort and stage are updated.
                  </p>
                </div>
                <div>
                  <label htmlFor="targetCohortSelect" className="block text-xs font-semibold text-text-secondary">
                    Target Study Cohort <span className="text-danger">*</span>
                  </label>
                  <select
                    id="targetCohortSelect"
                    value={targetCohortId}
                    onChange={(e) => setTargetCohortId(e.target.value)}
                    required
                    className="mt-1 block h-9 w-full rounded-lg border border-border bg-white px-2.5 text-xs font-medium text-text-primary outline-none focus:border-primary"
                  >
                    <option value="">Select target cohort</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.programmeCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="batchEffectiveDate" className="block text-xs font-semibold text-text-secondary">
                    Effective Date
                  </label>
                  <Input
                    id="batchEffectiveDate"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="batchReason" className="block text-xs font-semibold text-text-secondary">
                    Reason <span className="text-text-muted font-normal">(optional)</span>
                  </label>
                  <Input
                    id="batchReason"
                    type="text"
                    placeholder="e.g. Repeating term with junior intake, transfer"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="px-5 py-3 border-t border-border shrink-0 bg-surface-subtle/50 flex flex-row items-center justify-end gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                className="h-8.5 px-3 text-xs"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className={`h-8.5 px-4 text-xs font-bold text-white shadow-2xs ${
                openAction === 'dropout'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : openAction === 'defer'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : openAction === 'confirm_reported'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-primary hover:bg-primary-hover'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : openAction === 'confirm_reported' ? (
                `Confirm Reported (${count})`
              ) : openAction === 'defer' ? (
                `Defer (${count})`
              ) : openAction === 'dropout' ? (
                `Mark Dropped Out (${count})`
              ) : (
                `Reassign Cohort (${count})`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
