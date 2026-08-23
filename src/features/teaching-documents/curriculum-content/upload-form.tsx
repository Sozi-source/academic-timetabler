'use client';

import {
  useActionState,
  useEffect,
} from 'react';
import {
  LoaderCircle,
  Upload,
  UserRoundCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import {
  stageCurriculumContentImportAction,
} from './actions';
import {
  initialCurriculumContentImportState,
} from './state';

export function CurriculumContentUploadForm() {
  const router = useRouter();

  const [
    state,
    action,
    pending,
  ] = useActionState(
    stageCurriculumContentImportAction,
    initialCurriculumContentImportState,
  );

  useEffect(() => {
    if (
      state.status === 'success' &&
      state.batchId
    ) {
      router.push(
        `/teaching-documents/curriculum/import/${state.batchId}`,
      );
    }
  }, [
    router,
    state.status,
    state.batchId,
  ]);

  const details = [
    ...new Set(
      state.details ?? [],
    ),
  ];

  return (
    <form
      action={action}
      className="space-y-4"
    >
      {state.message ? (
        <FormStatusMessage
          status={
            state.status ===
            'success'
              ? 'success'
              : 'error'
          }
          message={state.message}
        />
      ) : null}

      {details.length ? (
        <div className="rounded-xl border border-danger-border bg-danger-surface p-4 text-sm text-danger">
          {details.map(
            (item, index) => (
              <div
                key={`${index}-${item}`}
              >
                {item}
              </div>
            ),
          )}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-text-primary">
              Curriculum import
            </h2>

            <p className="mt-1 text-sm text-text-muted">
              Bulk or legacy workbook import for administrators.
            </p>
          </div>

          <Link
            href="/staff/teaching-documents"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-white px-3.5 text-sm font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            <UserRoundCheck className="size-4" />
            My teaching documents
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-text-primary">
          Upload workbook
        </h2>

        <p className="mt-1 text-sm text-text-muted">
          Upload an existing curriculum workbook. Mapping and review happen after upload.
        </p>

        <input
          name="workbook"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          disabled={pending}
          className="mt-4 block w-full text-sm text-text-muted"
        />
      </section>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          disabled={pending}
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}

          {pending
            ? 'Staging'
            : 'Upload and review'}
        </Button>
      </div>
    </form>
  );
}
