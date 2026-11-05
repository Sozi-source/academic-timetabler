'use client';

import { usePathname } from 'next/navigation';

import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/breadcrumb';
import { dashboardNavigation } from '@/config/navigation';

const ID_SEGMENT =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

const knownLabels = new Map<string, string>(
  dashboardNavigation.flatMap((group) =>
    group.items.map((item) => [item.href, item.label] as const),
  ),
);

// Segments whose own URL has no page, or whose nav label is too long
// for a trail. Add entries here when a crumb reads badly.
const segmentLabels: Record<string, string> = {
  students: 'Students',
  trainers: 'Staff & Trainers',
  timetable: 'Timetabling',
  assessment: 'Assessment',
  'teaching-documents': 'Teaching documents',
  'attendance-clinical': 'Attendance & clinical',
  operations: 'Operations',
};

function titleCase(segment: string) {
  const text = segment.replace(/[-_]+/g, ' ');

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Builds a breadcrumb from the current URL so every admin page gets one
 * without each page declaring it. A page that needs different wording can
 * still pass `breadcrumbs` to PageHeader and skip this by not using the shell.
 */
export function AutoBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Nothing useful to show on top-level pages such as /dashboard.
  if (segments.length < 2) {
    return null;
  }

  const items: BreadcrumbItem[] = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;

    const label = ID_SEGMENT.test(segment)
      ? 'Details'
      : (knownLabels.get(href) ??
        segmentLabels[segment] ??
        titleCase(segment));

    return { label, href };
  });

  return <Breadcrumb items={items} className={className} />;
}
