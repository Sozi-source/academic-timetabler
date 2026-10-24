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
    <nav aria-label="Trainer portal" className="flex gap-2 lg:w-fit lg:gap-1 lg:overflow-x-auto">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition lg:min-h-10 lg:flex-none lg:rounded-lg',
              active
                ? 'bg-primary text-white shadow-sm'
                : 'text-[#5a6e69] hover:bg-[#f3f0e8] hover:text-[#1c3a34]',
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
