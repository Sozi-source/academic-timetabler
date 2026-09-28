'use client';

import {
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect?: () => void;
  content?: ReactNode;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  label?: string;
}

export function ActionMenu({
  items,
  label = 'Open actions',
}: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
        >
          <MoreHorizontal
            className="size-4"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {items.map((item, index) => {
          const Icon = item.icon;

          return (
            <div key={`${item.label}-${index}`}>
              {item.separatorBefore ? (
                <DropdownMenuSeparator />
              ) : null}

              <DropdownMenuItem
                disabled={item.disabled}
                destructive={item.destructive}
                onSelect={item.onSelect}
              >
                {Icon ? (
                  <Icon
                    className="size-4"
                    aria-hidden="true"
                  />
                ) : null}

                {item.content ?? item.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}