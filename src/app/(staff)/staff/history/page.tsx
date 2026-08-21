import {
  CalendarCheck2,
  FileClock,
  FileSpreadsheet,
  FileText,
  History,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  getStaffHistory,
} from '@/features/staff-workspace/queries';
import type {
  StaffHistoryKind,
} from '@/features/staff-workspace/types';

function iconFor(
  kind: StaffHistoryKind,
) {
  if (
    kind ===
    'markbook'
  ) {
    return FileSpreadsheet;
  }

  if (
    kind ===
    'teaching_document'
  ) {
    return FileText;
  }

  if (
    kind ===
    'attendance'
  ) {
    return CalendarCheck2;
  }

  return FileClock;
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'Date unavailable';
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat(
    'en-KE',
    {
      dateStyle:
        'medium',
      timeStyle:
        'short',
    },
  ).format(
    date,
  );
}

export default async function StaffHistoryPage() {
  const profile =
    await requireTrainerAccess();

  const history =
    await getStaffHistory(
      profile.id,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="History"
        description="Your assessment, teaching-document and attendance activity."
        icon={History}
      />

      <Badge variant="neutral">
        {
          history.length
        } records
      </Badge>

      {history.length ===
      0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-10 text-center">
          <History
            className="mx-auto size-5 text-text-muted"
            aria-hidden="true"
          />

          <p className="mt-3 text-sm font-semibold text-text-primary">
            No activity yet
          </p>
        </section>
      ) : (
        <section className="space-y-1.5">
          {history.map(
            (
              item,
            ) => {
              const Icon =
                iconFor(
                  item.kind,
                );

              return (
                <article
                  key={
                    item.id
                  }
                  className="grid gap-3 rounded-lg border border-border bg-white px-3.5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-surface-subtle text-text-secondary">
                    <Icon
                      className="size-3.5"
                      aria-hidden="true"
                    />
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {
                        item.title
                      }
                    </p>

                    <p className="mt-0.5 truncate text-[10px] text-text-muted">
                      {
                        item.detail
                      }
                      {' · '}
                      {formatDate(
                        item.occurredAt,
                      )}
                    </p>
                  </div>

                  <Badge
                    variant={
                      item.status ===
                        'Committed' ||
                      item.status ===
                        'Approved'
                        ? 'success'
                        : 'neutral'
                    }
                  >
                    {
                      item.status
                    }
                  </Badge>
                </article>
              );
            },
          )}
        </section>
      )}
    </div>
  );
}
