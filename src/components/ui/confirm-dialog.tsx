'use client';

import type { ReactNode } from 'react';
import { useEffect, useId } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'warning';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, pending, onCancel]);

  if (!open) return null;

  const iconTone =
    variant === 'danger'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : variant === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const confirmTone =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700 text-white'
        : 'bg-emerald-600 hover:bg-emerald-700 text-white';

  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? AlertTriangle : CheckCircle2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        style={{ maxWidth: '25rem' }}
        className="w-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${iconTone}`}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <h3 id={titleId} className="text-sm font-bold text-slate-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            aria-label="Close confirmation"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 text-xs leading-5 text-slate-600">{description}</div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${confirmTone}`}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            <span>{pending ? 'Working…' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
