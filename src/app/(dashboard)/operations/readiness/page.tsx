import {
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Card,
} from '@/components/ui/card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  operationsReadinessIssues,
  operationsReadinessScore,
  readinessSeverityVariant,
} from '@/features/operations/domain';
import {
  getOperationsSnapshot,
} from '@/features/operations/queries';

export default async function OperationsReadinessPage() {
  await requireHodAccess();

  const snapshot =
    await getOperationsSnapshot();

  const issues =
    operationsReadinessIssues(
      snapshot,
    );

  const score =
    operationsReadinessScore(
      snapshot,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations & QA"
        title="Readiness checks"
        description="Automated cross-module checks."
        icon={ShieldCheck}
        context={
          <Badge
            variant={
              score >=
              80
                ? 'success'
                : score >=
                    60
                  ? 'warning'
                  : 'danger'
            }
          >
            {
              score
            }%
          </Badge>
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-text-primary">
            Current academic period
          </h2>

          <p className="mt-0.5 text-xs text-text-muted">
            {
              snapshot.activePeriodName ??
              'No active period'
            }
          </p>
        </div>

        {issues.length ===
        0 ? (
          <div className="flex items-center gap-3 px-4 py-6">
            <span className="flex size-9 items-center justify-center rounded-full bg-success-surface text-success">
              <CheckCircle2
                className="size-4"
                aria-hidden="true"
              />
            </span>

            <div>
              <p className="text-sm font-semibold text-text-primary">
                Ready for structured testing
              </p>

              <p className="mt-0.5 text-xs text-text-muted">
                No automated readiness issues were detected.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {issues.map(
              (
                issue,
              ) => (
                <div
                  key={
                    issue.id
                  }
                  className="grid gap-3 px-4 py-4 md:grid-cols-[8rem_minmax(0,1fr)_auto] md:items-center"
                >
                  <Badge
                    variant={
                      readinessSeverityVariant(
                        issue.severity,
                      )
                    }
                  >
                    {
                      issue.severity
                    }
                  </Badge>

                  <div>
                    <p className="text-xs font-semibold text-text-primary">
                      {
                        issue.title
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] leading-4 text-text-muted">
                      {
                        issue.area
                      }
                      {' · '}
                      {
                        issue.detail
                      }
                    </p>
                  </div>

                  <Link
                    href={
                      issue.href
                    }
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Resolve
                  </Link>
                </div>
              ),
            )}
          </div>
        )}
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title:
              'Student readiness',
            value:
              `${snapshot.students.registered}/${snapshot.students.eligible}`,
            detail:
              `${snapshot.students.portalActive} portal accounts active`,
          },
          {
            title:
              'Timetable readiness',
            value:
              String(
                snapshot.timetable.publishedSessions,
              ),
            detail:
              `${snapshot.timetable.activeAllocations} active allocations`,
          },
          {
            title:
              'Assessment readiness',
            value:
              `${snapshot.assessment.finalised}/${snapshot.assessment.total}`,
            detail:
              `${snapshot.assessment.published} published`,
          },
          {
            title:
              'Document readiness',
            value:
              `${snapshot.documents.activeTemplates}/4`,
            detail:
              `${snapshot.documents.approved} approved documents`,
          },
        ].map(
          (
            item,
          ) => (
            <div
              key={
                item.title
              }
              className="rounded-xl border border-border bg-white px-4 py-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {
                  item.title
                }
              </p>

              <p className="mt-1 text-xl font-bold text-text-primary">
                {
                  item.value
                }
              </p>

              <p className="mt-1 text-[10px] text-text-muted">
                {
                  item.detail
                }
              </p>
            </div>
          ),
        )}
      </section>
    </div>
  );
}
