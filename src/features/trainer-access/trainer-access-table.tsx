'use client';

import { CheckCircle2, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';

import {
  canProvisionTrainerAccess,
  trainerAccessDetail,
  trainerAccessLabel,
} from './domain';
import { TrainerAccessAction } from './trainer-access-action';
import { ResetTrainerPassword } from '@/features/trainers/reset-trainer-password';
import { TrainerAccessPinAction } from './trainer-access-pin-action';
import type { TrainerAccessRecord } from './types';

interface TrainerAccessTableProps {
  records: TrainerAccessRecord[];
  /**
   * "pin" (default) shows the one-time PIN action, as on Trainer Access.
   * "password" shows the password reset action, as on Staff & Trainers.
   */
  variant?: 'pin' | 'password';
  exportFileName?: string;
}

function getTrainerInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'TR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function TrainerAccessTable({
  records,
  variant = 'pin',
  exportFileName = 'trainer-access-register',
}: TrainerAccessTableProps) {
  const columns = useMemo<ColumnDef<TrainerAccessRecord>[]>(
    () => [
      {
        id: 'trainer',
        header: 'Trainer',
        accessorFn: (record) => record.fullName,
        cell: ({ row }) => (
          <Link
            href={`/trainers/${row.original.trainerId}`}
            className="font-semibold text-text-primary transition hover:text-primary hover:underline"
          >
            {row.original.fullName}
          </Link>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        accessorFn: (record) => record.email ?? '',
        cell: ({ getValue }) => (
          <span className="text-text-secondary">
            {getValue<string>() || '—'}
          </span>
        ),
      },
      {
        id: 'workspace',
        header: 'Workspace details',
        accessorFn: (record) => trainerAccessDetail(record),
        cell: ({ row }) => (
          <span className="text-text-secondary">
            {trainerAccessDetail(row.original)}
          </span>
        ),
      },
      {
        id: 'profileRole',
        header: 'Profile role',
        accessorFn: (record) => record.profileRole ?? '',
        cell: ({ row }) => (
          <span className="text-text-secondary">
            {row.original.profileRole || '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Access status',
        accessorFn: (record) =>
          record.accessState === 'linked'
            ? 'Active'
            : trainerAccessLabel(record.accessState),
        minSize: 130,
        cell: ({ row, getValue }) => {
          const state = row.original.accessState;

          return (
            <Badge
              variant={
                state === 'linked'
                  ? 'success'
                  : state === 'ready_to_link'
                    ? 'primary'
                    : 'neutral'
              }
            >
              {state === 'linked' ? (
                <CheckCircle2 className="size-3" aria-hidden="true" />
              ) : null}
              {getValue<string>()}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        minSize: 220,
        cell: ({ row }) => {
          const record = row.original;
          const canGenerateExternalPin =
            variant === 'pin' &&
            record.trainerActive &&
            Boolean(record.email) &&
            ['linked', 'ready_to_link', 'account_required'].includes(
              record.accessState,
            ) &&
            record.profileRole !== 'hod' &&
            record.profileRole !== 'system_admin';

          return (
            <div className="trainer-access-actions flex w-full flex-wrap items-center justify-start gap-2 lg:flex-nowrap lg:justify-end">
              {canProvisionTrainerAccess(record.accessState) ? (
                <TrainerAccessAction trainerId={record.trainerId} />
              ) : record.accessState === 'email_required' ? (
                <Link
                  href={`/timetable/trainers/${record.trainerId}/edit`}
                  className="inline-flex min-h-11 sm:min-h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-subtle"
                >
                  Add email
                </Link>
              ) : null}

              {canGenerateExternalPin ? (
                <TrainerAccessPinAction
                  trainerId={record.trainerId}
                  trainerName={record.fullName}
                  trainerEmail={record.email}
                />
              ) : null}

              {variant === 'password' && record.email ? (
                <ResetTrainerPassword
                  trainerId={record.trainerId}
                  trainerName={record.fullName}
                  trainerEmail={record.email}
                  buttonVariant="outline"
                  buttonSize="sm"
                  buttonLabel="Password"
                />
              ) : null}

              <Link
                href={`/trainers/${record.trainerId}`}
                className="inline-flex min-h-11 sm:min-h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
              >
                Profile
              </Link>
            </div>
          );
        },
      },
    ],
    [variant],
  );

  return (
    <DataTable
      columns={columns}
      data={records}
      getRowId={(record) => record.trainerId}
      searchPlaceholder="Search trainers"
      emptyIcon={Users}
      emptyTitle="No trainers found"
      emptyDescription="Register trainers before provisioning access."
      initialPageSize={24}
      initialHiddenColumns={['profileRole']}
      enableColumnToggle
      exportFileName={exportFileName}
      layout="auto"
      // Sits inside the register card, which already draws the border.
      className="rounded-none border-0 shadow-none"
      renderCard={(record) => {
        const state = record.accessState;
        const statusText =
          state === 'linked' ? 'Active' : trainerAccessLabel(state);
        const canGenerateExternalPin =
          variant === 'pin' &&
          record.trainerActive &&
          Boolean(record.email) &&
          ['linked', 'ready_to_link', 'account_required'].includes(state) &&
          record.profileRole !== 'hod' &&
          record.profileRole !== 'system_admin';

        return (
          <article className="trainer-card">
            <header className="trainer-card-header">
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-deep"
                >
                  {getTrainerInitials(record.fullName)}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-text-primary">
                    <Link
                      href={`/trainers/${record.trainerId}`}
                      className="transition hover:text-primary hover:underline"
                    >
                      {record.fullName}
                    </Link>
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {record.email ?? 'No email on file'}
                  </p>
                </div>
              </div>

              <Badge
                variant={
                  state === 'linked'
                    ? 'success'
                    : state === 'ready_to_link'
                      ? 'primary'
                      : 'neutral'
                }
                className="shrink-0"
              >
                {state === 'linked' ? (
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                ) : null}
                {statusText}
              </Badge>
            </header>

            <div className="min-w-0 space-y-1 rounded-lg bg-surface-subtle/70 px-3 py-2.5 text-xs">
              <p className="font-medium text-text-secondary">
                {trainerAccessDetail(record)}
              </p>
              {record.profileRole ? (
                <p className="text-[11px] text-text-muted">
                  Profile: <span className="font-medium text-text-secondary">{record.profileRole}</span>
                </p>
              ) : null}
            </div>

            <footer className="border-t border-border-soft pt-3">
              <div className="trainer-access-actions">
                {canProvisionTrainerAccess(state) ? (
                  <TrainerAccessAction trainerId={record.trainerId} />
                ) : state === 'email_required' ? (
                  <Link
                    href={`/timetable/trainers/${record.trainerId}/edit`}
                    className="inline-flex min-h-11 sm:min-h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-subtle"
                  >
                    Add email
                  </Link>
                ) : null}

                {canGenerateExternalPin ? (
                  <TrainerAccessPinAction
                    trainerId={record.trainerId}
                    trainerName={record.fullName}
                    trainerEmail={record.email}
                  />
                ) : null}

                {variant === 'password' && record.email ? (
                  <ResetTrainerPassword
                    trainerId={record.trainerId}
                    trainerName={record.fullName}
                    trainerEmail={record.email}
                    buttonVariant="outline"
                    buttonSize="sm"
                    buttonLabel="Password"
                  />
                ) : null}

                <Link
                  href={`/trainers/${record.trainerId}`}
                  className="ml-auto inline-flex min-h-11 sm:min-h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                >
                  Profile
                </Link>
              </div>
            </footer>
          </article>
        );
      }}
    />
  );
}
