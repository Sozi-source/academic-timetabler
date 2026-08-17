import type { Metadata } from 'next';

import { StageProgressionManager } from '@/features/student-stage-progression/stage-progression-manager';
import { getStageProgressionContext } from '@/features/student-stage-progression/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lifecycle Progression | Student Management',
  description:
    'Review and progress selected students to their next programme stage.',
};

interface LifecycleProgressionPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(value: string | string[] | undefined) {
  const parsed = Number(first(value) ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function LifecycleProgressionPage({
  searchParams,
}: LifecycleProgressionPageProps) {
  const [context, params] = await Promise.all([
    getStageProgressionContext(),
    searchParams,
  ]);

  const summary =
    first(params.success) === '1'
      ? {
          requested: numberParam(params.requested),
          progressed: numberParam(params.progressed),
          skipped: numberParam(params.skipped),
        }
      : null;

  const error = first(params.error) ?? null;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      <StageProgressionManager
        context={context}
        summary={summary}
        error={error}
      />
    </main>
  );
}
