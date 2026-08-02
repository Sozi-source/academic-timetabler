'use client';

import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/lib/utils/cn';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  indicatorClassName?: string;
  label?: string;
}

export function Progress({
  value,
  max = 100,
  className,
  indicatorClassName,
  label,
}: ProgressProps) {
  const safeValue = Math.min(
    Math.max(value, 0),
    max,
  );

  const percentage =
    max === 0
      ? 0
      : (safeValue / max) * 100;

  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="font-medium text-text-secondary">
            {label}
          </span>

          <span className="text-text-muted">
            {Math.round(percentage)}%
          </span>
        </div>
      ) : null}

      <ProgressPrimitive.Root
        value={safeValue}
        max={max}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-surface-muted',
          className,
        )}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full bg-primary transition-transform duration-300',
            indicatorClassName,
          )}
          style={{
            transform: `translateX(-${100 - percentage}%)`,
          }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
}