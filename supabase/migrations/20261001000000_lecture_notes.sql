-- ============================================================
-- Lecture Notes Generator — Initial Schema
-- 2026-10-01: pgvector, lecture_materials, chunks, jobs, RLS
-- ============================================================

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Materials uploaded by a trainer for a specific unit
create table lecture_materials (
  id                       uuid primary key default gen_random_uuid(),
  trainer_id               uuid not null references auth.users(id) on delete cascade,
  teaching_allocation_id   uuid references teaching_allocations(id) on delete set null,
  unit_id                  uuid not null references units(id) on delete cascade,
  department_id            uuid references departments(id) on delete set null,
  title                    text not null,
  source_type              text not null check (source_type in ('pdf', 'docx', 'text', 'url')),
  source_url               text,
  original_filename        text,
  storage_bucket           text,
  storage_path             text,
  content_text             text,      -- full extracted text (full-text search fallback)
  chunk_count              int not null default 0,
  ingested_at              timestamp with time zone,
  created_at               timestamp with time zone not null default now(),
  updated_at               timestamp with time zone not null default now()
);

-- 3. Embedded chunks for semantic retrieval (pgvector)
--    Gemini text-embedding-004 → 768 dimensions
create table lecture_material_chunks (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references lecture_materials(id) on delete cascade,
  chunk_index  int  not null,
  content      text not null,
  embedding    vector(768),
  token_count  int,
  created_at   timestamp with time zone not null default now(),
  unique (material_id, chunk_index)
);

-- IVFFlat index for fast cosine-similarity search
create index lecture_material_chunks_embedding_idx
  on lecture_material_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Full-text search on chunk content (fallback when embeddings not yet built)
create index lecture_material_chunks_content_fts_idx
  on lecture_material_chunks
  using gin (to_tsvector('english', content));

-- 4. Generation jobs
create table lecture_note_jobs (
  id                     uuid primary key default gen_random_uuid(),
  trainer_id             uuid not null references auth.users(id) on delete cascade,
  teaching_allocation_id uuid references teaching_allocations(id) on delete set null,
  unit_id                uuid not null references units(id) on delete cascade,
  department_id          uuid references departments(id) on delete set null,
  granularity            text not null check (granularity in ('session', 'unit')),
  session_week           int,        -- null when granularity = 'unit'
  topic                  text,
  status                 text not null default 'pending'
                           check (status in ('pending', 'processing', 'done', 'error')),
  error_message          text,
  prompt_token_count     int,
  output_token_count     int,
  -- Storage paths for generated outputs
  docx_storage_bucket    text,
  docx_storage_path      text,
  pdf_storage_bucket     text,
  pdf_storage_path       text,
  created_at             timestamp with time zone not null default now(),
  completed_at           timestamp with time zone
);

-- 5. Row Level Security
alter table lecture_materials         enable row level security;
alter table lecture_material_chunks   enable row level security;
alter table lecture_note_jobs         enable row level security;

-- Trainers can only access their own materials
create policy "lecture_materials_trainer_own"
  on lecture_materials for all
  using (auth.uid() = trainer_id);

-- Chunks inherit access from their parent material
create policy "lecture_material_chunks_trainer_own"
  on lecture_material_chunks for all
  using (
    material_id in (
      select id from lecture_materials where trainer_id = auth.uid()
    )
  );

-- Jobs are private to the trainer who created them
create policy "lecture_note_jobs_trainer_own"
  on lecture_note_jobs for all
  using (auth.uid() = trainer_id);

-- 6. pgvector semantic search function
create or replace function match_lecture_chunks(
  query_embedding  vector(768),
  p_unit_id        uuid,
  p_trainer_id     uuid,
  match_count      int default 8,
  similarity_threshold float default 0.5
)
returns table (
  id           uuid,
  material_id  uuid,
  chunk_index  int,
  content      text,
  similarity   float
)
language sql stable security definer as $$
  select
    c.id,
    c.material_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from lecture_material_chunks c
  join lecture_materials m on m.id = c.material_id
  where m.unit_id      = p_unit_id
    and m.trainer_id   = p_trainer_id
    and c.embedding    is not null
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- 7. Auto-update updated_at on lecture_materials
create or replace function update_lecture_materials_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lecture_materials_updated_at
  before update on lecture_materials
  for each row execute function update_lecture_materials_updated_at();
