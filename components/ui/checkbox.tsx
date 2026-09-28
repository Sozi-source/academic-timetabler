'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type {
  ComponentPropsWithoutRef,
  ElementRef,
} from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<
    typeof CheckboxPrimitive.Root
  >
>(function Checkbox(
  {
    className,
    ...props
  },
  ref,
) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'peer flex size-5 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface shadow-sm transition',
        'hover:border-focus-border',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check
          className="size-3.5"
          aria-hidden="true"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});