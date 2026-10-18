'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const importStatusSchema = z.enum([
  'usable',
  'usable_with_notes',
  'unread_parts',
  'unreadable',
  'ignored:scheme',
  'ignored:outline',
]);

const importRecordSchema = z.object({
  meta: z.object({
    path: z.string().trim().min(1).max(1024),
    year: z.number().int().min(2000).max(2100).nullable(),
    series: z.enum(['JAN-APR', 'MAY-AUG', 'SEP-DEC']).nullable(),
    trainer: z.string().max(200).nullable(),
    paper_kind: z.enum(['main', 'supplementary']).nullable(),
  }).passthrough(),
  status: importStatusSchema,
  error: z.string().max(1000).nullable(),
  paper: z.object({
    issues: z.array(z.string()).default([]),
    notes: z.array(z.string()).default([]),
  }).passthrough().nullable(),
}).passthrough();

type ImportRecord = z.infer<typeof importRecordSchema>;

const previewSectionSchema = z.object({
  label: z.string().max(20),
  questions: z.array(z.object({
    number: z.number().int(),
    text: z.string().max(4000),
  }).passthrough()),
}).passthrough();

function previewForPaper(paper: ImportRecord['paper']) {
  if (!paper || !('sections' in paper)) return [];
  const parsed = z.array(previewSectionSchema).safeParse(paper.sections);
  if (!parsed.success) return [];

  return parsed.data.map((section) => ({
    label: section.label,
    questions: section.questions.slice(0, 8).map((question) => ({
      number: question.number,
      text: question.text,
    })),
  }));
}

function importPath(batchId?: string, query?: string): never {
  const params = new URLSearchParams();
  if (batchId) params.set('batchId', batchId);
  if (query) {
    const [key, value] = query.split('=', 2);
    if (key && value) params.set(key, value);
  }
  redirect(`/assessment/exam-setting/past-papers?${params.toString()}`);
}

function parseJsonLines(contents: string): ImportRecord[] | null {
  const lines = contents.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 1 || lines.length > 1000) return null;

  const records: ImportRecord[] = [];
  const paths = new Set<string>();
  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    }
    catch {
      return null;
    }

    const parsed = importRecordSchema.safeParse(value);
    if (!parsed.success) return null;

    const normalizedPath = parsed.data.meta.path.replaceAll('\\', '/');
    const segments = normalizedPath.split('/');
    if (
      normalizedPath.startsWith('/')
      || normalizedPath.includes(':')
      || segments.some((segment) => segment === '..' || segment === '.')
    ) {
      return null;
    }
    if (paths.has(normalizedPath)) return null;
    paths.add(normalizedPath);

    records.push(parsed.data);
  }
  return records;
}

function databaseRows(
  records: ImportRecord[],
  batchId: string,
  departmentId: string,
) {
  return records.map((record) => ({
    batch_id: batchId,
    department_id: departmentId,
    source_path: record.meta.path,
    exam_year: record.meta.year,
    series: record.meta.series,
    trainer_name: record.meta.trainer,
    paper_kind: record.meta.paper_kind,
    unit_code: record.paper && 'unit_code' in record.paper
      && typeof record.paper.unit_code === 'string'
      ? record.paper.unit_code.slice(0, 80)
      : null,
    import_status: record.status,
    parse_error: record.error ?? record.paper?.issues.join(' | ') ?? null,
    parse_notes: record.paper?.notes ?? [],
    paper_data: record.paper,
    paper_preview: previewForPaper(record.paper),
  }));
}

