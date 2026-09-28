'use client';

import {
  Search,
  X,
} from 'lucide-react';
import type {
  ChangeEvent,
} from 'react';

import { Input } from './input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search records',
  label = 'Search',
  disabled = false,
  className,
}: SearchBarProps) {
  function handleChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    onChange(event.target.value);
  }

  return (
    <div className={className}>
      <label
        htmlFor="table-search"
        className="sr-only"
      >
        {label}
      </label>

      <Input
        id="table-search"
        type="search"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        leadingContent={
          <Search
            className="size-4"
            aria-hidden="true"
          />
        }
        trailingContent={
          value ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onChange('');
              }}
              className="pointer-events-auto flex size-7 items-center justify-center rounded-md transition hover:bg-navigation-hover hover:text-text-primary"
            >
              <X
                className="size-3.5"
                aria-hidden="true"
              />
            </button>
          ) : null
        }
      />
    </div>
  );
}