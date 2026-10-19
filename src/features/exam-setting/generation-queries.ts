import 'server-only';

import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export interface ExamGenerationWorkspace {
  departmentName: string;
  units: Array<{ id: string; code: string; name: string; sourcePaperCount: number }>;
  blueprints: Array<{ id: string; name: string; versionNumber: number; totalMarks: number; durationMinutes: number }>;
  periods: Array<{ id: string; name: string; code: string; yearName: string }>;
  recentPapers: Array<{ id: string; unitName: string; periodName: string; paperKind: string; status: string; createdAt: string }>;
  migrationRequired: boolean;
}

export interface GeneratedPaperPreview {
  id: string;
  status: string;
  totalMarks: number;
  unitName: string;
  periodName: string;
  paperKind: string;
  questions: Array<{
    section: string;
    number: number;
    marks: number;
    status: string;
    stem: string;
    parts: Array<{ label: string; text: string; marks: number }>;
    bodyText: string;
    topic: string;
    similarity: number;
  }>;
}

export async function getGeneratedPaperPreview(paperId: string): Promise<GeneratedPaperPreview | null> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('exam_paper_items')
    .select('section_label,item_number,marks,slot_status,exam_questions!inner(body,body_text,topic,max_similarity),exam_papers!inner(id,paper_kind,status,total_marks,department_id,units!inner(name),academic_periods!inner(name))')
    .eq('department_id', profile.activeDepartmentId)
    .eq('paper_id', paperId)
    .order('section_label')
    .order('item_number');
  if (error) {
    if (error.code === '22P02') return null;
    throw new Error(`Unable to load the generated paper: ${error.message}`);
  }
  if (!data || data.length === 0) return null;
  const first = data[0];
  const paper = Array.isArray(first.exam_papers) ? first.exam_papers[0] : first.exam_papers;
  const unit = paper && (Array.isArray(paper.units) ? paper.units[0] : paper.units);
  const period = paper && (Array.isArray(paper.academic_periods) ? paper.academic_periods[0] : paper.academic_periods);
  return {
    id: paper?.id ?? paperId,
    status: paper?.status ?? 'draft',
    totalMarks: paper?.total_marks ?? 0,
    unitName: unit?.name ?? 'Unit',
    periodName: period?.name ?? 'Academic period',
    paperKind: paper?.paper_kind ?? 'main',
    questions: data.flatMap((item) => {
      const question = Array.isArray(item.exam_questions) ? item.exam_questions[0] : item.exam_questions;
      if (!question) return [];
      const rawBody = typeof question.body === 'object' && question.body !== null && !Array.isArray(question.body)
        ? question.body as Record<string, unknown>
        : null;
      const stem = typeof rawBody?.stem === 'string' && rawBody.stem.trim().length > 0
        ? rawBody.stem.trim()
        : question.body_text;
      const rawParts = Array.isArray(rawBody?.parts) ? rawBody.parts : [];
      const parts = rawParts.flatMap((part) => {
        if (typeof part !== 'object' || part === null || Array.isArray(part)) return [];
        const record = part as Record<string, unknown>;
        const label = typeof record.label === 'string' ? record.label.trim() : '';
        const text = typeof record.text === 'string' ? record.text.trim() : '';
        const marks = typeof record.own_marks === 'number'
          ? record.own_marks
          : typeof record.marks === 'number'
            ? record.marks
            : 0;
        return text ? [{ label, text, marks }] : [];
      });
      return [{
        section: item.section_label,
        number: item.item_number,
        marks: item.marks ?? 0,
        status: item.slot_status,
        stem,
        parts,
        bodyText: question.body_text,
        topic: question.topic,
        similarity: question.max_similarity ?? 0,
      }];
    }),
  };
}

export const getExamGenerationWorkspace = cache(async (): Promise<ExamGenerationWorkspace> => {
  const profile = await requireHodAccess();
  const empty: ExamGenerationWorkspace = {
    departmentName: profile.departmentName,
    units: [],
    blueprints: [],
    periods: [],
    recentPapers: [],
    migrationRequired: false,
  };
  if (!profile.activeDepartmentId) return empty;

  const supabase = await createClient();
  const [unitResult, blueprintResult, periodResult, sourceResult, paperResult, generationCapability] = await Promise.all([
    supabase.from('units').select('id,code,name').eq('department_id', profile.activeDepartmentId).eq('is_active', true).order('code'),
    supabase.from('exam_blueprints').select('id,name,version_number,total_marks,duration_minutes').eq('department_id', profile.activeDepartmentId).eq('status', 'active').order('name'),
    supabase.from('academic_periods').select('id,name,code,academic_years!inner(name,status)').in('status', ['active', 'planned']).order('starts_on', { ascending: false }),
    supabase.from('exam_source_files').select('unit_id').eq('department_id', profile.activeDepartmentId).eq('source_type', 'past_paper').in('parse_status', ['parsed', 'needs_review']),
    supabase.from('exam_papers').select('id,paper_kind,status,created_at,units!inner(name,department_id),academic_periods!inner(name)').eq('department_id', profile.activeDepartmentId).order('created_at', { ascending: false }).limit(10),
    supabase.rpc('exam_generation_commit_enabled'),
  ]);

  const schemaErrors = [unitResult.error, blueprintResult.error, sourceResult.error, paperResult.error]
    .filter((error) => error && (error.code === '42P01' || error.code === 'PGRST205'));
  if (schemaErrors.length > 0 || generationCapability.error) return { ...empty, migrationRequired: true };
  if (unitResult.error) throw new Error(`Unable to load units: ${unitResult.error.message}`);
  if (blueprintResult.error) throw new Error(`Unable to load active blueprints: ${blueprintResult.error.message}`);
  if (periodResult.error) throw new Error(`Unable to load academic periods: ${periodResult.error.message}`);
  if (sourceResult.error) throw new Error(`Unable to count past papers: ${sourceResult.error.message}`);
  if (paperResult.error) throw new Error(`Unable to load generated papers: ${paperResult.error.message}`);

  const sourceCounts = new Map<string, number>();
  for (const source of sourceResult.data ?? []) sourceCounts.set(source.unit_id, (sourceCounts.get(source.unit_id) ?? 0) + 1);
  return {
    ...empty,
    units: (unitResult.data ?? []).map((unit) => ({ ...unit, sourcePaperCount: sourceCounts.get(unit.id) ?? 0 })),
    blueprints: (blueprintResult.data ?? []).map((blueprint) => ({
      id: blueprint.id,
      name: blueprint.name,
      versionNumber: blueprint.version_number,
      totalMarks: blueprint.total_marks,
      durationMinutes: blueprint.duration_minutes,
    })),
    periods: (periodResult.data ?? []).map((period) => {
      const year = Array.isArray(period.academic_years) ? period.academic_years[0] : period.academic_years;
      return { id: period.id, name: period.name, code: period.code, yearName: year?.name ?? '' };
    }),
    recentPapers: (paperResult.data ?? []).map((paper) => {
      const unit = Array.isArray(paper.units) ? paper.units[0] : paper.units;
      const period = Array.isArray(paper.academic_periods) ? paper.academic_periods[0] : paper.academic_periods;
      return {
        id: paper.id,
        unitName: unit?.name ?? 'Unit',
        periodName: period?.name ?? 'Academic period',
        paperKind: paper.paper_kind,
        status: paper.status,
        createdAt: paper.created_at,
      };
    }),
  };
});
