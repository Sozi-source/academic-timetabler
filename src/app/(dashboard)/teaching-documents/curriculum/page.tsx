import {
  ArrowLeft,
  BookOpenCheck,
  Download,
  Upload,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function CurriculumContentPage() {
  await requireHodAccess();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Teaching documents"
        title="Curriculum Content"
        icon={BookOpenCheck}
        actions={
          <Link
            href="/teaching-documents"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Teaching documents
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <a
          href="/api/teaching-documents/curriculum/templates/course-outline"
          className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Download className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Course Outline template</h2>
            <p className="text-xs text-text-muted">Excel (.xlsx)</p>
          </div>
        </a>

        <a
          href="/api/teaching-documents/curriculum/templates/scheme-of-work"
          className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Download className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Scheme of Work template</h2>
            <p className="text-xs text-text-muted">Excel (.xlsx)</p>
          </div>
        </a>
      </section>

      <Link
        href="/teaching-documents/curriculum/import"
        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
      >
        <div className="flex items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Upload className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Import curriculum</h2>
            <p className="text-xs text-text-muted">Upload .xlsx, .docx, or .zip</p>
          </div>
        </div>
        <span className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-hover">
          Upload
        </span>
      </Link>
    </div>
  );
}

