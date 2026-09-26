import {
  forwardRef,
  type SelectHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils/cn';

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = forwardRef<
  HTMLSelectElement,
  SelectProps
>(function Select(
  {
    hasError = false,
    className,
    disabled,
    children,
    ...props
  },
  ref,
) {
  return (
    <select
      ref={ref}
      disabled={disabled}
      aria-invalid={
        hasError
          ? true
          : props['aria-invalid']
      }
      className={cn(
        'h-9 w-full xl:h-10 rounded-xl border border-border-strong bg-surface px-3 text-[12px] xl:px-3.5 xl:text-[13px] text-text-primary shadow-sm outline-none transition cursor-pointer',
        'hover:border-focus-border',
        'focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted',
        'aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger-border/40',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