export async function importParsedPapersAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) importPath(undefined, 'error=department');

  const candidate = formData.get('papersFile');
  if (!(candidate instanceof File) || candidate.size === 0) {
    importPath(undefined, 'error=file');
  }
  if (
    !candidate.name.toLowerCase().endsWith('.jsonl')
    || candidate.size > 45 * 1024 * 1024
  ) {
    importPath(undefined, 'error=file');
  }

  const contents = await candidate.text();
  const records = parseJsonLines(contents);
  if (!records) importPath(undefined, 'error=format');

  const batchId = randomUUID();
  const storagePath = `${profile.activeDepartmentId}/${batchId}/papers.jsonl`;
  const admin = createAdminClient();
  const uploadBytes = new Uint8Array(await candidate.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from('exam-imports')
    .upload(storagePath, uploadBytes, {
      contentType: 'application/x-ndjson',
      upsert: false,
    });
  if (uploadError) importPath(undefined, 'error=storage');

  const supabase = await createClient();
  const { error: batchError } = await supabase.from('exam_import_batches').insert({
    id: batchId,
    department_id: profile.activeDepartmentId,
    source_filename: candidate.name.slice(0, 255),
    storage_path: storagePath,
    total_records: records.length,
    status: 'reviewing',
    created_by: profile.id,
  });

  if (batchError) {
    await admin.storage.from('exam-imports').remove([storagePath]);
    importPath(undefined, 'error=save');
  }

  const rows = databaseRows(records, batchId, profile.activeDepartmentId);
  for (let index = 0; index < rows.length; index += 50) {
    const { error: itemsError } = await supabase
      .from('exam_import_items')
      .insert(rows.slice(index, index + 50));
    if (itemsError) {
      await supabase
        .from('exam_import_batches')
        .delete()
        .eq('id', batchId)
        .eq('department_id', profile.activeDepartmentId);
      await admin.storage.from('exam-imports').remove([storagePath]);
      importPath(undefined, 'error=save');
    }
  }

  revalidatePath('/assessment/exam-setting/past-papers');
  importPath(batchId, `imported=${records.length}`);
}

export async function reviewExamImportItemAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) importPath(undefined, 'error=department');

  const parsed = z.object({
    batchId: z.uuid(),
    itemId: z.uuid(),
    unitId: z.union([z.uuid(), z.literal('')]),
    reviewStatus: z.enum(['ready', 'rejected']),
  }).safeParse({
    batchId: formData.get('batchId'),
    itemId: formData.get('itemId'),
    unitId: formData.get('unitId'),
    reviewStatus: formData.get('reviewStatus'),
  });
  if (!parsed.success) importPath(undefined, 'error=invalid');

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from('exam_import_batches')
    .select('id,status')
    .eq('id', parsed.data.batchId)
    .eq('department_id', profile.activeDepartmentId)
    .maybeSingle();
  if (!batch || batch.status !== 'reviewing') {
    importPath(parsed.data.batchId, 'error=closed');
  }

  const { data: item } = await supabase
    .from('exam_import_items')
    .select('id,import_status')
    .eq('id', parsed.data.itemId)
    .eq('batch_id', parsed.data.batchId)
    .eq('department_id', profile.activeDepartmentId)
    .maybeSingle();
  if (!item) importPath(parsed.data.batchId, 'error=missing');

  let unitId: string | null = null;
  if (parsed.data.reviewStatus === 'ready') {
    if (!['usable', 'usable_with_notes'].includes(item.import_status)) {
      importPath(parsed.data.batchId, 'error=unusable');
    }
    if (!parsed.data.unitId) importPath(parsed.data.batchId, 'error=unit');

    const { data: unit } = await supabase
      .from('units')
      .select('id')
      .eq('id', parsed.data.unitId)
      .eq('department_id', profile.activeDepartmentId)
      .eq('is_active', true)
      .maybeSingle();
    if (!unit) importPath(parsed.data.batchId, 'error=unit');
    unitId = unit.id;
  }

  const { error } = await supabase
    .from('exam_import_items')
    .update({ review_status: parsed.data.reviewStatus, unit_id: unitId })
    .eq('id', parsed.data.itemId)
    .eq('batch_id', parsed.data.batchId)
    .eq('department_id', profile.activeDepartmentId);
  if (error) importPath(parsed.data.batchId, 'error=save');

  revalidatePath('/assessment/exam-setting/past-papers');
  importPath(parsed.data.batchId, `item=${parsed.data.reviewStatus}`);
}

export async function commitExamImportBatchAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) importPath(undefined, 'error=department');

  const batchId = formData.get('batchId');
  if (typeof batchId !== 'string' || !z.uuid().safeParse(batchId).success) {
    importPath(undefined, 'error=invalid');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('exam_commit_import_batch', {
    requested_batch: batchId,
  });
  if (error) importPath(batchId, 'error=commit');

  revalidatePath('/assessment/exam-setting/past-papers');
  revalidatePath('/assessment/exam-setting/question-bank');
  importPath(batchId, `committed=${data}`);
}
