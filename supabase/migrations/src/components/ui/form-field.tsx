import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

interface FormFieldProps {
  id: string;
  label: string;
  children: ReactNode;
  description?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
}

export function FormField({
  id,
  label,
  children,
  description,
  error,
  required = false,
  optional = false,
  className,
}: FormFieldProps) {
  const descriptionId = description
    ? `${id}-description`
    : undefined;

  const errorId = error
    ? `${id}-error`
    : undefined;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text-primary"
        >
          {label}

          {required ? (
            <>
              <span
                className="ml-1 text-danger"
                aria-hidden="true"
              >
                *
              </span>

              <span className="sr-only">
                Required
              </span>
            </>
          ) : null}
        </label>

        {optional ? (
          <span className="text-xs text-text-muted">
            Optional
          </span>
        ) : null}
      </div>

      {children}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-danger"
        >
          {error}
        </p>
      ) : description ? (
        <p
          id={descriptionId}
          className="text-xs leading-5 text-text-muted"
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function getFormFieldDescriptionId(
  id: string,
  options: {
    hasDescription?: boolean;
    hasError?: boolean;
  },
) {
  if (options.hasError) {
    return `${id}-error`;
  }

  if (options.hasDescription) {
    return `${id}-description`;
  }

  return undefined;
}