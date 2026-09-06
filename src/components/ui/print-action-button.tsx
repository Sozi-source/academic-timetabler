'use client';

import { Printer } from 'lucide-react';

interface PrintActionButtonProps {
  label?: string;
  className?: string;
}

export function PrintActionButton({
  label = 'Print / Save PDF',
  className = 'inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary shadow-2xs transition hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-95',
}: PrintActionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      <Printer className="size-3.5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

