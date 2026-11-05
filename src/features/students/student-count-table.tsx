'use client';

import { BarChart3 } from 'lucide-react';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { DataTable } from '@/components/ui/data-table';

export interface StudentCountRow {
  label: string;
  total: number;
  active: number;
  deferred: number;
  attachment: number;
  completed: number;
  graduated: number;
}

interface StudentCountTableProps {
  rows: StudentCountRow[];
  firstColumnLabel: string;
  /** Programme table shows Completed and Graduated; cohort census does not. */
  includeOutcomes?: boolean;
  exportFileName: string;
}

export function StudentCountTable({
  rows,
  firstColumnLabel,
  includeOutcomes = false,
  exportFileName,
}: StudentCountTableProps) {
  const columns = useMemo<ColumnDef<StudentCountRow>[]>(() => {
    const numeric = (
      key: keyof Omit<StudentCountRow, 'label'>,
      header: string,
      strong = false,
    ): ColumnDef<StudentCountRow> => ({
      id: key,
      header,
      accessorFn: (row) => row[key],
      cell: ({ getValue }) => (
        <span
          className={
            strong
              ? 'font-semibold tabular-nums'
              : 'tabular-nums text-text-secondary'
          }
        >
          {getValue<number>()}
        </span>
      ),
    });

    return [
      {
        id: 'label',
        header: firstColumnLabel,
        accessorFn: (row) => row.label,
        cell: ({ getValue }) => (
          <span className="font-semibold">{getValue<string>()}</span>
        ),
      },
      numeric('total', 'Total', true),
      numeric('active', 'Active'),
      numeric('attachment', 'Attachment'),
      numeric('deferred', 'Deferred'),
      ...(includeOutcomes
        ? [
            numeric('completed', 'Completed'),
            numeric('graduated', 'Graduated'),
          ]
        : []),
    ];
  }, [firstColumnLabel, includeOutcomes]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.label}
      searchPlaceholder={`Search ${firstColumnLabel.toLowerCase()}`}
      emptyIcon={BarChart3}
      emptyTitle="No students to report"
      initialPageSize={20}
      enableDensityToggle
      exportFileName={exportFileName}
      className="rounded-none border-0 shadow-none"
    />
  );
}
