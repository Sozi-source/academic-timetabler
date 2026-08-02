import {
  Archive,
  CheckCircle2,
  CircleStop,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import {
  setAcademicYearStatusAction,
} from './actions';
import type {
  AcademicYear,
} from './types';

interface AcademicYearActionsProps {
  academicYear: AcademicYear;
}

export function AcademicYearActions({
  academicYear,
}: AcademicYearActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {academicYear.status === 'planned' ||
      academicYear.status === 'closed' ? (
        <form action={setAcademicYearStatusAction}>
          <input
            type="hidden"
            name="id"
            value={academicYear.id}
          />

          <input
            type="hidden"
            name="status"
            value="active"
          />

          <Button
            type="submit"
            variant="outline"
            size="sm"
            leadingIcon={
              <CheckCircle2
                className="size-3.5"
                aria-hidden="true"
              />
            }
          >
            Activate
          </Button>
        </form>
      ) : null}

      {academicYear.status === 'active' ? (
        <form action={setAcademicYearStatusAction}>
          <input
            type="hidden"
            name="id"
            value={academicYear.id}
          />

          <input
            type="hidden"
            name="status"
            value="closed"
          />

          <Button
            type="submit"
            variant="outline"
            size="sm"
            leadingIcon={
              <CircleStop
                className="size-3.5"
                aria-hidden="true"
              />
            }
          >
            Close
          </Button>
        </form>
      ) : null}

      {academicYear.status !== 'active' &&
      academicYear.status !== 'archived' ? (
        <form action={setAcademicYearStatusAction}>
          <input
            type="hidden"
            name="id"
            value={academicYear.id}
          />

          <input
            type="hidden"
            name="status"
            value="archived"
          />

          <Button
            type="submit"
            variant="ghost"
            size="sm"
            leadingIcon={
              <Archive
                className="size-3.5"
                aria-hidden="true"
              />
            }
          >
            Archive
          </Button>
        </form>
      ) : null}
    </div>
  );
}