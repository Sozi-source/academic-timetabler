'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import {
  Check,
  ChevronRight,
  Circle,
} from 'lucide-react';
import type {
  ComponentPropsWithoutRef,
  ElementRef,
} from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

export const DropdownMenu =
  DropdownMenuPrimitive.Root;

export const DropdownMenuTrigger =
  DropdownMenuPrimitive.Trigger;

export const DropdownMenuGroup =
  DropdownMenuPrimitive.Group;

export const DropdownMenuPortal =
  DropdownMenuPrimitive.Portal;

export const DropdownMenuSub =
  DropdownMenuPrimitive.Sub;

export const DropdownMenuRadioGroup =
  DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.Content
  >
>(function DropdownMenuContent(
  {
    className,
    sideOffset = 6,
    ...props
  },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-44 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.Item
  > & {
    inset?: boolean;
    destructive?: boolean;
  }
>(function DropdownMenuItem(
  {
    className,
    inset,
    destructive,
    ...props
  },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-2.5 text-sm outline-none transition',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destructive
          ? 'text-danger focus:bg-danger-surface'
          : 'text-text-secondary focus:bg-navigation-hover focus:text-text-primary',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<
    typeof DropdownMenuPrimitive.CheckboxItem
  >,
  ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.CheckboxItem
  >
>(function DropdownMenuCheckboxItem(
  {
    className,
    children,
    checked,
    ...props
  },
  ref,
) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(
        'relative flex min-h-9 cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-2.5 text-sm text-text-secondary outline-none transition focus:bg-navigation-hover focus:text-text-primary',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>

      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
});

export const DropdownMenuRadioItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.RadioItem
  >
>(function DropdownMenuRadioItem(
  {
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        'relative flex min-h-9 cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-2.5 text-sm text-text-secondary outline-none transition focus:bg-navigation-hover focus:text-text-primary',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>

      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
});

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Label>,
  ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.Label
  > & {
    inset?: boolean;
  }
>(function DropdownMenuLabel(
  {
    className,
    inset,
    ...props
  },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        'px-2.5 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-muted',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = forwardRef<
  ElementRef<
    typeof DropdownMenuPrimitive.Separator
  >,
  ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.Separator
  >
>(function DropdownMenuSeparator(
  {
    className,
    ...props
  },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn(
        '-mx-1.5 my-1.5 h-px bg-border-soft',
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuSubTrigger = forwardRef<
  ElementRef<
    typeof DropdownMenuPrimitive.SubTrigger
  >,
  ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.SubTrigger
  > & {
    inset?: boolean;
  }
>(function DropdownMenuSubTrigger(
  {
    className,
    inset,
    children,
    ...props
  },
  ref,
) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        'flex min-h-9 cursor-default select-none items-center rounded-lg px-2.5 text-sm text-text-secondary outline-none transition focus:bg-navigation-hover focus:text-text-primary data-[state=open]:bg-navigation-hover',
        inset && 'pl-8',
        className,
      )}
      {...props}
    >
      {children}

      <ChevronRight className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
});

export const DropdownMenuSubContent = forwardRef<
  ElementRef<
    typeof DropdownMenuPrimitive.SubContent
  >,
  ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.SubContent
  >
>(function DropdownMenuSubContent(
  {
    className,
    ...props
  },
  ref,
) {
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        'z-50 min-w-40 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-md',
        className,
      )}
      {...props}
    />
  );
});