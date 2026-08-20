import { ArrowLeft, CheckCircle2, Clock3, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

interface ModuleComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  capabilities: readonly string[];
}

export function ModuleComingSoon({ title, description, icon: Icon, capabilities }: ModuleComingSoonProps) {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Coming soon"
        title={title}
        description={description}
        context={<Badge variant="neutral">Coming soon</Badge>}
      />

      <Card>
        <div className="h-1 bg-institutional-yellow" aria-hidden="true" />
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white ring-2 ring-institutional-yellow/70 ring-offset-2 ring-offset-surface">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-primary">Coming soon</h2>
              </div>
              <p className="mt-1 text-xs text-text-secondary">Module setup is ready.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((capability) => (
              <div key={capability} className="flex min-h-10 items-center gap-2 rounded-lg border border-border-soft bg-surface-subtle px-3 text-xs font-medium text-text-secondary">
                <CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                {capability}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border-soft pt-3">
            <div className="flex items-center gap-2 text-xs text-text-muted"><Clock3 className="size-3.5" />Planned</div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-3.5" />Dashboard</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
