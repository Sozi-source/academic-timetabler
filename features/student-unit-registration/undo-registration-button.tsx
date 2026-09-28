'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export interface UndoUnitRegistrationButtonProps {
  studentId: string;
  academicPeriodId: string;
  studentName?: string;
  label?: string;
  variant?: 'danger' | 'outline' | 'subtle';
  size?: 'sm' | 'md';
  className?: string;
  onSuccess?: () => void;
}

export function UndoUnitRegistrationButton({
  studentId,
  academicPeriodId,
  studentName,
  label = 'Unregister',
  variant = 'danger',
  size = 'sm',
  className,
  onSuccess,
}: UndoUnitRegistrationButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function undo() {
    const studentLabel = studentName ? `for ${studentName}` : 'for this student';
    const confirmed = window.confirm(
      `Unregister all units ${studentLabel}?\n\nThis will remove all registered units for this Academic Period and reset the student's status to 'Not registered'.`,
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `/api/students/unit-registration/${studentId}/undo`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            academicPeriodId,
          }),
        },
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        window.alert(
          payload?.message ??
            'Unit registration could not be undone.',
        );
        return;
      }

      if (onSuccess) {
        onSuccess();
      }
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Network error during unregistration.');
    } finally {
      setBusy(false);
    }
  }

  const variantStyles = {
    danger: 'border-danger/30 bg-danger-subtle text-danger hover:bg-danger/20 hover:border-danger/60',
    outline: 'border-border-strong bg-white text-text-secondary hover:bg-surface-subtle',
    subtle: 'border-transparent bg-transparent text-danger hover:bg-danger-subtle/50',
  }[variant];

  const sizeStyles = {
    sm: 'h-8 px-2.5 text-[11px]',
    md: 'h-9 px-3.5 text-xs',
  }[size];

  return (
    <button
      type="button"
      onClick={undo}
      disabled={busy}
      title={studentName ? `Unregister ${studentName}` : 'Unregister student units'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
        variantStyles,
        sizeStyles,
        className,
      )}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <RotateCcw className="size-3.5" aria-hidden="true" />
      )}
      <span>{busy ? 'Unregistering...' : label}</span>
    </button>
  );
}
