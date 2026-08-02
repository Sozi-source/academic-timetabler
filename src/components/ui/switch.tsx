'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import type {
  ComponentPropsWithoutRef,
  ElementRef,
} from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<
    typeof SwitchPrimitive.Root
  >
>(function Switch(
  {
    className,
    ...props
  },
  ref,
) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition',
        'bg-surface-muted data-[state=checked]:bg-primary',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform',
          'data-[state=unchecked]:translate-x-0.5',
          'data-[state=checked]:translate-x-[1.25rem]',
        )}
      />
    </SwitchPrimitive.Root>
  );
});