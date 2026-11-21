'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { trainerAccessLabel } from '@/features/trainer-access/domain';
import type { TrainerAccessRecord } from '@/features/trainer-access/types';

import {
  setTrainerWorkloadRoleAction,
} from './actions';
import {
  trainerEmploymentTypeOptions,
  type Trainer,
  type TrainerEmploymentType,
  type TrainerWorkloadRole,
} from './types';

const workloadRoleOptions: Array<{
  value: TrainerWorkloadRole;
  label: string;
  target: number | null;
}> = [
  { value: 'hod', label: 'HOD', target: 10 },
  { value: 'course_coordinator', label: 'Course coordinator', target: 16 },
  { value: 'full_time_trainer', label: 'Full-time trainer', target: 20 },
  { value: 'part_time', label: 'Part-time trainer', target: null },
  { value: 'external', label: 'External/service trainer', target: null },
];

function getEmploymentTypeLabel(employmentType: TrainerEmploymentType) {
  return (
    trainerEmploymentTypeOptions.find((option) => option.value === employmentType)?.label ??
    employmentType
  );
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

const columns: ColumnDef<Trainer>[] = [
  {
    accessorKey: 'fullName',
    header: 'Trainer',
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/trainers/${row.original.id}`}
          className="break-words text-[12px] font-semibold text-text-primary transition hover:text-primary hover:underline xl:text-sm block"
        >
          {row.original.fullName}
        </Link>
        {row.original.homeDepartment ? (
          <p className="mt-0.5 break-words text-[10px] text-text-muted xl:text-xs">
            {row.original.homeDepartment}
          </p>
        ) : null}
        {row.original.specialization ? (
          <p className="mt-0.5 break-words text-[10px] text-text-muted xl:text-xs">
            {row.original.specialization}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: 'employmentType',
    header: 'Employment',
    cell: ({ row }) => (
      <Badge variant="neutral">{getEmploymentTypeLabel(row.original.employmentType)}</Badge>
    ),
  },
  {
    id: 'workload',
    accessorFn: (row) => row.workloadRole,
    header: 'Role / load',
    cell: ({ row }) => (
      <div className="min-w-0">
        <form action={setTrainerWorkloadRoleAction} className="flex min-w-0 items-center gap-1.5">
          <input type="hidden" name="id" value={row.original.id} />
          <Select
            name="workloadRole"
            aria-label={`Workload role for ${row.original.fullName}`}
            defaultValue={row.original.workloadRole}
            className="h-8 min-w-0 max-w-[12rem] text-[11px] xl:h-9 xl:text-xs"
          >
            {workloadRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}{option.target === null ? '' : ` · ${option.target}h`}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" size="sm" className="min-h-8 px-2 py-1">
            Save
          </Button>
        </form>
        <p className="mt-1 text-[10px] font-medium text-text-muted xl:text-xs">
          {row.original.normalWeeklyHours}h/week
        </p>
      </div>
    ),
  },
  {
    id: 'availability',
    accessorFn: (row) =>
      !row.isActive ? 'inactive' : row.isTimetableAvailable ? 'available' : 'unavailable',
    header: 'Availability',
    cell: ({ row }) => {
      if (!row.original.isActive) {
        return <Badge variant="warning">Inactive</Badge>;
      }

      return (
        <Badge
          variant={row.original.isTimetableAvailable ? 'success' : 'neutral'}
          dot={row.original.isTimetableAvailable}
        >
          {row.original.isTimetableAvailable ? 'Available' : 'Unavailable'}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    size: 80,
    enableSorting: false,
    header: '',
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <Link
          href={`/trainers/${row.original.id}`}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-surface px-2.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary shadow-2xs"
        >
          Profile
        </Link>
      </div>
    ),
  },
];

interface TrainerTableProps {
  trainers: Trainer[];
  accessRecords?: TrainerAccessRecord[];
  activeDepartmentId?: string;
}

type TrainerState =
  | 'all'
  | 'home_dept'
  | 'other_dept'
  | 'available'
  | 'unavailable'
  | 'linked'
  | 'pending_access'
  | 'inactive';

function getWorkloadRoleShortLabel(role: TrainerWorkloadRole): string {
  switch (role) {
    case 'hod':
      return 'HOD';
    case 'course_coordinator':
      return 'Coordinator';
    case 'full_time_trainer':
      return 'Full-time';
    case 'part_time':
      return 'Part-time';
    case 'external':
      return 'External';
    default:
      return role;
  }
}

export function TrainerTable({
  trainers,
  accessRecords = [],
  activeDepartmentId,
}: TrainerTableProps) {
  const [employmentType, setEmploymentType] = useState<'all' | TrainerEmploymentType>('all');
  const [state, setState] = useState<TrainerState>('all');

  const accessByTrainerId = useMemo(
    () => new Map(accessRecords.map((record) => [record.trainerId, record])),
    [accessRecords],
  );

  const hasAccessData = accessRecords.length > 0;
  const hasOtherDeptTrainers = Boolean(
    activeDepartmentId &&
      trainers.some((t) => t.departmentId && t.departmentId !== activeDepartmentId),
  );

  const filteredTrainers = useMemo(
    () =>
      trainers.filter((trainer) => {
        const matchesEmployment =
          employmentType === 'all' || trainer.employmentType === employmentType;

        const access = accessByTrainerId.get(trainer.id);
        const isOtherDept = Boolean(
          activeDepartmentId &&
            trainer.departmentId &&
            trainer.departmentId !== activeDepartmentId,
        );
        const matchesState =
          state === 'all' ||
          (state === 'home_dept' && !isOtherDept) ||
          (state === 'other_dept' && isOtherDept) ||
          (state === 'available' && trainer.isActive && trainer.isTimetableAvailable) ||
          (state === 'unavailable' && trainer.isActive && !trainer.isTimetableAvailable) ||
          (state === 'linked' && access?.accessState === 'linked') ||
          (state === 'pending_access' &&
            Boolean(access) &&
            access?.accessState !== 'linked' &&
            trainer.isActive) ||
          (state === 'inactive' && !trainer.isActive);

        return matchesEmployment && matchesState;
      }),
    [accessByTrainerId, activeDepartmentId, employmentType, state, trainers],
  );

  const filtersActive = employmentType !== 'all' || state !== 'all';

  return (
    <DataTable
      className="trainer-directory-table"
      columns={columns}
      data={filteredTrainers}
      getRowId={(row) => row.id}
      searchPlaceholder="Search trainers"
      emptyIcon={UserRound}
      emptyTitle={filtersActive ? 'No matching trainers' : 'No trainers registered'}
      emptyDescription={filtersActive ? 'Adjust or clear the filters.' : 'Add a trainer to begin.'}
      initialPageSize={24}
      exportFileName="trainers"
      renderCard={(trainer) => {
        const access = accessByTrainerId.get(trainer.id);
        const accessState = access?.accessState ?? null;
        const isOtherDept = Boolean(
          activeDepartmentId &&
            trainer.departmentId &&
            trainer.departmentId !== activeDepartmentId,
        );

        return (
          <Link href={`/trainers/${trainer.id}`} className="trainer-card-link group">
            <article className="trainer-card-compact">
              <header className="trainer-card-header">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-deep transition group-hover:bg-primary group-hover:text-white"
                  >
                    {getTrainerInitials(trainer.fullName)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-text-primary transition group-hover:text-primary">
                      {trainer.fullName}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {trainer.email ?? trainer.homeDepartment ?? 'No email on file'}
                    </p>
                  </div>
                </div>

                {!trainer.isActive ? (
                  <Badge variant="warning" className="shrink-0">
                    Inactive
                  </Badge>
                ) : accessState ? (
                  <Badge
                    variant={
                      accessState === 'linked'
                        ? 'success'
                        : accessState === 'ready_to_link'
                          ? 'primary'
                          : 'neutral'
                    }
                    className="shrink-0"
                  >
                    {accessState === 'linked' ? (
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                    ) : null}
                    {accessState === 'linked' ? 'Active' : trainerAccessLabel(accessState)}
                  </Badge>
                ) : (
                  <Badge
                    variant={trainer.isTimetableAvailable ? 'success' : 'neutral'}
                    dot={trainer.isTimetableAvailable}
                    className="shrink-0"
                  >
                    {trainer.isTimetableAvailable ? 'Available' : 'Unavailable'}
                  </Badge>
                )}
              </header>

              <footer className="flex items-center justify-between gap-2 border-t border-border-soft pt-2.5 text-[11px] text-text-muted">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {isOtherDept ? (
                    <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">
                      {trainer.homeDepartment || 'Other Dept'}
                    </span>
                  ) : null}
                  <span className="rounded-md bg-surface-subtle px-2 py-0.5 font-medium text-text-secondary">
                    {getEmploymentTypeLabel(trainer.employmentType)}
                  </span>
                  <span className="rounded-md bg-surface-subtle px-2 py-0.5 font-medium text-text-secondary">
                    {getWorkloadRoleShortLabel(trainer.workloadRole)} · {trainer.normalWeeklyHours}h
                  </span>
                  {trainer.isActive && hasAccessData ? (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        trainer.isTimetableAvailable ? 'text-emerald-700' : 'text-text-muted'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-1.5 rounded-full ${
                          trainer.isTimetableAvailable ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                      {trainer.isTimetableAvailable ? 'Available' : 'Off timetable'}
                    </span>
                  ) : null}
                </div>

                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-text-subtle transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </footer>
            </article>
          </Link>
        );
      }}
      toolbarFilters={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by employment type"
            value={employmentType}
            onChange={(event) => setEmploymentType(event.target.value as 'all' | TrainerEmploymentType)}
            className="h-9 w-44 text-[12px] xl:text-sm"
          >
            <option value="all">All employment</option>
            {trainerEmploymentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>

          <Select
            aria-label="Filter by trainer state"
            value={state}
            onChange={(event) => setState(event.target.value as TrainerState)}
            className="h-9 w-40 text-[12px] xl:text-sm"
          >
            <option value="all">All states</option>
            {hasOtherDeptTrainers ? (
              <>
                <option value="home_dept">My department</option>
                <option value="other_dept">Other departments</option>
              </>
            ) : null}
            {hasAccessData ? (
              <>
                <option value="linked">Portal active</option>
                <option value="pending_access">Pending access</option>
              </>
            ) : null}
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="inactive">Inactive</option>
          </Select>

          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon={<RotateCcw className="size-3.5" aria-hidden="true" />}
              onClick={() => {
                setEmploymentType('all');
                setState('all');
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
