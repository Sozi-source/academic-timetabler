'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, UsersRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { batchReassignStudentCohortAction } from './actions';
import type { RegistryCohortOption } from './queries';
import { initialBatchStudentActionState } from './types';

interface ReassignCohortDialogProps {
  studentId: string;
  studentName: string;
  currentCohortId?: string | null;
  currentCohortName?: string | null;
  cohorts: RegistryCohortOption[];
  trigger?: ReactNode;
  onSuccess?: () => void;
}

export function ReassignCohortDialog({
  studentId,
  studentName,
  currentCohortId,
  currentCohortName,
  cohorts,
  trigger,
  onSuccess,
}: ReassignCohortDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetCohortId, setTargetCohortId] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setTargetCohortId('');
      setEffectiveDate(today);
      setReason('');
      setNotes('');
      setErrorMsg(null);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!targetCohortId) {
      setErrorMsg('Please select a target study cohort.');
      return;
    }
    if (targetCohortId === currentCohortId) {
      setErrorMsg('Student is already in this cohort.');
      return;
    }

    setErrorMsg(null);

    const formData = new FormData();
    formData.append('studentIds', studentId);
    formData.append('targetCohortId', targetCohortId);
    formData.append('effectiveDate', effectiveDate);
    if (reason.trim()) formData.append('reason', reason.trim());
    if (notes.trim()) formData.append('notes', notes.trim());

    startTransition(async () => {
      try {
        const res = await batchReassignStudentCohortAction(
          initialBatchStudentActionState,
          formData,
        );
        if (res.status === 'error') {
          setErrorMsg(res.message || 'Failed to reassign cohort.');
        } else {
          setOpen(false);
          onSuccess?.();
          router.refresh();
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            size="sm"
            className="inline-flex items-center justify-center gap-1.5 h-9 text-xs font-semibold w-full sm:w-auto"
          >
            <UsersRound className="size-3.5" />
            <span>Reassign Cohort</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 pr-12 border-b border-border shrink-0">
          <DialogTitle className="text-base font-bold text-text-primary flex items-center gap-2">
            <UsersRound className="size-4.5 text-primary" />
            <span>Reassign Study Cohort</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <DialogBody className="px-5 py-3.5 space-y-3.5 overflow-y-auto flex-1">
            {/* Context Badge */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs">
              <span className="font-semibold text-text-primary truncate">{studentName}</span>
              <span className="shrink-0 text-[11px] text-text-muted">
                Current: <strong className="text-text-primary">{currentCohortName ?? 'None'}</strong>
              </span>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-2.5 text-xs text-blue-900">
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-blue-600" />
                Repeater &amp; Cohort Shift Safety
              </p>
              <p className="mt-0.5 text-[11px] text-blue-800">
                Original admission cohorts stay permanently intact for historical identity. Only current study cohort and stage are updated.
              </p>
            </div>

            {errorMsg ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle p-2.5 text-xs font-semibold text-danger"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            <div>
              <label htmlFor="targetCohortSelect" className="block text-xs font-semibold text-text-secondary">
                Target Study Cohort <span className="text-danger">*</span>
              </label>
              <select
                id="targetCohortSelect"
                value={targetCohortId}
                onChange={(e) => {
                  setTargetCohortId(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                required
                className="mt-1 block h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-primary outline-none focus:border-primary"
              >
                <option value="">Select target cohort</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.programmeCode ? `(${c.programmeCode})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reassignEffectiveDate" className="block text-xs font-semibold text-text-secondary">
                Effective Date <span className="text-danger">*</span>
              </label>
              <Input
                id="reassignEffectiveDate"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <label htmlFor="reassignReason" className="block text-xs font-semibold text-text-secondary">
                Reason <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <Input
                id="reassignReason"
                type="text"
                placeholder="e.g. Repeating term with junior intake, transfer"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <label htmlFor="reassignNotes" className="block text-xs font-semibold text-text-secondary">
                Administrative Notes <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <Input
                id="reassignNotes"
                type="text"
                placeholder="Additional notes for student record"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </DialogBody>

          <DialogFooter className="px-5 py-3 border-t border-border shrink-0 bg-surface-subtle/50 flex flex-row items-center justify-end gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                className="h-8.5 px-3 text-xs"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !targetCohortId}
              className="h-8.5 px-4 text-xs font-bold text-white shadow-2xs bg-primary hover:bg-primary-hover"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Reassigning...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  <span>Reassign Cohort</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
