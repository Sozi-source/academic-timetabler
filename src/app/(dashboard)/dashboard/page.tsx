import { ArrowRight, Clock3 } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { platformModules } from '@/config/modules';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function DashboardPage() {
  const profile = await requireHodAccess();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Department workspace"
        context={
          <Badge variant="institutional">
            {profile.departmentName || 'Department'}
          </Badge>
        }
      />

      <section aria-label="Modules" className="grid gap-4 md:grid-cols-2">
        {platformModules.map((module) => {
          const Icon = module.icon;
          const active = module.status === 'active';

          return (
            <Card key={module.key} className="group overflow-hidden">
              <div className="h-1 bg-institutional-yellow" aria-hidden="true" />
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold tracking-tight text-text-primary">
                          {module.title}
                        </h2>
                        <p className="mt-1 text-sm text-text-secondary">
                          {module.description}
                        </p>
                      </div>

                      {!active && (
                        <Badge variant="neutral">Coming soon</Badge>
                      )}
                    </div>

                    <div className="mt-5">
                      <Link
                        href={module.href}
                        className={active
                          ? 'inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-white transition hover:bg-primary-hover'
                          : 'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-text-secondary transition hover:border-primary hover:text-primary'}
                      >
                        {active ? 'Open' : 'View'}
                        {active ? (
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Clock3 className="size-3.5" aria-hidden="true" />
                        )}
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
