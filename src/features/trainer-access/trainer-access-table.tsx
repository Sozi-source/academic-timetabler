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
        size: 260,
        cell: ({ row }) => {
          const record = row.original;

          return (
            <div className="min-w-0">
              <Link
                href={`/trainers/${record.trainerId}`}
                className="block truncate text-xs font-semibold text-text-primary transition hover:text-primary hover:underline"
              >
                {record.fullName}
              </Link>
              <p className="mt-0.5 truncate text-[10px] text-text-muted">
                {record.email ?? 'No email'}
              </p>
            </div>
          );
        },
      },
      {
        id: 'email',
        header: 'Email',
        accessorFn: (record) => record.email ?? '',
        size: 220,
        // Hidden by default (it is already shown under the name),
        // but available in the Columns menu and included in exports.
        cell: ({ getValue }) => getValue<string>() || '—',
      },
      {
        id: 'workspace',
        header: 'Workspace details',
        accessorFn: (record) => trainerAccessDetail(record),
        size: 300,
        cell: ({ row }) => {
          const record = row.original;

          return (
            <div>
              <p className="text-[11px] font-medium text-text-secondary">
                {trainerAccessDetail(record)}
              </p>
              {record.profileRole ? (
                <p className="mt-0.5 text-[10px] text-text-muted">
                  Profile: {record.profileRole}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Access status',
        accessorFn: (record) =>
          record.accessState === 'linked'
            ? 'Active'
            : trainerAccessLabel(record.accessState),
        size: 150,
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
        size: 300,
        cell: ({ row }) => {
          const record = row.original;

          return (
            <div className="trainer-access-actions flex w-full flex-wrap items-center justify-start gap-2 xl:justify-end">
              {canProvisionTrainerAccess(record.accessState) ? (
                <TrainerAccessAction trainerId={record.trainerId} />
              ) : record.accessState === 'email_required' ? (
                <Link
                  href={`/timetable/trainers/${record.trainerId}/edit`}
                  className="inline-flex min-h-11 sm:min-h-8 items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:bg-surface-subtle"
                >
                  Add email
                </Link>
              ) : null}

              {variant === 'pin' &&
              record.trainerActive &&
              record.email &&
              ['linked', 'ready_to_link', 'account_required'].includes(
                record.accessState,
              ) ? (
                <TrainerAccessPinAction trainerId={record.trainerId} />
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
                className="inline-flex min-h-11 sm:min-h-8 items-center justify-center rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[11px] font-medium text-text-secondary transition hover:bg-surface-subtle"
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
      initialPageSize={20}
      initialHiddenColumns={['email']}
      enableColumnToggle
      enableDensityToggle
      exportFileName={exportFileName}
      stickyHeader
      // Sits inside the register card, which already draws the border.
      className="rounded-none border-0 shadow-none"
    />
  );
}
