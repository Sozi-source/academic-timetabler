'use client';

import {
  FileUp,
  X,
} from 'lucide-react';
import {
  useId,
  useState,
  type ChangeEvent,
} from 'react';

import { cn } from '@/lib/utils/cn';

interface FileUploadProps {
  name: string;
  label?: string;
  description?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  maxSizeMb?: number;
  onFilesChange?: (files: File[]) => void;
  className?: string;
}

export function FileUpload({
  name,
  label = 'Upload files',
  description = 'Select files from your device.',
  accept,
  multiple = false,
  required = false,
  disabled = false,
  maxSizeMb = 10,
  onFilesChange,
  className,
}: FileUploadProps) {
  const id = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    );

    const oversized = selectedFiles.find(
      (file) =>
        file.size >
        maxSizeMb * 1024 * 1024,
    );

    if (oversized) {
      setError(
        `${oversized.name} exceeds the ${maxSizeMb} MB limit.`,
      );
      event.target.value = '';
      setFiles([]);
      onFilesChange?.([]);
      return;
    }

    setError(null);
    setFiles(selectedFiles);
    onFilesChange?.(selectedFiles);
  }

  function clearFiles() {
    setFiles([]);
    setError(null);
    onFilesChange?.([]);
  }

  return (
    <div className={cn('space-y-3', className)}>
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface-subtle px-6 py-8 text-center transition',
          'hover:border-focus-border hover:bg-primary-subtle',
          disabled &&
            'cursor-not-allowed opacity-60',
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-surface text-primary shadow-sm">
          <FileUp
            className="size-5"
            aria-hidden="true"
          />
        </span>

        <span className="mt-3 text-sm font-semibold text-text-primary">
          {label}
        </span>

        <span className="mt-1 text-xs leading-5 text-text-muted">
          {description}
        </span>

        <span className="mt-1 text-[0.6875rem] text-text-subtle">
          Maximum {maxSizeMb} MB per file
        </span>
      </label>

      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        required={required}
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />

      {error ? (
        <p
          role="alert"
          className="text-xs font-medium text-danger"
        >
          {error}
        </p>
      ) : null}

      {files.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
            <p className="text-xs font-semibold text-text-secondary">
              {files.length} file
              {files.length === 1 ? '' : 's'} selected
            </p>

            <button
              type="button"
              onClick={clearFiles}
              className="flex size-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-subtle hover:text-danger"
            >
              <X
                className="size-4"
                aria-hidden="true"
              />
              <span className="sr-only">
                Clear files
              </span>
            </button>
          </div>

          <ul className="divide-y divide-border-soft">
            {files.map((file) => (
              <li
                key={`${file.name}-${file.size}`}
                className="px-4 py-3 text-sm text-text-secondary"
              >
                {file.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}