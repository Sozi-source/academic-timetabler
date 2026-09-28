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
        'fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_rgb(15,23,42,0.06)] backdrop-blur-lg lg:hidden',
        className,
      )}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon className="size-5" aria-hidden="true" />
              <span className="truncate px-1">{item.label}</span>
            </>
          );

          const tabClassName = cn(
            'flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition active:bg-gray-50',
            item.isActive ? activeClassName : 'text-gray-400',
          );

          if (item.href) {
            return (
              <Link key={item.href} href={item.href} className={tabClassName} aria-current={item.isActive ? 'page' : undefined}>
                {content}
              </Link>
            );
          }

          return (
            <button key={item.label} type="button" onClick={item.onClick} className={tabClassName}>
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
