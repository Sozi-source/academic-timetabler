import {
  Download,
} from 'lucide-react';

import {
  cn,
} from '@/lib/utils/cn';

import type {
  ImportEntityType,
} from './types';

interface TemplateDownloadLinkProps {
  entityType: ImportEntityType;
  label?: string;
  className?: string;
}

export function TemplateDownloadLink({
  entityType,
  label = 'Download template',
  className,
}: TemplateDownloadLinkProps) {
  return (
    <a
      href={`/api/import-templates/${entityType}`}
      download
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition',
        'hover:bg-surface-subtle hover:text-text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <Download
        className="size-4"
        aria-hidden="true"
      />

      {label}
    </a>
  );
}