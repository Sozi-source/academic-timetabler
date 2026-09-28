'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

import { Button } from './button';
import { Select } from './select';

interface PaginationProps {
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  totalRows: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onFirstPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  pageIndex,
  pageCount,
  pageSize,
  totalRows,
  canPreviousPage,
  canNextPage,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const firstRow =
    totalRows === 0
      ? 0
      : pageIndex * pageSize + 1;

  const lastRow = Math.min(
    (pageIndex + 1) * pageSize,
    totalRows,
  );

  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 py-2.5 xl:px-4 xl:py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-text-muted">
        Showing {firstRow} to {lastRow} of{' '}
        {totalRows} records
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="rows-per-page"
          className="text-xs text-text-muted"
        >
          Rows
        </label>

        <Select
          id="rows-per-page"
          value={String(pageSize)}
          onChange={(event) => {
            onPageSizeChange(
              Number(event.target.value),
            );
          }}
          className="h-9 w-20 rounded-lg"
        >
          {pageSizeOptions.map((option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ))}
        </Select>

        <span className="mx-1 text-xs font-medium text-text-secondary">
          Page {pageCount === 0 ? 0 : pageIndex + 1}
          {' of '}
          {pageCount}
        </span>

        <Button
          variant="outline"
          size="icon"
          aria-label="First page"
          disabled={!canPreviousPage}
          onClick={onFirstPage}
          className="size-9 rounded-lg"
        >
          <ChevronsLeft
            className="size-4"
            aria-hidden="true"
          />
        </Button>

        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={!canPreviousPage}
          onClick={onPreviousPage}
          className="size-9 rounded-lg"
        >
          <ChevronLeft
            className="size-4"
            aria-hidden="true"
          />
        </Button>

        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={!canNextPage}
          onClick={onNextPage}
          className="size-9 rounded-lg"
        >
          <ChevronRight
            className="size-4"
            aria-hidden="true"
          />
        </Button>

        <Button
          variant="outline"
          size="icon"
          aria-label="Last page"
          disabled={!canNextPage}
          onClick={onLastPage}
          className="size-9 rounded-lg"
        >
          <ChevronsRight
            className="size-4"
            aria-hidden="true"
          />
        </Button>
      </div>
    </div>
  );
}
