import type {
  HTMLAttributes,
  ReactNode,
} from 'react';

import { cn } from '@/lib/utils/cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Card({
  children,
  className,
  ...props
}: CardProps) {
  return (
    <article
      className={cn(
        'relative min-w-0 overflow-hidden rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-b border-border bg-surface-subtle px-3.5 py-2.5 sm:px-4 sm:py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-3.5 py-3 sm:px-4 sm:py-3.5', className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn('text-xs sm:text-sm font-semibold text-text-primary', className)}>
      {children}
    </h3>
  );
}
