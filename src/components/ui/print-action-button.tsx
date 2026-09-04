'use client';

import { Printer } from 'lucide-react';

interface PrintActionButtonProps {
  label?: string;
  className?: string;
}

export function PrintActionButton({
  label = 'Print / Save PDF',
  className = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-teal-800 px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40',
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

