'use client';

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns3,
  Download,
  Rows3,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Column,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
  useReactTable,
} from '@tanstack/react-table';

import { cn } from '@/lib/utils/cn';

import { Checkbox } from './checkbox';
import { EmptyState } from './empty-state';
import { Pagination } from './pagination';
import { TableToolbar } from './table-toolbar';

type Density = 'comfortable' | 'compact';

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
  className?: string;

  /** Adds a "Columns" menu so users can show or hide columns. */
  enableColumnToggle?: boolean;
  /** Adds a checkbox column. Pass `getRowId` so selection survives sorting. */
  enableRowSelection?: boolean;
  /** Rendered in a bar above the table while rows are selected. */
  bulkActions?: (selectedRows: TData[]) => ReactNode;
  /** When set, adds an Export CSV button using this file name (no extension). */
  exportFileName?: string;
  /** Adds a Comfortable / Compact row-height toggle. */
  enableDensityToggle?: boolean;
  initialDensity?: Density;
  /** Keeps the header row visible while the body scrolls. */
  stickyHeader?: boolean;
  /** Tailwind max-height class used when `stickyHeader` is on. */
  maxHeightClassName?: string;
  /** Column ids hidden on first render. */
  initialHiddenColumns?: string[];
}

const SELECT_COLUMN_ID = '__select';
const ACTIONS_COLUMN_ID = 'actions';

function columnLabel<TData>(
  column: Column<TData, unknown>,
): string {
  const header = column.columnDef.header;

  return typeof header === 'string' && header
    ? header
    : column.id;
}

