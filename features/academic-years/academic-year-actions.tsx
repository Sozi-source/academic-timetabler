import {
  Save,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';
import {
  Select,
} from '@/components/ui/select';

import {
  setAcademicYearStatusAction,
} from './actions';
import type {
  AcademicYear,
  AcademicYearStatus,
} from './types';

interface AcademicYearActionsProps {
  academicYear: AcademicYear;
}

const statusOptions: ReadonlyArray<{
  value: AcademicYearStatus;
  label: string;
}> = [
  {
    value: 'planned',
    label: 'Planned',
  },
  {
    value: 'active',
    label: 'Active',
  },
  {
    value: 'closed',
    label: 'Closed',
  },
  {
    value: 'archived',
    label: 'Archived',
  },
];

export function AcademicYearActions({
  academicYear,
}: AcademicYearActionsProps) {
  return (
    <form
      action={
        setAcademicYearStatusAction
      }
      className="flex items-center gap-2"
    >
      <input
        type="hidden"
        name="id"
        value={academicYear.id}
      />

      <Select
        name="status"
        defaultValue={
          academicYear.status
        }
        aria-label={`Status for ${academicYear.name}`}
        className="h-9 min-w-28 text-xs"
      >
        {statusOptions.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ),
        )}
      </Select>

      <Button
        type="submit"
        variant="outline"
        size="sm"
        leadingIcon={
          <Save
            className="size-3.5"
            aria-hidden="true"
          />
        }
      >
        Set
      </Button>
    </form>
  );
}