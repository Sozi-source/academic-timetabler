import type {
  LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface-subtle px-6 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-institutional-accent-border bg-institutional-yellow text-primary shadow-sm ring-2 ring-institutional-yellow-soft">
        <Icon
          className="size-5"
          aria-hidden="true"
        />
      </div>

      <h2 className="mt-4 text-base font-semibold text-text-primary">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
        {description}
      </p>

      {action ? (
        <div className="mt-6 flex justify-center">
          {action}
        </div>
      ) : null}
    </div>
  );
}