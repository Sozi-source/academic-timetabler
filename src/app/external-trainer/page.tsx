import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'External Trainer Portal',
  description: 'Marks entry and signing sheets for allocated teaching units.',
};

export default function ExternalTrainerPortalPage() {
  redirect('/external-trainer/units');
}
