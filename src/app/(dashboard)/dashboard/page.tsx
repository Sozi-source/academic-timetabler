import { ArrowRight, Clock3 } from 'lucide-react';
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
        {platformModules.map((module) => {
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
                      <h2 className="text-base font-semibold tracking-tight text-text-primary">
                        {module.title}
                      </h2>
                    </div>
                  </div>
                  <Badge variant={active ? 'success' : 'neutral'} dot>
                    {active ? 'Active' : 'Coming soon'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
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

    </div>
  );
}
