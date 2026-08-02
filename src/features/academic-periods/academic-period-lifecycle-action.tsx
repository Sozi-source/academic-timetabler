'use client';

import {
  Archive,
  CheckCircle2,
  CircleStop,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import {
  setAcademicPeriodStatusAction,
} from './actions';
import type {
  AcademicPeriod,
  AcademicPeriodStatus,
} from './types';

interface LifecycleConfiguration {
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  buttonVariant:
    | 'primary'
    | 'outline'
    | 'ghost'
    | 'danger';
}

const configurations: Record<
  'active' | 'closed' | 'archived',
  LifecycleConfiguration
> = {
  active: {
    label: 'Activate',
    title: 'Activate Academic Period?',
    description:
      'Any currently active Academic Period will be closed automatically.',
    icon: CheckCircle2,
    buttonVariant: 'primary',
  },
  closed: {
    label: 'Close',
    title: 'Close Academic Period?',
    description:
      'Closing the period prevents it from remaining the active timetable period.',
    icon: CircleStop,
    buttonVariant: 'outline',
  },
  archived: {
    label: 'Archive',
    title: 'Archive Academic Period?',
    description:
      'Archived periods remain available for historical records but cannot be modified.',
    icon: Archive,
    buttonVariant: 'danger',
  },
};

interface AcademicPeriodLifecycleActionProps {
  academicPeriod: AcademicPeriod;
  status:
    | 'active'
    | 'closed'
    | 'archived';
}

export function AcademicPeriodLifecycleAction({
  academicPeriod,
  status,
}: AcademicPeriodLifecycleActionProps) {
  const configuration =
    configurations[status];

  const Icon = configuration.icon;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant={configuration.buttonVariant}
          size="sm"
          leadingIcon={
            <Icon
              className="size-3.5"
              aria-hidden="true"
            />
          }
        >
          {configuration.label}
        </Button>
      </DialogTrigger>

      <DialogContent hideCloseButton>
        <DialogHeader className="border-b-0 pb-2 pr-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <DialogTitle className="mt-4">
            {configuration.title}
          </DialogTitle>

          <DialogDescription>
            {configuration.description}
          </DialogDescription>
        </DialogHeader>

        <div className="mx-6 mb-5 rounded-xl border border-border-soft bg-surface-subtle px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">
            {academicPeriod.name}
          </p>

          <p className="mt-1 text-xs text-text-muted">
            {academicPeriod.academicYear.name}
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">
              Cancel
            </Button>
          </DialogClose>

          <form
            action={setAcademicPeriodStatusAction}
          >
            <input
              type="hidden"
              name="id"
              value={academicPeriod.id}
            />

            <input
              type="hidden"
              name="status"
              value={status}
            />

            <Button
              type="submit"
              variant={configuration.buttonVariant}
            >
              {configuration.label}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function getAcademicPeriodLifecycleActions(
  academicPeriod: AcademicPeriod,
) {
  const actions: AcademicPeriodStatus[] = [];

  if (
    academicPeriod.status === 'planned' ||
    academicPeriod.status === 'closed'
  ) {
    actions.push('active');
  }

  if (academicPeriod.status === 'active') {
    actions.push('closed');
  }

  if (
    academicPeriod.status !== 'active' &&
    academicPeriod.status !== 'archived'
  ) {
    actions.push('archived');
  }

  return actions;
}