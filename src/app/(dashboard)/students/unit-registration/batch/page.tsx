import { getCohortStageSetups } from '@/features/student-unit-registration/cohort-stage-queries';
import type { Metadata } from 'next';

import { BatchUnitRegistration } from '@/features/student-unit-registration/batch-unit-registration';
import { getBatchRegistrationContext } from '@/features/student-unit-registration/batch-queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Batch Unit Registration | Academic Management',
  description:
    'Register expected units for selected students or an entire cohort.',
};

interface BatchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(
  value: string | string[] | undefined,
): number {
  const parsed = Number(first(value) ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function BatchUnitRegistrationPage({
  searchParams,
}: BatchPageProps) {
  const [context, cohortStageSetups, params] = await Promise.all([
    getBatchRegistrationContext(),
    getCohortStageSetups(),
    searchParams,
  ]);

  const success = first(params.success) === '1';

  const summary = success
    ? {
        selected: numberParam(params.selected),
        eligible: numberParam(params.eligible),
        created: numberParam(params.created),
        skipped: numberParam(params.skipped),
        attention: numberParam(params.attention),
      }
    : null;

  const error = first(params.error) ?? null;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      <BatchUnitRegistration
        context={context}
        summary={summary}
        error={error}
              cohortStageSetups={cohortStageSetups}
/>
    </main>
  );
}