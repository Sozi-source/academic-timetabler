'use client';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'cmdk';
import type {
  ComponentProps,
  ReactNode,
} from 'react';

import { cn } from '@/lib/utils/cn';

export function CommandMenu({
  className,
  ...props
}: ComponentProps<typeof Command>) {
  return (
    <Command
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-xl bg-surface text-text-primary',
        className,
      )}
      {...props}
    />
  );
}

export function CommandMenuInput(
  props: ComponentProps<typeof CommandInput>,
) {
  return (
    <CommandInput
      className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-text-subtle"
      {...props}
    />
  );
}

export function CommandMenuList({
  className,
  ...props
}: ComponentProps<typeof CommandList>) {
  return (
    <CommandList
      className={cn(
        'max-h-80 overflow-y-auto p-2',
        className,
      )}
      {...props}
    />
  );
}

export function CommandMenuEmpty({
  children = 'No results found.',
}: {
  children?: ReactNode;
}) {
  return (
    <CommandEmpty className="px-4 py-10 text-center text-sm text-text-muted">
      {children}
    </CommandEmpty>
  );
}

export function CommandMenuGroup({
  className,
  ...props
}: ComponentProps<typeof CommandGroup>) {
  return (
    <CommandGroup
      className={cn(
        'overflow-hidden p-1 text-text-primary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function CommandMenuItem({
  className,
  ...props
}: ComponentProps<typeof CommandItem>) {
  return (
    <CommandItem
      className={cn(
        'flex min-h-10 cursor-default select-none items-center gap-3 rounded-lg px-3 text-sm text-text-secondary outline-none transition',
        'data-[selected=true]:bg-navigation-hover data-[selected=true]:text-text-primary',
        'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function CommandMenuSeparator({
  className,
  ...props
}: ComponentProps<
  typeof CommandSeparator
>) {
  return (
    <CommandSeparator
      className={cn(
        '-mx-2 my-2 h-px bg-border-soft',
        className,
      )}
      {...props}
    />
  );
}