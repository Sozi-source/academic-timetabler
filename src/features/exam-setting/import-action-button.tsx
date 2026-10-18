'use client';

import { Archive, LoaderCircle, RefreshCw } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export function ExamImportActionButton({
  kind,
  label,
  pendingLabel,
  disabled = false,
}: {
  kind: 'auto' | 'commit';
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const Icon = kind === 'auto' ? RefreshCw : Archive;

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-live="polite"
      className={kind === 'commit'
        ? 'inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50'
        : 'inline-flex h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50'}
    >
      {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Icon className="size-3.5" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  );
}
