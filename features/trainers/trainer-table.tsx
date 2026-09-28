'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  RotateCcw,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';

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

const columns: ColumnDef<Trainer>[] = [
  {
    accessorKey: 'fullName',
    header: 'Trainer',
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/trainers/${row.original.id}`}
          className="break-words text-[12px] font-semibold text-text-primary transition hover:text-[#033B36] hover:underline xl:text-sm block"
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
    enableSorting: false,
    header: '',
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <Link
          href={`/trainers/${row.original.id}`}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-white px-2.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary shadow-2xs"
        >
          Profile
        </Link>
      </div>
    ),
  },
];

interface TrainerTableProps {
  trainers: Trainer[];
}

type TrainerState = 'all' | 'available' | 'unavailable' | 'inactive';

export function TrainerTable({ trainers }: TrainerTableProps) {
  const [employmentType, setEmploymentType] = useState<'all' | TrainerEmploymentType>('all');
  const [state, setState] = useState<TrainerState>('all');

  const filteredTrainers = useMemo(
    () =>
      trainers.filter((trainer) => {
        const matchesEmployment =
          employmentType === 'all' || trainer.employmentType === employmentType;

        const matchesState =
          state === 'all' ||
          (state === 'available' && trainer.isActive && trainer.isTimetableAvailable) ||
          (state === 'unavailable' && trainer.isActive && !trainer.isTimetableAvailable) ||
          (state === 'inactive' && !trainer.isActive);

        return matchesEmployment && matchesState;
      }),
    [employmentType, state, trainers],
  );

  const filtersActive = employmentType !== 'all' || state !== 'all';

  return (
    <DataTable
      columns={columns}
      data={filteredTrainers}
      getRowId={(row) => row.id}
      searchPlaceholder="Search trainers"
      emptyIcon={UserRound}
      emptyTitle={filtersActive ? 'No matching trainers' : 'No trainers registered'}
      emptyDescription={filtersActive ? 'Adjust or clear the filters.' : 'Add a trainer to begin.'}
      initialPageSize={20}
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
