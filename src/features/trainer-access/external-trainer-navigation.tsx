'use client';

import { BookOpenCheck, FileText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils/cn';

const items = [
  { href: '/external-trainer/units', label: 'My Units', icon: BookOpenCheck },
  { href: '/external-trainer/documents', label: 'Documents', icon: FileText },
] as const;

export function ExternalTrainerNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Trainer portal" className="flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition',
              active
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
