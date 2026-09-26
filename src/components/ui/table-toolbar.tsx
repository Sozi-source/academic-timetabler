'use client';

import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

interface TableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records',
  filters,
  actions,
}: TableToolbarProps) {
  return (
    <div className="border-b border-border bg-surface px-3 py-2.5 sm:px-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative w-full shrink-0 lg:w-[18rem] xl:w-[20rem]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />

          <input
            type="search"
            value={searchValue}
            onChange={(event) => {
              onSearchChange(event.target.value);
            }}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-xs text-text-primary shadow-sm outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/10 sm:text-sm"
          />
        </div>

        {filters || actions ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            {filters ? (
              <div
                className="
                  grid w-full grid-cols-1 gap-2
                  sm:grid-cols-2
                  lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:justify-end
                  [&>div]:contents
                  [&_select]:!h-9
                  [&_select]:!w-full
                  [&_select]:!min-w-0
                  [&_select]:!text-xs
                  sm:[&_select]:!text-sm
                  lg:[&_select]:!w-[8.5rem]
                  xl:[&_select]:!w-[9.5rem]
                  lg:[&_select:first-of-type]:!w-[11rem]
                  xl:[&_select:first-of-type]:!w-[12rem]
                "
              >
                {filters}
              </div>
            ) : null}

            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto lg:ml-0">
                {actions}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
