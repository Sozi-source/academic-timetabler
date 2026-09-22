'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type {
  ComponentPropsWithoutRef,
  ElementRef,
} from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<
    typeof TabsPrimitive.List
  >
>(function TabsList(
  {
    className,
    ...props
  },
  ref,
) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-surface-subtle p-1',
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<
    typeof TabsPrimitive.Trigger
  >
>(function TabsTrigger(
  {
    className,
    ...props
  },
  ref,
) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex min-h-8 items-center justify-center rounded-lg px-3 text-sm font-medium text-text-muted transition',
        'hover:text-text-primary',
        'data-[state=active]:border-b-2 data-[state=active]:border-institutional-yellow data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<
    typeof TabsPrimitive.Content
  >
>(function TabsContent(
  {
    className,
    ...props
  },
  ref,
) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35',
        className,
      )}
      {...props}
    />
  );
});