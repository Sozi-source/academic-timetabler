import {
  forwardRef,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils/cn';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaProps
>(function Textarea(
  {
    hasError = false,
    className,
    disabled,
    rows = 4,
    ...props
  },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      disabled={disabled}
      aria-invalid={
        hasError
          ? true
          : props['aria-invalid']
      }
      className={cn(
        'w-full resize-y rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-[12px] leading-5 xl:px-3.5 xl:py-3 xl:text-[13px] 2xl:text-sm 2xl:leading-6 min-[1920px]:text-[15px] text-text-primary shadow-sm outline-none transition',
        'placeholder:text-text-subtle',
        'hover:border-focus-border',
        'focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted',
        'aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger-border/40',
        className,
      )}
      {...props}
    />
  );
});