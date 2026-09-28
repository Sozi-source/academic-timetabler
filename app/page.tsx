import { redirect } from 'next/navigation';
import { getAuthenticatedProfile } from '@/features/auth/queries';

export default async function HomePage() {
  const profile = await getAuthenticatedProfile();

  if (!profile) {
    redirect('/login');
  }

  if (profile.role === 'trainer') {
    redirect('/staff');
  }

  redirect('/dashboard');
}