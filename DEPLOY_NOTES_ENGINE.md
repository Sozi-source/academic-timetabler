# Python backend notes engine integration

This patch changes **Unified full unit** generation from an in-process Next.js operation to a dedicated Python backend service.

## 1. Database

Apply:

`supabase/migrations/20261003120000_python_notes_engine.sql`

This migration:
- permits `zip` source materials;
- adds `generation_engine`;
- adds durable result/status fields;
- adds an atomic PostgreSQL job-claim function for Python workers.

## 2. Deploy the Python service

The service lives at:

`services/notes-engine`

It has two processes that use the same image:

- Web/API: `uvicorn app.main:app --host 0.0.0.0 --port 8080`
- Worker: `python -m app.worker`

A Render example is included in `services/notes-engine/render.yaml`. Equivalent web + worker services can be created on another container platform.

Set these secrets on both services:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTES_ENGINE_TOKEN`

## 3. Configure the Next.js/Vercel application

Set:

- `LECTURE_NOTES_ENGINE_URL=https://<your-python-service-host>`
- `LECTURE_NOTES_ENGINE_TOKEN=<same secret as NOTES_ENGINE_TOKEN>`

These are server-side variables only. Do not prefix them with `NEXT_PUBLIC_`.

## 4. Workflow

1. Browser uploads PDF/DOCX/ZIP directly to Supabase Storage.
2. Next.js extracts and stores complete source text.
3. Embeddings are best-effort; a Gemini outage no longer blocks a source from becoming Ready.
4. Unified generation creates a `python` job in Supabase.
5. Python worker claims the job with `FOR UPDATE SKIP LOCKED`.
6. Python reads every Ready source for the unit in full.
7. ZIP containers are independently supported by the Python service as a fallback.
8. Exact duplicate passages are removed; materially different passages are retained.
9. Python generates DOCX + PDF and uploads them to Supabase Storage.
10. The Next.js UI polls the job status and exposes the finished files.

## 5. Why there are two Python processes

The API should return quickly and only enqueue work. The worker performs the long-running extraction/consolidation/export. Because the queue is stored in Supabase, restarting the worker does not discard the job.

Run at least one worker continuously. Multiple workers are supported by the atomic claim function.
