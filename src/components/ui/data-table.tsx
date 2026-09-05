'use client';

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';

import { cn } from '@/lib/utils/cn';

import { EmptyState } from './empty-state';
import { Pagination } from './pagination';
import { TableToolbar } from './table-toolbar';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  toolbarFilters?: ReactNode;
  toolbarActions?: ReactNode;
  emptyIcon: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  initialPageSize?: number;
  getRowId?: (row: TData) => string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = 'Search records',
  toolbarFilters,
  toolbarActions,
  emptyIcon,
  emptyTitle = 'No records found',
  emptyDescription =
    'Create the first record or adjust the current filters.',
  initialPageSize = 10,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] =
    useState<SortingState>([]);

  const [globalFilter, setGlobalFilter] =
    useState('');

  /*
   * TanStack Table intentionally returns non-memoizable
   * functions. React Compiler should skip this hook call.
   */
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: initialPageSize,
      },
    },
    getRowId,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel:
      getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm">
      <TableToolbar
        searchValue={globalFilter}
        onSearchChange={setGlobalFilter}
        searchPlaceholder={searchPlaceholder}
        filters={toolbarFilters}
        actions={toolbarActions}
      />

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      ) : (
        <div className="w-full">
          <div className="w-full overflow-x-auto min-h-[140px]"><table className="w-full table-fixed border-collapse text-left">
            <thead className="border-t-[3px] border-institutional-yellow bg-primary">
              {table
                .getHeaderGroups()
                .map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-border"
                  >
                    {headerGroup.headers.map(
                      (header) => {
                        const canSort =
                          header.column.getCanSort();

                        const sorted =
                          header.column.getIsSorted();

                        return (
                          <th
                            key={header.id}
                            colSpan={header.colSpan}
                            className="min-w-0 break-words px-2.5 py-2 text-[10px] font-semibold uppercase xl:px-3 xl:py-2.5 xl:text-[11px] 2xl:text-xs min-[1920px]:text-[13px] tracking-[0.06em] text-white/85"
                          >
                            {header.isPlaceholder ? null : (
                              <button
                                type="button"
                                disabled={!canSort}
                                onClick={
                                  canSort
                                    ? header.column.getToggleSortingHandler()
                                    : undefined
                                }
                                className={cn(
                                  'inline-flex max-w-full items-center gap-1 text-left',
                                  canSort &&
                                    'cursor-pointer transition hover:text-institutional-yellow',
                                )}
                              >
                                {flexRender(
                                  header.column
                                    .columnDef.header,
                                  header.getContext(),
                                )}

                                {canSort ? (
                                  sorted === 'asc' ? (
                                    <ChevronUp
                                      className="size-3.5"
                                      aria-hidden="true"
                                    />
                                  ) : sorted ===
                                    'desc' ? (
                                    <ChevronDown
                                      className="size-3.5"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <ChevronsUpDown
                                      className="size-3.5 text-white/45"
                                      aria-hidden="true"
                                    />
                                  )
                                ) : null}
                              </button>
                            )}
                          </th>
                        );
                      },
                    )}
                  </tr>
                ))}
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border-soft transition last:border-b-0 hover:bg-surface-subtle/70"
                >
                  {row
                    .getVisibleCells()
                    .map((cell) => (
                      <td
                        key={cell.id}
                        className="min-w-0 break-words px-2.5 py-2 align-top text-[12px] leading-5 xl:px-3 xl:py-2.5 xl:text-[13px] 2xl:text-sm min-[1920px]:text-[15px] text-text-secondary"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <Pagination
        pageIndex={
          table.getState().pagination.pageIndex
        }
        pageCount={table.getPageCount()}
        pageSize={
          table.getState().pagination.pageSize
        }
        totalRows={
          table.getFilteredRowModel().rows.length
        }
        canPreviousPage={
          table.getCanPreviousPage()
        }
        canNextPage={table.getCanNextPage()}
        onFirstPage={() => {
          table.firstPage();
        }}
        onPreviousPage={() => {
          table.previousPage();
        }}
        onNextPage={() => {
          table.nextPage();
        }}
        onLastPage={() => {
          table.lastPage();
        }}
        onPageSizeChange={(pageSize) => {
          table.setPageSize(pageSize);
        }}
      />
    </div>
  );
}