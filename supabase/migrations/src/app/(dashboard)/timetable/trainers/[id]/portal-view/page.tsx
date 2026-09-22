import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function TimetableTrainerPortalViewAliasPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { tab = 'units' } = await searchParams;

  redirect(`/trainers/${id}/portal-view?tab=${tab}`);
}
