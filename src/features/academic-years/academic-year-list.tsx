import {
  CalendarDays,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  AcademicYearActions,
} from './academic-year-actions';
import {
  AcademicYearStatusBadge,
} from './academic-year-status-badge';
import type {
  AcademicYear,
} from './types';

interface AcademicYearListProps {
  academicYears: AcademicYear[];
}

const dateFormatter = new Intl.DateTimeFormat(
  'en-GB',
  {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  },
);

function formatDate(value: string) {
  return dateFormatter.format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

export function AcademicYearList({
  academicYears,
}: AcademicYearListProps) {
  if (academicYears.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No Academic Years created"
        description="No academic years."
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 md:hidden">
        {academicYears.map((academicYear) => (
          <article
            key={academicYear.id}
            className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-text-primary">
                  {academicYear.name}
                </h3>

                <p className="mt-1 text-xs text-text-muted">
                  {formatDate(academicYear.startsOn)}
                    <span className="mx-2 text-text-subtle">
                      to
                    </span>
                    {formatDate(academicYear.endsOn)}
                </p>
              </div>

              <AcademicYearStatusBadge
                status={academicYear.status}
              />
            </div>

            {academicYear.notes ? (
              <p className="mt-4 text-sm leading-6 text-text-secondary">
                {academicYear.notes}
              </p>
            ) : (
              <p className="mt-4 text-sm italic text-text-muted">
                No notes recorded.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
              <Link
                href={`/timetable/academic-years/${academicYear.id}/edit`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
              >
                <Pencil
                  className="size-3.5"
                  aria-hidden="true"
                />
                Edit
              </Link>

              <AcademicYearActions
                academicYear={academicYear}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block">
        <TableContainer label="Academic years">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Academic Year</TableHead>
                <TableHead>Date range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {academicYears.map((academicYear) => (
                <TableRow key={academicYear.id}>
                  <TableCell className="font-semibold text-text-primary">
                    {academicYear.name}
                  </TableCell>

                  <TableCell className="text-text-secondary">
                    {formatDate(academicYear.startsOn)} – {formatDate(academicYear.endsOn)}
                  </TableCell>

                  <TableCell>
                    <AcademicYearStatusBadge
                      status={academicYear.status}
                    />
                  </TableCell>

                  <TableCell className="text-text-secondary">
                    {academicYear.notes ?? '—'}
                  </TableCell>

                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/timetable/academic-years/${academicYear.id}/edit`}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        <Pencil
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        Edit
                      </Link>

                      <AcademicYearActions
                        academicYear={academicYear}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </>
  );
}