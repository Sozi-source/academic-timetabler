import * as React from 'react';

import { cn } from '@/lib/utils/cn';

interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use true when the table sits inside an existing bordered Card/section to avoid double borders. */
  embedded?: boolean;
  /** Accessible label for the scrollable table region. */
  label?: string;
}

export function TableContainer({
  className,
  embedded = false,
  label = 'Data table',
  children,
  ...props
}: TableContainerProps) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      data-table-scroll="true"
      className={cn(
        'w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
        !embedded && 'rounded-xl border border-border bg-surface shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    data-ui-table="true"
    className={cn(
      'w-full table-auto border-collapse text-left tabular-nums',
      className,
    )}
    {...props}
  />
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('border-b border-border bg-surface-subtle', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('divide-y divide-border-soft', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t-2 border-border bg-surface-subtle font-semibold text-text-primary',
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'transition-colors hover:bg-surface-subtle/70 data-[state=selected]:bg-primary-subtle',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-secondary [overflow-wrap:normal] [word-break:normal]',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'whitespace-nowrap px-3 py-2.5 align-middle text-[13px] font-medium leading-5 text-text-primary [overflow-wrap:normal] [word-break:normal]',
      className,
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';
