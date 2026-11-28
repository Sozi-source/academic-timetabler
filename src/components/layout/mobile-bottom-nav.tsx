'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export interface MobileBottomNavItem {
  /** Short label — bottom bars only have room for one word or two. */
  label: string;
  icon: LucideIcon;
  /** Provide href for a navigation tab, or onClick for an action tab (e.g. "More"). */
  href?: string;
  onClick?: () => void;
  /** The calling shell already knows its own active-route rules — pass the result in. */
  isActive?: boolean;
}

interface MobileBottomNavProps {
  items: MobileBottomNavItem[];
  /** Tailwind text-color class applied to the active tab. Defaults to the app teal. */
  activeClassName?: string;
  className?: string;
}

/**
 * A native Android/iOS bottom tab bar: fixed to the viewport bottom, safe-area
 * aware, capped visually at five evenly-spaced tabs. Used on small/medium
 * screens where a slide-out drawer is the wrong pattern; the existing
 * desktop sidebars keep doing their job at `lg:` and above.
 */
export function MobileBottomNav({
  items,
  activeClassName = 'text-[#0b4f4a]',
  className,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Quick navigation"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] shadow-[0_-4px_16px_rgb(15,23,42,0.06)] backdrop-blur-lg lg:hidden print:hidden',
        className,
      )}
    >
      <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              {item.isActive ? (
                <span aria-hidden="true" className="absolute top-0 h-0.5 w-6 rounded-full bg-current" />
              ) : null}
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="block w-full max-w-full truncate text-center leading-tight">{item.label}</span>
            </>
          );

          const tabClassName = cn(
            'relative flex min-h-12 min-w-0 w-full flex-col items-center justify-center gap-0.5 overflow-hidden px-1 py-1.5 text-[10px] leading-tight transition active:bg-gray-50',
            item.isActive ? cn('font-bold', activeClassName) : 'font-medium text-slate-600 hover:text-slate-900',
          );

          if (item.href) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={tabClassName}
                aria-current={item.isActive ? 'page' : undefined}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={tabClassName}
              aria-current={item.isActive ? 'page' : undefined}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
