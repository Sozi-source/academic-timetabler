import {
  History,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  formatOperationsEventType,
} from '@/features/operations/domain';
import {
  getOperationsAudit,
} from '@/features/operations/queries';

function formatDate(
  value:
    string,
) {
  const date =
    new Date(
      value,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? value
    : new Intl.DateTimeFormat(
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

export default async function OperationsAuditPage() {
  await requireHodAccess();

  const items =
    await getOperationsAudit(
      150,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations & QA"
        title="Operational audit"
        description="Recent controlled workflow activity."
        icon={History}
        context={
          <Badge variant="neutral">
            {
              items.length
            } events
          </Badge>
        }
      />

      {items.length ===
      0 ? (
        <div className="rounded-xl border border-border bg-white px-4 py-8 text-center text-xs text-text-muted">
          No operational audit activity yet.
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {items.map(
              (
                item,
                index,
              ) => (
                <article
                  key={`${item.occurredAt}-${index}`}
                  className="grid gap-2 px-4 py-3 md:grid-cols-[9rem_10rem_minmax(0,1fr)_10rem] md:items-center md:gap-3"
                >
                  <p className="text-[10px] text-text-muted">
                    {formatDate(
                      item.occurredAt,
                    )}
                  </p>

                  <div>
                    <Badge variant="neutral">
                      {
                        item.area
                      }
                    </Badge>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {
                        item.subject
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {formatOperationsEventType(
                        item.eventType,
                      )}
                      {item.detail
                        ? ` · ${item.detail}`
                        : ''}
                    </p>
                  </div>

                  <p className="truncate text-[10px] font-medium text-text-secondary">
                    {
                      item.actorName
                    }
                  </p>
                </article>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
