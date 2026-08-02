import {
  LoaderCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingState({
  title = 'Loading',
  description = 'Please wait while the information is prepared.',
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-64 flex-col items-center justify-center rounded-2xl border border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <LoaderCircle
          className="size-5 animate-spin"
          aria-hidden="true"
        />
      </div>

      <p className="mt-4 text-sm font-semibold text-text-primary">
        {title}
      </p>

      <p className="mt-1 max-w-md text-xs leading-5 text-text-muted">
        {description}
      </p>
    </div>
  );
}