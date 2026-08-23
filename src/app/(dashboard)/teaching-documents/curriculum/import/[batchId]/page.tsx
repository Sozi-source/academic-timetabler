import {
  notFound,
} from 'next/navigation';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';
import {
  Button,
} from '@/components/ui/button';
import {
  confirmCurriculumContentImportAction,
  updateCurriculumV5UnitMappingAction,
} from '@/features/teaching-documents/curriculum-content/actions';
import type {
  CurriculumImportBatchPayloadV5,
} from '@/features/teaching-documents/curriculum-import-v5/schema';

type PageProps = {
  params: Promise<{
    batchId: string;
  }>;
};

function badgeClass(
  kind:
    | 'ready'
    | 'review'
    | 'warning',
) {
  if (kind === 'ready') {
    return 'bg-success-surface text-success border-success-border';
  }

  if (kind === 'warning') {
    return 'bg-warning-surface text-warning border-warning-border';
  }

  return 'bg-danger-surface text-danger border-danger-border';
}

export default async function CurriculumImportReviewPage(
  props: PageProps,
) {
  const {
    batchId,
  } = await props.params;

  await requireHodAccess();

  const supabase =
    await createClient();

  const {
    data: batch,
  } = await supabase
    .from(
      'curriculum_content_import_batches',
    )
    .select(
      'id,original_file_name,status,payload,validation_summary,created_at',
    )
    .eq('id', batchId)
    .maybeSingle();

  if (
    !batch ||
    !batch.payload ||
    Number(
      batch.payload.engineVersion,
    ) !== 5
  ) {
    notFound();
  }

  const payload =
    batch.payload as CurriculumImportBatchPayloadV5;

  const {
    data: systemUnits,
  } = await supabase
    .from('units')
    .select('id,code,name')
    .eq('is_active', true)
    .order('code');

  const unresolved =
    payload.units.filter(
      (unit) =>
        !unit.matchedUnitId,
    );

  const reviewIssues =
    payload.issues.filter(
      (issue) =>
        issue.severity ===
        'review',
    );

  const warnings =
    payload.issues.filter(
      (issue) =>
        issue.severity ===
        'warning',
    );

  const contentRows =
    payload.content.filter(
      (item) =>
        !item.excludedAsCalendarActivity,
    );

  const isImported =
    String(batch.status) ===
    'imported';

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-primary">
          Curriculum Import V5
        </p>

        <h1 className="mt-1 text-2xl font-semibold text-text-primary">
          Review import
        </h1>

        <p className="mt-1 text-sm text-text-muted">
          {batch.original_file_name}
        </p>

        <p className="mt-2 text-sm text-text-muted">
          Review items do not block import. You can import now and resolve mappings later.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            'Units',
            payload.units.length,
          ],
          [
            'Matched',
            payload.units.length -
              unresolved.length,
          ],
          [
            'Content rows',
            contentRows.length,
          ],
          [
            'Review items',
            reviewIssues.length,
          ],
        ].map(
          ([label, value]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="text-sm text-text-muted">
                {label}
              </div>

              <div className="mt-1 text-2xl font-semibold text-text-primary">
                {value}
              </div>
            </div>
          ),
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-text-primary">
            Unit mapping
          </h2>

          <p className="mt-1 text-sm text-text-muted">
            Fix only unresolved mappings. Successful matches are retained.
          </p>
        </div>

        <div className="divide-y divide-border">
          {payload.units.map(
            (unit) => {
              const unitIssues =
                payload.issues.filter(
                  (issue) =>
                    issue.sourceUnitKey ===
                    unit.sourceUnitKey,
                );

              return (
                <div
                  key={
                    unit.sourceUnitKey
                  }
                  className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1fr]"
                >
                  <div>
                    <div className="font-medium text-text-primary">
                      {unit.sourceUnitCode ||
                        'No code'}{' '}
                      —{' '}
                      {unit.sourceUnitName ||
                        'Unnamed unit'}
                    </div>

                    <div className="mt-1 text-xs text-text-muted">
                      {
                        unit.matchMethod
                      }
                    </div>

                    {unitIssues.length ? (
                      <div className="mt-2 space-y-1">
                        {unitIssues.map(
                          (issue) => (
                            <div
                              key={
                                issue.id
                              }
                              className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${badgeClass(
                                issue.severity ===
                                  'warning'
                                  ? 'warning'
                                  : 'review',
                              )}`}
                            >
                              {
                                issue.message
                              }
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    {unit.matchedUnitId ? (
                      <div
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass(
                          'ready',
                        )}`}
                      >
                        {
                          unit.matchedUnitCode
                        }{' '}
                        —{' '}
                        {
                          unit.matchedUnitName
                        }
                      </div>
                    ) : (
                      <form
                        action={
                          updateCurriculumV5UnitMappingAction
                        }
                        className="flex gap-2"
                      >
                        <input
                          type="hidden"
                          name="batchId"
                          value={
                            batchId
                          }
                        />

                        <input
                          type="hidden"
                          name="sourceUnitKey"
                          value={
                            unit.sourceUnitKey
                          }
                        />

                        <select
                          name="targetUnitId"
                          required
                          className="min-w-0 flex-1 rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
                        >
                          <option value="">
                            Select system unit
                          </option>

                          {(
                            systemUnits ??
                            []
                          ).map(
                            (
                              option,
                            ) => (
                              <option
                                key={
                                  option.id
                                }
                                value={
                                  option.id
                                }
                              >
                                {
                                  option.code
                                }{' '}
                                —{' '}
                                {
                                  option.name
                                }
                              </option>
                            ),
                          )}
                        </select>

                        <Button
                          type="submit"
                          variant="outline"
                        >
                          Map
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </section>

      {warnings.length ? (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-text-primary">
            Warnings
          </h2>

          <div className="mt-3 space-y-2 text-sm text-text-secondary">
            {warnings.map(
              (warning) => (
                <div
                  key={
                    warning.id
                  }
                >
                  {
                    warning.message
                  }
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      <div className="flex justify-end">
        {isImported ? (
          <div
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${badgeClass(
              'ready',
            )}`}
          >
            Imported
          </div>
        ) : (
          <form
            action={
              confirmCurriculumContentImportAction
            }
          >
            <input
              type="hidden"
              name="batchId"
              value={batchId}
            />

            <Button
              type="submit"
              size="lg"
            >
              {unresolved.length > 0
                ? 'Import with review items'
                : 'Import curriculum'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
