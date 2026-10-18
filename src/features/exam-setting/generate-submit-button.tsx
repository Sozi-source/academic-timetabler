'use client';

import { useFormStatus } from 'react-dom';
import { WandSparkles } from 'lucide-react';

export function GenerateSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
      <span className="inline-flex items-center gap-2">
        <WandSparkles className="size-4" aria-hidden="true" />
        {pending ? 'Generating draft…' : 'Generate full draft'}
      </span>
    </button>
  );
}
