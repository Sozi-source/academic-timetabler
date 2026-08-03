import {
  CalendarDays,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/empty-state';

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

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left">
            <thead className="bg-surface-subtle">
              <tr className="border-b border-border">
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Academic Year
                </th>

                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Date range
                </th>

                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Status
                </th>

                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Notes
                </th>

                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {academicYears.map((academicYear) => (
                <tr
                  key={academicYear.id}
                  className="border-b border-border-soft last:border-b-0 hover:bg-surface-subtle/70"
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold text-text-primary">
                      {academicYear.name}
                    </p>

                    <p className="mt-1 text-xs text-text-muted">
                      Updated{' '}
                      {new Intl.DateTimeFormat(
                        'en-GB',
                        {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        },
                      ).format(
                        new Date(
                          academicYear.updatedAt,
                        ),
                      )}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm text-text-secondary">
                    {formatDate(academicYear.startsOn)}
                    <span className="mx-2 text-text-subtle">
                      to
                    </span>
                    {formatDate(academicYear.endsOn)}
                  </td>

                  <td className="px-5 py-4">
                    <AcademicYearStatusBadge
                      status={academicYear.status}
                    />
                  </td>

                  <td className="max-w-xs px-5 py-4 text-sm leading-6 text-text-secondary">
                    <span className="line-clamp-2">
                      {academicYear.notes ??
                        'No notes recorded.'}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}