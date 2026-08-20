import type { ReactNode } from 'react';

import { SearchBar } from './search-bar';

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
  searchPlaceholder,
  filters,
  actions,
}: TableToolbarProps) {
  return (
    <div className="relative flex flex-col gap-3 border-b border-border bg-surface px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-institutional-yellow">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full sm:max-w-sm"
        />

        {filters}
      </div>

      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}