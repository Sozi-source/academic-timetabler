'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type {
  ComponentPropsWithoutRef,
  ElementRef,
  ReactNode,
} from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger =
  DialogPrimitive.Trigger;
export const DrawerClose =
  DialogPrimitive.Close;

export const DrawerContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<
    typeof DialogPrimitive.Content
  >
>(function DrawerContent(
  {
    children,
    className,
    ...props
  },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-black/25 backdrop-blur-[1px]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        )}
      />

      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-[min(34rem,100vw)] border-l border-border bg-surface shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          className,
        )}
        {...props}
      >
        {children}

        <DialogPrimitive.Close
          aria-label="Close drawer"
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-subtle hover:text-text-primary"
        >
          <X
            className="size-4"
            aria-hidden="true"
          />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function DrawerHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-b border-border px-6 py-5 pr-14',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DrawerTitle({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Title className="text-lg font-semibold text-text-primary">
      {children}
    </DialogPrimitive.Title>
  );
}

export function DrawerDescription({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Description className="mt-1 text-sm leading-6 text-text-secondary">
      {children}
    </DialogPrimitive.Description>
  );
}

export function DrawerBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'h-[calc(100vh-9rem)] overflow-y-auto px-6 py-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DrawerFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 flex justify-end gap-2 border-t border-border bg-surface px-6 py-4',
        className,
      )}
    >
      {children}
    </div>
  );
}