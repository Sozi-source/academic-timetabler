'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import {
  Check,
  ChevronsUpDown,
  Search,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';

import { cn } from '@/lib/utils/cn';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  name?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options',
  emptyMessage = 'No matching options.',
  disabled = false,
  name,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = options.find(
    (option) => option.value === value,
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery =
      query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      `${option.label} ${option.description ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [options, query]);

  return (
    <>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value ?? ''}
        />
      ) : null}

      <PopoverPrimitive.Root
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverPrimitive.Trigger
          disabled={disabled}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-border-strong bg-surface px-3.5 text-sm shadow-[var(--shadow-sm)] outline-none transition',
            'hover:border-focus-border',
            'focus-visible:border-focus-border focus-visible:ring-4 focus-visible:ring-focus-ring/25',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted',
          )}
        >
          <span
            className={cn(
              'truncate',
              selectedOption
                ? 'text-text-primary'
                : 'text-text-subtle',
            )}
          >
            {selectedOption?.label ?? placeholder}
          </span>

          <ChevronsUpDown
            className="size-4 shrink-0 text-text-muted"
            aria-hidden="true"
          />
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={6}
            className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-md)]"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search
                className="size-4 text-text-muted"
                aria-hidden="true"
              />

              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder={searchPlaceholder}
                className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-subtle"
              />
            </div>

            <div className="max-h-64 overflow-y-auto p-1.5">
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-text-muted">
                  {emptyMessage}
                </p>
              ) : (
                filteredOptions.map((option) => {
                  const selected =
                    option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => {
                        onValueChange(option.value);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={cn(
                        'flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition',
                        'hover:bg-navigation-hover',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        selected &&
                          'bg-navigation-active text-navigation-active-text',
                      )}
                    >
                      <Check
                        className={cn(
                          'size-4 shrink-0',
                          selected
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                        aria-hidden="true"
                      />

                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {option.label}
                        </span>

                        {option.description ? (
                          <span className="mt-0.5 block truncate text-xs text-text-muted">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}