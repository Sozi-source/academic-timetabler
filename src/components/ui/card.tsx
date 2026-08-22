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
        'relative overflow-hidden rounded-xl border border-border bg-surface shadow-sm',
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
        'border-b border-border-soft bg-surface-subtle/70 px-4 py-3.5',
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
    <div className={cn('px-3 py-3 xl:px-4 xl:py-4 2xl:px-5 2xl:py-5', className)}>
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
    <h3 className={cn('text-sm font-bold text-text-primary', className)}>
      {children}
    </h3>
  );
}

