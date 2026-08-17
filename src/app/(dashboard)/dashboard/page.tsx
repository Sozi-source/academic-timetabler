import { ArrowRight, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { platformModules } from '@/config/modules';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function DashboardPage() {
  const profile = await requireHodAccess();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academic operations platform"
        title="Department workspace"
        description="Choose a module."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="institutional">
              {profile.departmentName || 'Department workspace'}
            </Badge>
            <Badge variant="success" dot>
              Authenticated
            </Badge>
          </div>
        }
      />

      <section aria-label="Platform modules" className="grid gap-4 md:grid-cols-2">
        {platformModules.map((module, index) => {
          const Icon = module.icon;
          const active = module.status === 'active';

          return (
            <Card key={module.key} className="group">
              <div className="absolute inset-x-0 top-0 h-1 bg-institutional-yellow" aria-hidden="true" />
              <CardHeader className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white ring-2 ring-institutional-yellow/70 ring-offset-2 ring-offset-surface">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary">
                        Module {String(index + 1).padStart(2, '0')}
                      </p>
                      <h2 className="mt-1 text-base font-semibold tracking-tight text-text-primary">
                        {module.title}
                      </h2>
                    </div>
                  </div>
                  <Badge variant={active ? 'success' : 'neutral'} dot>
                    {active ? 'Active' : 'Coming soon'}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-text-secondary">{module.description}</p>
              </CardHeader>

              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {module.capabilities.map((capability) => (
                    <div key={capability} className="flex items-center gap-2 text-xs text-text-secondary">
                      <CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{capability}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-border-soft pt-3">
                  <Link
                    href={module.href}
                    className={active
                      ? 'inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-white transition hover:bg-primary-hover'
                      : 'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-text-secondary transition hover:border-primary hover:text-primary'}
                  >
                    {active ? 'Open module' : 'View module'}
                    {active ? <ArrowRight className="size-3.5" aria-hidden="true" /> : <Clock3 className="size-3.5" aria-hidden="true" />}
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 shadow-sm">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Shared academic records</h2>
          <p className="mt-0.5 text-xs text-text-secondary">All modules use the same verified data.</p>
        </div>
      </section>
    </div>
  );
}