function toCsvCell(value: unknown): string {
  let text: string;

  if (value === null || value === undefined) {
    text = '';
  } else if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'object') {
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }

  // Stop spreadsheet apps from running text such as "=HYPERLINK(...)"
  // as a formula when the file is opened.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv<TData>(
  table: Table<TData>,
  fileName: string,
) {
  const selected = table.getSelectedRowModel().rows;
  const rows =
    selected.length > 0
      ? selected
      : table.getPrePaginationRowModel().rows;

  const columns = table
    .getVisibleLeafColumns()
    .filter(
      (column) =>
        column.id !== SELECT_COLUMN_ID &&
        column.id !== ACTIONS_COLUMN_ID &&
        Boolean(column.accessorFn),
    );

  const lines = [
    columns
      .map((column) => toCsvCell(columnLabel(column)))
      .join(','),
    ...rows.map((row) =>
      columns
        .map((column) =>
          toCsvCell(row.getValue(column.id)),
        )
        .join(','),
    ),
  ];

  // BOM so Excel reads UTF-8 names correctly.
  const blob = new Blob(
    [`\uFEFF${lines.join('\r\n')}`],
    { type: 'text/csv;charset=utf-8;' },
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const toolbarButtonClass =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 text-xs font-semibold text-text-secondary shadow-sm transition hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20';

function ColumnMenu<TData>({
  table,
}: {
  table: Table<TData>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const hideable = table
    .getAllLeafColumns()
    .filter(
      (column) =>
        column.id !== SELECT_COLUMN_ID &&
        column.getCanHide(),
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={toolbarButtonClass}
      >
        <Columns3 className="size-4" aria-hidden="true" />
        Columns
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-border bg-surface p-1.5 shadow-lg">
          <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold text-text-muted">
            Show columns
          </p>

          {hideable.map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-primary hover:bg-surface-subtle"
            >
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={column.getToggleVisibilityHandler()}
                className="size-3.5 accent-[var(--primary)]"
              />
              {columnLabel(column)}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
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
  className,
  enableColumnToggle = false,
  enableRowSelection = false,
  bulkActions,
  exportFileName,
  enableDensityToggle = false,
  initialDensity = 'comfortable',
  stickyHeader = false,
  maxHeightClassName = 'max-h-[70vh]',
  initialHiddenColumns,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] =
    useState<SortingState>([]);

  const [globalFilter, setGlobalFilter] =
    useState('');

  const [rowSelection, setRowSelection] =
    useState<RowSelectionState>({});

  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(() =>
      Object.fromEntries(
        (initialHiddenColumns ?? []).map((id) => [
          id,
          false,
        ]),
      ),
    );

  const [density, setDensity] =
    useState<Density>(initialDensity);

  const allColumns = enableRowSelection
    ? ([
        {
          id: SELECT_COLUMN_ID,
          size: 44,
          enableSorting: false,
          enableHiding: false,
          header: ({ table }) => (
            <Checkbox
              aria-label="Select all rows on this page"
              checked={
                table.getIsAllPageRowsSelected()
                  ? true
                  : table.getIsSomePageRowsSelected()
                    ? 'indeterminate'
                    : false
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(
                  value === true,
                )
              }
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              aria-label="Select row"
              checked={row.getIsSelected()}
              onCheckedChange={(value) =>
                row.toggleSelected(value === true)
              }
            />
          ),
        } satisfies ColumnDef<TData, unknown>,
        ...columns,
      ] as unknown as ColumnDef<TData, TValue>[])
    : columns;

  /*
   * TanStack Table intentionally returns non-memoizable
   * functions. React Compiler should skip this hook call.
   */
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: initialPageSize,
      },
    },
    getRowId,
    enableRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel:
      getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;

  const selectedRows = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);

  const compact = density === 'compact';

  const toolbarExtras =
    toolbarActions ||
    enableColumnToggle ||
    enableDensityToggle ||
    exportFileName ? (
      <>
        {toolbarActions}

        {enableDensityToggle ? (
          <button
            type="button"
            aria-pressed={compact}
            onClick={() =>
              setDensity((value) =>
                value === 'compact'
                  ? 'comfortable'
                  : 'compact',
              )
            }
            className={toolbarButtonClass}
          >
            <Rows3 className="size-4" aria-hidden="true" />
            {compact ? 'Compact' : 'Comfortable'}
          </button>
        ) : null}

        {enableColumnToggle ? (
          <ColumnMenu table={table} />
        ) : null}

        {exportFileName ? (
          <button
            type="button"
            onClick={() =>
              exportCsv(table, exportFileName)
            }
            className={toolbarButtonClass}
          >
            <Download className="size-4" aria-hidden="true" />
            Export
          </button>
        ) : null}
      </>
    ) : undefined;

  return (
    <div className={cn('rounded-xl border border-border bg-surface shadow-sm', className)}>
      <TableToolbar
        searchValue={globalFilter}
        onSearchChange={setGlobalFilter}
        searchPlaceholder={searchPlaceholder}
        filters={toolbarFilters}
        actions={toolbarExtras}
      />

      {enableRowSelection && selectedRows.length > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 border-b border-primary/20 bg-primary-soft px-4 py-2"
        >
          <span className="text-xs font-semibold text-primary-deep">
            {selectedRows.length} selected
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {bulkActions?.(selectedRows)}
          </div>

          <button
            type="button"
            onClick={() => table.resetRowSelection()}
            className="ml-auto text-xs font-semibold text-primary hover:underline"
          >
            Clear selection
          </button>
        </div>
      ) : null}

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
          <div
            className={cn(
              'min-h-[140px] w-full overflow-x-auto',
              stickyHeader &&
                cn('overflow-y-auto', maxHeightClassName),
            )}
          >
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="bg-surface-subtle">
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

                          const colSize = header.column.columnDef.size;
                          const widthStyle = colSize
                            ? { width: `${colSize}px`, minWidth: `${colSize}px`, maxWidth: header.column.columnDef.maxSize ? `${header.column.columnDef.maxSize}px` : `${colSize}px` }
                            : undefined;

                          return (
                            <th
                              key={header.id}
                              colSpan={header.colSpan}
                              style={widthStyle}
                              aria-sort={
                                sorted === 'asc'
                                  ? 'ascending'
                                  : sorted === 'desc'
                                    ? 'descending'
                                    : undefined
                              }
                              className={cn(
                                'min-w-0 break-words px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-primary xl:px-3',
                                compact ? 'py-1.5' : 'py-2.5',
                                stickyHeader &&
                                  'sticky top-0 z-10 bg-surface-subtle shadow-[inset_0_-1px_0_var(--border)]',
                              )}
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
                                      'cursor-pointer transition hover:text-primary',
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
                                        className="size-3.5 text-text-subtle"
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
                    data-state={
                      row.getIsSelected()
                        ? 'selected'
                        : undefined
                    }
                    className="border-b border-border-soft transition last:border-b-0 hover:bg-surface-subtle/70 data-[state=selected]:bg-primary-subtle"
                  >
                    {row
                      .getVisibleCells()
                      .map((cell) => {
                        const colSize = cell.column.columnDef.size;
                        const widthStyle = colSize
                          ? { width: `${colSize}px`, minWidth: `${colSize}px`, maxWidth: cell.column.columnDef.maxSize ? `${cell.column.columnDef.maxSize}px` : `${colSize}px` }
                          : undefined;

                        return (
                          <td
                            key={cell.id}
                            data-label={typeof cell.column.columnDef.header === 'string' && cell.column.columnDef.header
                              ? cell.column.columnDef.header
                              : cell.column.id === 'actions' ? 'Actions' : cell.column.id}
                            style={widthStyle}
                            className={cn(
                              'min-w-0 break-words px-2.5 align-middle text-[12px] font-medium leading-5 text-text-primary xl:px-3 xl:text-[13px]',
                              compact ? 'h-8 py-1' : 'h-11 py-2.5',
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
