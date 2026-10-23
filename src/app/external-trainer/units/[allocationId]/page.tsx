import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ allocationId: string }>;
}

export default async function ExternalTrainerUnitPage({ params }: PageProps) {
  const { allocationId } = await params;
  redirect(`/external-trainer/units/${allocationId}/assessment/exam/marks`);
}
