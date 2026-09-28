import { ArrowLeft, Clock3, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

interface ModuleComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  capabilities: readonly string[];
}

export function ModuleComingSoon({ title, icon: Icon }: ModuleComingSoonProps) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} />

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/5 text-primary ring-1 ring-primary/10">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">Coming soon</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted"><Clock3 className="size-3.5" />Planned</p>
            </div>
          </div>

          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ArrowLeft className="size-3.5" />Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
