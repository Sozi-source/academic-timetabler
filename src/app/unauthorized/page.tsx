import {
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-7 text-center shadow-md sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-danger-surface text-danger">
          <ShieldAlert
            className="size-6"
            aria-hidden="true"
          />
        </div>

        <h1 className="mt-5 text-xl font-semibold text-text-primary">
          Access not authorized
        </h1>

        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Your account does not have permission to access
          this area of HND App.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-focus-ring/40"
        >
          <ArrowLeft
            className="size-4"
            aria-hidden="true"
          />
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}