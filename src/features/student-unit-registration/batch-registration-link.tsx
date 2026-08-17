import Link from 'next/link';

export function BatchRegistrationLink() {
  return (
    <Link
      href="/students/unit-registration/batch"
      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      Batch registration
    </Link>
  );
}