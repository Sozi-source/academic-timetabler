import type {
  HTMLAttributes,
  ReactNode,
} from 'react';

import { cn } from '@/lib/utils/cn';

interface CardProps
  extends HTMLAttributes<HTMLElement> {
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
        'rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]',
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
        'border-b border-border-soft px-5 py-4 sm:px-6',
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
    <div
      className={cn(
        'px-5 py-5 sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  );
}