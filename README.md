# Python backend notes engine — drop-in patch

This patch moves **Unified full unit** notes generation to a dedicated Python backend service.

Required application changes are under `src/`.
The database migration is under `supabase/migrations/`.
The Python service is under `services/notes-engine/`.

See `DEPLOY_NOTES_ENGINE.md` for deployment and environment variables.
