'use client';

import {
  type ReactNode,
  useId,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pencil,
  Sparkles,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { updateStudentAdmissionNumberAction } from './actions';
import { inferStudentAdmissionNumber } from './admission-number';
import { initialUpdateAdmissionNumberActionState } from './types';

interface EditAdmissionNumberDialogProps {
  studentId: string;
  studentName: string;
  currentAdmissionNumber: string;
  trigger?: ReactNode;
  onSuccess?: (newAdmissionNumber: string) => void;
}

export function EditAdmissionNumberDialog({
  studentId,
  studentName,
  currentAdmissionNumber,
  trigger,
  onSuccess,
}: EditAdmissionNumberDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState(currentAdmissionNumber);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [isPending, startTransition] = useTransition();

  const inputId = useId();

  // Reset dialog state when opening
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setAdmissionNumber(currentAdmissionNumber);
      setErrorMessage(null);
      setFieldErrors({});
    }
  };

  // Live inference analysis of the entered admission number
  const inference = useMemo(() => {
    const trimmed = admissionNumber.trim();
    if (!trimmed) return null;
    return inferStudentAdmissionNumber(trimmed);
  }, [admissionNumber]);

  const isUnchanged =
    admissionNumber.trim().toUpperCase() === currentAdmissionNumber.trim().toUpperCase();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    const trimmed = admissionNumber.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!trimmed) {
      setErrorMessage('Please enter an admission number.');
      return;
    }

    if (isUnchanged) {
      setErrorMessage('The new admission number is identical to the current one.');
      return;
    }

    const formData = new FormData();
    formData.set('studentId', studentId);
    formData.set('admissionNumber', trimmed);

    startTransition(async () => {
      try {
        const result = await updateStudentAdmissionNumberAction(
          initialUpdateAdmissionNumberActionState,
          formData,
        );

        if (result.status === 'error') {
          setErrorMessage(result.message);
          setFieldErrors(result.fieldErrors ?? {});
        } else if (result.status === 'success') {
          const updatedVal = result.newAdmissionNumber ?? trimmed;
          onSuccess?.(updatedVal);
          setIsOpen(false);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred while updating.',
        );
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-1.5 h-8 text-xs font-semibold"
          >
            <Pencil className="size-3.5" />
            <span>Edit Admission No.</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 pr-12 border-b border-border shrink-0">
          <DialogTitle className="text-base font-bold text-text-primary">
            Edit Admission Number
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <DialogBody className="px-5 py-3.5 space-y-3 overflow-y-auto flex-1">
            {/* Student & Current Number Context */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs">
              <span className="font-semibold text-text-primary truncate">{studentName}</span>
              <span className="shrink-0 font-mono text-[11px] text-text-muted">
                Current: <strong className="text-text-primary">{currentAdmissionNumber}</strong>
              </span>
            </div>

            {/* Error Banner */}
            {errorMessage ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            {/* Corrected Admission Number */}
            <div className="space-y-1">
              <label
                htmlFor={inputId}
                className="block text-xs font-semibold text-text-primary"
              >
                Corrected Admission Number <span className="text-danger">*</span>
              </label>
              <Input
                id={inputId}
                type="text"
                autoFocus
                required
                value={admissionNumber}
                onChange={(e) => {
                  setAdmissionNumber(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. DNDT/J-7086/IC/26"
                className="h-9 font-mono uppercase tracking-wide text-xs"
                disabled={isPending}
              />
              {fieldErrors.admissionNumber ? (
                <p className="text-[11px] text-danger">{fieldErrors.admissionNumber[0]}</p>
              ) : null}
            </div>

            {/* Compact Pattern Recognition Feedback */}
            {inference && inference.confidence !== 'none' ? (
              <div className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] text-text-secondary">
                <Sparkles className="size-3 text-primary shrink-0" />
                <span className="font-medium text-primary">Inferred:</span>
                <span className="font-bold text-text-primary">
                  {inference.programmeCode ?? '—'} · {inference.intakeLabel ?? ''} {inference.admissionYear ?? ''}
                </span>
                {inference.suggestedCohortCode ? (
                  <span className="text-text-muted truncate">({inference.suggestedCohortCode})</span>
                ) : null}
              </div>
            ) : null}
          </DialogBody>

          <DialogFooter className="px-5 py-3 border-t border-border shrink-0 bg-surface-subtle/50 flex flex-row items-center justify-end gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || isUnchanged || !admissionNumber.trim()}
              className="h-8 text-xs font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  <span>Save Correction</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
