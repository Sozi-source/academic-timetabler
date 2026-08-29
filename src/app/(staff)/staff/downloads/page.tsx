import {
  CalendarDays,
  Download,
  FileCheck2,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

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
  getStaffWorkspace,
} from '@/features/staff-assessment/queries';

interface AssessmentDownloadLink {
  id: string;
  type: string;
  unit: string;
  cohort: string;
  href: string;
}

export default async function StaffDownloadsPage() {
  const profile =
    await requireTrainerAccess();

  const workspace =
    await getStaffWorkspace(
      profile.id,
    );

  const assessmentLinks:
    AssessmentDownloadLink[] =
      workspace.allocations.flatMap(
        (
          allocation,
        ) => {
          const links:
            AssessmentDownloadLink[] =
              [];

          if (
            allocation.cat
          ) {
            links.push({
              id:
                allocation.cat.assessmentId,
              type:
                'CAT',
              unit:
                allocation.unitName,
              cohort:
                allocation.cohortName,
              href:
                `/staff/units/${allocation.allocationId}/assessment/${allocation.cat.assessmentId}`,
            });
          }

          if (
            allocation.exam
          ) {
            links.push({
              id:
                allocation.exam.assessmentId,
              type:
                'Exam',
              unit:
                allocation.unitName,
              cohort:
                allocation.cohortName,
              href:
                `/staff/units/${allocation.allocationId}/assessment/${allocation.exam.assessmentId}`,
            });
          }

          return links;
        },
      );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="Downloads"
        description="Your printable files."
        icon={Download}
      />

      <section className="portal-card-grid">
        <Link
          href="/staff/timetable"
          className="rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                My Timetable
              </h2>

              <p className="mt-1 text-[11px] leading-5 text-text-muted">
                Published schedule.
              </p>
            </div>

            <CalendarDays
              className="size-4 text-text-muted"
              aria-hidden="true"
            />
          </div>
        </Link>

        <Link
          href="/staff/documents"
          className="rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Teaching Documents
              </h2>

              <p className="mt-1 text-[11px] leading-5 text-text-muted">
                Teaching records and templates.
              </p>
            </div>

            <FileText
              className="size-4 text-text-muted"
              aria-hidden="true"
            />
          </div>
        </Link>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Assessment files
            </h2>

            <p className="mt-1 text-[11px] text-text-muted">
              Markbooks and signing
              sheets are generated from
              the assessment workspace.
            </p>
          </div>

          <Badge variant="neutral">
            {
              assessmentLinks.length
            }
          </Badge>
        </div>

        {assessmentLinks.length === 0 ? (
          <div className="rounded-xl border border-border bg-white px-4 py-10 text-center">
            <FileSpreadsheet className="mx-auto size-7 text-text-muted" aria-hidden="true" />
            <p className="mt-2 text-xs font-bold text-text-primary">
              No assessment files yet
            </p>
            <p className="mt-1 text-[11px] text-text-muted">
              Markbooks and signing sheets will appear once assessment rules are configured for your units.
            </p>
          </div>
        ) : (
          assessmentLinks.map(
            (
              item,
            ) => (
              <Link
                key={
                  item.id
                }
                href={
                  item.href
                }
                className="block rounded-lg border border-border bg-white px-3.5 py-3 transition hover:border-border-strong hover:bg-surface-subtle/40"
              >
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {
                        item.unit
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {
                        item.cohort
                      }
                      {' · '}
                      {
                        item.type
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                    <FileCheck2
                      className="size-3"
                      aria-hidden="true"
                    />
                    Open
                  </div>
                </div>
              </Link>
            ),
          )
        )}
      </section>
    </div>
  );
}
