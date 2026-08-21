'use client';

import {
  CheckCircle2,
  Download,
  FileUp,
  LoaderCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  type FormEvent,
  useState,
} from 'react';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';
import {
  Input,
} from '@/components/ui/input';

import {
  formatTeachingDocumentFileSize,
  shortTeachingDocumentHash,
  teachingDocumentLabel,
  teachingTemplateMaximumBytes,
  type TeachingDocumentType,
} from './domain';
import type {
  TeachingDocumentTemplateSummary,
} from './types';

function statusVariant(
  status:
    TeachingDocumentTemplateSummary['status'],
) {
  if (
    status ===
    'active'
  ) {
    return 'success' as const;
  }

  if (
    status ===
    'draft'
  ) {
    return 'institutional' as const;
  }

  return 'neutral' as const;
}

export function TeachingDocumentTemplateManager({
  documentType,
  templates,
}: {
  documentType:
    TeachingDocumentType;
  templates:
    TeachingDocumentTemplateSummary[];
}) {
  const router =
    useRouter();

  const [
    busy,
    setBusy,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  async function upload(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(
      null,
    );

    setMessage(
      null,
    );

    const form =
      event.currentTarget;

    const formData =
      new FormData(
        form,
      );

    formData.set(
      'documentType',
      documentType,
    );

    const file =
      formData.get(
        'file',
      );

    if (
      !(
        file instanceof
        File
      ) ||
      file.size ===
        0
    ) {
      setError(
        'Choose an official template file.',
      );
      return;
    }

    if (
      file.size >
      teachingTemplateMaximumBytes
    ) {
      setError(
        'The template file must be 15 MB or smaller.',
      );
      return;
    }

    setBusy(
      'upload',
    );

    try {
      const response =
        await fetch(
          '/api/teaching-documents/templates',
          {
            method:
              'POST',
            body:
              formData,
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (!response.ok) {
        setError(
          payload?.message ??
          'Template could not be uploaded.',
        );
        return;
      }

      form.reset();

      setMessage(
        `Draft v${payload?.template?.versionNumber ?? ''} uploaded. Activate it when verified.`,
      );

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function lifecycle(
    templateId:
      string,
    action:
      'activate'
      | 'retire',
  ) {
    setError(
      null,
    );

    setMessage(
      null,
    );

    setBusy(
      `${action}:${templateId}`,
    );

    try {
      const response =
        await fetch(
          `/api/teaching-documents/templates/${templateId}/${action}`,
          {
            method:
              'POST',
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (!response.ok) {
        setError(
          payload?.message ??
          'Template status could not be updated.',
        );
        return;
      }

      setMessage(
        action ===
          'activate'
          ? 'Template activated.'
          : 'Template retired.',
      );

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="border-b border-border px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              {teachingDocumentLabel(
                documentType,
              )}
            </h2>

            <p className="mt-1 text-[11px] text-text-muted">
              Official institutional template.
            </p>
          </div>

          <Badge
            variant={
              templates.some(
                (template) =>
                  template.status ===
                  'active',
              )
                ? 'success'
                : 'neutral'
            }
          >
            {templates.some(
              (template) =>
                template.status ===
                'active',
            )
              ? 'Active'
              : 'Not active'}
          </Badge>
        </div>

        <form
          onSubmit={
            upload
          }
          className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
        >
          <label className="text-[11px] font-semibold text-text-secondary">
            Template file
            <input
              name="file"
              type="file"
              accept=".docx,.xlsx,.pdf"
              required
              disabled={
                busy !==
                null
              }
              className="mt-1.5 block min-h-9 w-full rounded-xl border border-border-strong bg-white px-3 py-1.5 text-[11px] text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-subtle file:px-2.5 file:py-1 file:text-[10px] file:font-semibold file:text-text-secondary"
            />
          </label>

          <label className="text-[11px] font-semibold text-text-secondary">
            Name
            <Input
              name="name"
              defaultValue={`${teachingDocumentLabel(
                documentType,
              )} template`}
              disabled={
                busy !==
                null
              }
              className="mt-1.5"
            />
          </label>

          <Button
            type="submit"
            size="sm"
            disabled={
              busy !==
              null
            }
            leadingIcon={
              busy ===
              'upload' ? (
                <LoaderCircle
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <FileUp
                  className="size-3.5"
                  aria-hidden="true"
                />
              )
            }
          >
            Upload
          </Button>

          <label className="text-[11px] font-semibold text-text-secondary md:col-span-2">
            Note
            <Input
              name="notes"
              placeholder="Optional"
              disabled={
                busy !==
                null
              }
              className="mt-1.5"
            />
          </label>
        </form>

        {error ? (
          <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-danger">
            <XCircle
              className="mt-0.5 size-3 shrink-0"
              aria-hidden="true"
            />
            {
              error
            }
          </p>
        ) : null}

        {message ? (
          <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-success">
            <CheckCircle2
              className="mt-0.5 size-3 shrink-0"
              aria-hidden="true"
            />
            {
              message
            }
          </p>
        ) : null}
      </div>

      {templates.length ===
      0 ? (
        <p className="px-4 py-5 text-[11px] text-text-muted">
          No template versions uploaded.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {templates.map(
            (
              template,
            ) => (
              <article
                key={
                  template.id
                }
                className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1.2fr)_7rem_9rem_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {
                        template.originalFilename ??
                        template.name
                      }
                    </p>

                    <Badge
                      variant={
                        statusVariant(
                          template.status,
                        )
                      }
                    >
                      {
                        template.status
                      }
                    </Badge>
                  </div>

                  <p className="mt-1 text-[10px] text-text-muted">
                    SHA {
                      shortTeachingDocumentHash(
                        template.sha256,
                      )
                    }
                    {' · '}
                    {formatTeachingDocumentFileSize(
                      template.fileSizeBytes,
                    )}
                  </p>

                  {template.notes ? (
                    <p className="mt-1 text-[10px] leading-4 text-text-muted">
                      {
                        template.notes
                      }
                    </p>
                  ) : null}
                </div>

                <p className="text-[11px] font-semibold text-text-secondary">
                  v{
                    template.versionNumber
                  }
                </p>

                <a
                  href={`/api/teaching-documents/templates/${template.id}/download`}
                  className="inline-flex h-8 w-fit items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
                >
                  <Download
                    className="size-3"
                    aria-hidden="true"
                  />
                  Download
                </a>

                <div className="flex flex-wrap gap-1.5 lg:justify-end">
                  {template.status !==
                  'active' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        busy !==
                        null
                      }
                      onClick={() =>
                        void lifecycle(
                          template.id,
                          'activate',
                        )
                      }
                      leadingIcon={
                        busy ===
                        `activate:${template.id}` ? (
                          <LoaderCircle
                            className="size-3 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <RotateCcw
                            className="size-3"
                            aria-hidden="true"
                          />
                        )
                      }
                    >
                      Activate
                    </Button>
                  ) : null}

                  {template.status !==
                  'retired' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={
                        busy !==
                        null
                      }
                      onClick={() =>
                        void lifecycle(
                          template.id,
                          'retire',
                        )
                      }
                    >
                      Retire
                    </Button>
                  ) : null}
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}
