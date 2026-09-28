'use client';

import {
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  destructive?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  icon: Icon = AlertTriangle,
  destructive = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>

      <DialogContent hideCloseButton>
        <DialogHeader className="border-b-0 pb-2 pr-6">
          <div
            className={
              destructive
                ? 'flex size-11 items-center justify-center rounded-xl bg-danger-surface text-danger'
                : 'flex size-11 items-center justify-center rounded-xl bg-warning-surface text-warning'
            }
          >
            <Icon
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <DialogTitle className="mt-4">
            {title}
          </DialogTitle>

          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        {children ? (
          <DialogBody className="pt-2">
            {children}
          </DialogBody>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">
              {cancelLabel}
            </Button>
          </DialogClose>

          <div>
            {/*
              Pass a form or action button as children when
              server-side confirmation is required.
            */}
            <Button
              variant={
                destructive
                  ? 'danger'
                  : 'primary'
              }
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}