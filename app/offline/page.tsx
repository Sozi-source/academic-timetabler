import Image from 'next/image';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7faf9] p-5 text-[#17211f]">
      <section className="w-full max-w-sm rounded-2xl border border-[#dce6e3] bg-white p-6 text-center shadow-sm">
        <Image
          src="/icons/icon-192.png"
          alt="Imperial College Trainer Portal"
          width={64}
          height={64}
          className="mx-auto rounded-2xl"
          priority
        />
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#66736f]">
          Trainer Portal
        </p>
        <h1 className="mt-1 text-xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-[#66736f]">
          Reconnect to access your current timetable and teaching records.
        </p>
        <Link
          href="/staff"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#075b52] px-5 text-sm font-semibold text-white"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
