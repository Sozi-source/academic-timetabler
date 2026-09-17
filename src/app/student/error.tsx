'use client';

import { useEffect } from 'react';
import { AlertTriangle, GraduationCap, RefreshCw, KeyRound, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StudentPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Student portal error caught:', error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-institutional-yellow" aria-hidden="true" />

      <section className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex h-12 items-center gap-2.5 border-b border-primary/20 bg-institutional-yellow px-5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary-deeper text-white shadow-2xs">
            <GraduationCap className="size-4" aria-hidden="true" />
          </span>
          <p className="truncate text-xs font-bold tracking-tight text-primary-deeper">
            Student Portal
          </p>
        </div>

        <div className="p-6 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-bold tracking-tight text-text-primary">
              Portal Access Issue
            </h1>
            <p className="text-xs text-text-muted">
              We encountered an issue loading your student portal session. Please try reloading or signing in again.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              onClick={reset}
              className="w-full h-10 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-hover transition"
            >
              <RefreshCw className="mr-2 size-3.5" />
              Try again
            </Button>

            <Button
              variant="outline"
              asChild
              className="w-full h-10 rounded-lg text-xs font-semibold"
            >
              <Link href="/student/login">
                <KeyRound className="mr-2 size-3.5" />
                Return to Student Sign In
              </Link>
            </Button>

            <div className="pt-2 text-center border-t border-border">
              <Link
                href="/student/activate"
                className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text-primary transition"
              >
                Need to activate your account? <span className="font-bold text-primary inline-flex items-center">Activate <ArrowRight className="ml-0.5 size-3" /></span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
