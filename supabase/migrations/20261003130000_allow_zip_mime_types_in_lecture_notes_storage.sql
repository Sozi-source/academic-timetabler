-- ============================================================================
-- Migration: Add ZIP and Markdown MIME types to lecture-notes storage bucket
-- ============================================================================

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/octet-stream',
  'multipart/x-zip'
]::text[],
file_size_limit = 52428800 -- 50MB
where id = 'lecture-notes';
