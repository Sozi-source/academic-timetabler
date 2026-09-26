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
        'relative min-w-0 overflow-hidden rounded-[0.9rem] border border-border-soft bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.035)]',
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
        'border-b border-border-soft bg-surface-subtle/55 px-4 py-3',
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
    <div className={cn('px-3.5 py-3.5 xl:px-4 xl:py-4', className)}>
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
