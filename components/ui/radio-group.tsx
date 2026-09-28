'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import type {
  ComponentPropsWithoutRef,
  ElementRef,
} from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

export const RadioGroup = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Root>,
  ComponentPropsWithoutRef<
    typeof RadioGroupPrimitive.Root
  >
>(function RadioGroup(
  {
    className,
    ...props
  },
  ref,
) {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cn(
        'grid gap-3',
        className,
      )}
      {...props}
    />
  );
});

export const RadioGroupItem = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Item>,
  ComponentPropsWithoutRef<
    typeof RadioGroupPrimitive.Item
  >
>(function RadioGroupItem(
  {
    className,
    ...props
  },
  ref,
) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'aspect-square size-5 rounded-full border border-border-strong bg-surface text-primary shadow-sm transition',
        'hover:border-focus-border',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35',
        'data-[state=checked]:border-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle
          className="size-2.5 fill-current"
          aria-hidden="true"
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});