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
      ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/80'
      : variant === 'warning'
        ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/80'
        : 'bg-[#e6f6f2] text-[#0b4f4a] ring-1 ring-[#bfe8de]';

  const confirmTone =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700 text-white'
        : 'bg-[#0b7a64] hover:bg-[#096452] text-white';

  const bottomAccent =
    variant === 'danger'
      ? 'from-rose-500/80 via-rose-600 to-rose-500/80'
      : variant === 'warning'
        ? 'from-amber-400/80 via-amber-500 to-amber-400/80'
        : 'from-emerald-400/70 via-[#0b7a64] to-teal-400/70';

  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? AlertTriangle : CheckCircle2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        style={{ maxWidth: '24rem' }}
        className="relative w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl"
      >
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          aria-label="Close confirmation"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
        >
          <X className="size-4" />
        </button>

        <div className="px-5 pt-6 pb-5 text-center sm:px-6">
          <div className="mx-auto flex justify-center">
            <span className={`flex size-12 items-center justify-center rounded-full ${iconTone}`}>
              <Icon className="size-6" aria-hidden="true" />
            </span>
          </div>

          <h3 id={titleId} className="mt-3 text-base font-extrabold tracking-tight text-[#0b2545]">
            {title}
          </h3>

          <div className="mt-3 text-xs leading-5 text-slate-600">{description}</div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-2.5">
            <button
              type="button"
              disabled={pending}
              onClick={onCancel}
              className="inline-flex min-h-9 w-full sm:w-auto sm:min-w-[6.5rem] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-[#0b2545] transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className={`inline-flex min-h-9 w-full sm:w-auto sm:min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold shadow-xs transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${confirmTone}`}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
              <span>{pending ? 'Working…' : confirmLabel}</span>
            </button>
          </div>
        </div>

        <div className={`h-1 w-full bg-gradient-to-r ${bottomAccent}`} aria-hidden="true" />
      </div>
    </div>
  );
}
