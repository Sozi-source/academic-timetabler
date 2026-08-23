import type { Metadata } from 'next';
import { UnifiedLoginCard } from '@/features/auth/unified-login-card';

export const metadata: Metadata = {
  title: 'Sign in | Academic Planning System',
  description: 'Sign in to the Academic Planning System.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; role?: string }>;
}) {
  const parameters = await searchParams;
  const nextPath = typeof parameters.next === 'string' ? parameters.next : undefined;
  const defaultRole = parameters.role === 'student' ? 'student' : 'staff';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-institutional-yellow" aria-hidden="true" />
      <UnifiedLoginCard defaultRole={defaultRole} nextPath={nextPath} />
    </main>
  );
}