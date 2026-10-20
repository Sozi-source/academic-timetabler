import type { Metadata } from 'next';

import { TrainerMarkEntryPortal } from '@/features/assessment/trainer-mark-entry-portal';

export const metadata: Metadata = {
  title: 'Trainer Mark Entry',
  description: 'Enter marks for an assigned unit markbook.',
  referrer: 'no-referrer',
};

export default function TrainerMarkEntryPage() {
  return <TrainerMarkEntryPortal />;
}
