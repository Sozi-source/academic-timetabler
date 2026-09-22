import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils/cn';

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  leadingContent?: ReactNode;
  trailingContent?: ReactNode;
}

export const Input = forwardRef<
  HTMLInputElement,
  InputProps
>(function Input(
  {
    hasError = false,
    leadingContent,
    trailingContent,
    className,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <div className="relative">
      {leadingContent ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-text-muted">
          {leadingContent}
        </div>
      ) : null}

      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={
          hasError
            ? true
            : props['aria-invalid']
        }
        className={cn(
          'h-9 w-full xl:h-10 2xl:h-11 rounded-xl border border-border-strong bg-surface px-3 text-[12px] xl:px-3.5 xl:text-[13px] 2xl:text-sm min-[1920px]:text-[15px] text-text-primary shadow-sm outline-none transition',
          'placeholder:text-text-subtle',
          'hover:border-focus-border',
          'focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted',
          'aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger-border/40',
          leadingContent && 'pl-10',
          trailingContent && 'pr-10',
          className,
        )}
        {...props}
      />

      {trailingContent ? (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-muted">
          {trailingContent}
        </div>
      ) : null}
    </div>
  );
});