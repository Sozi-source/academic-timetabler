import type { Metadata } from 'next';

import {
  ProgrammeStageManagement,
} from '@/features/student-unit-registration/programme-stage-management';
import {
  getProgrammeStageSetups,
} from '@/features/student-unit-registration/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Programme Stages | Academic Management',
  description:
    'Manage programme stages and curriculum unit bindings used for student unit registration.',
};

export default async function ProgrammeStagesPage() {
  const setups = await getProgrammeStageSetups();

  return (
    <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      <ProgrammeStageManagement setups={setups} />
    </main>
  );
}