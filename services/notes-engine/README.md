# Python Notes Consolidation Service

This is the backend processing service for the unit-agnostic unified lecture-notes engine.

## Responsibilities

- Reads every Ready source for a unit from Supabase.
- Supports PDF, DOCX, TXT/Markdown and ZIP source containers.
- ZIP archives may contain nested folders and multiple supported files.
- Consolidates complete source text deterministically.
- Removes exact duplicate passages only.
- Retains materially different content.
- Generates DOCX and PDF outputs with Python.
- Stores outputs in Supabase Storage.
- Writes job status, metrics and preview content back to `lecture_note_jobs`.

Gemini is not used by this service.

## Runtime

The service has two processes:

1. API: `uvicorn app.main:app --host 0.0.0.0 --port 8080`
2. Worker: `python -m app.worker`

Run the API and worker as separate services/containers using the same image and environment variables.
The worker uses the Supabase/Postgres job table as the durable queue and claims jobs with `FOR UPDATE SKIP LOCKED`.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTES_ENGINE_TOKEN`

The Next.js application uses:

- `LECTURE_NOTES_ENGINE_URL`
- `LECTURE_NOTES_ENGINE_TOKEN`

Never expose the Supabase service-role key or notes-engine token to the browser.
