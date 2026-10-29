import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ assessmentId: string }>;
}

export default async function AssessmentPopulationPage({ params }: PageProps) {
  const { assessmentId } = await params;
  redirect(`/assessment/marks/${assessmentId}`);
}
