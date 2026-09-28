import { beforeEach, describe, expect, it, vi } from 'vitest';

const { editorMocks } = vi.hoisted(() => ({
  editorMocks: {
    requireTrainerAccess: vi.fn(),
    revalidatePath: vi.fn(),
    from: vi.fn(),
    queries: [] as Array<{
      table: string;
      operation: string;
      filters: Array<[string, unknown]>;
      inserted: unknown[];
    }>,
  },
}));

vi.mock('@/features/auth/authorization', () => ({
  requireTrainerAccess: editorMocks.requireTrainerAccess,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: editorMocks.from }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: editorMocks.revalidatePath,
}));

import { saveOnlineCurriculumAction } from '@/features/teaching-documents/curriculum-editor/actions';

function createQuery(table: string) {
  const queryRecord = {
    table,
    operation: 'select',
    filters: [] as Array<[string, unknown]>,
    inserted: [] as unknown[],
  };
  editorMocks.queries.push(queryRecord);

  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      queryRecord.filters.push([column, value]);
      return query;
    },
    order: () => query,
    limit: () => query,
    update: () => {
      queryRecord.operation = 'update';
      return query;
    },
    insert: (value: unknown) => {
      queryRecord.operation = 'insert';
      queryRecord.inserted.push(value);
      return query;
    },
    maybeSingle: async () => ({ data: { id: 'unit-1' }, error: null }),
    single: async () => ({ data: { id: 'document-1' }, error: null }),
    then<TResult1 = { data: Array<{ version_number: number }>; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: Array<{ version_number: number }>; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve({ data: [{ version_number: 2 }], error: null }).then(onfulfilled, onrejected);
    },
  };

  return query;
}

describe('online curriculum editor document type scoping', () => {
  beforeEach(() => {
    editorMocks.queries.length = 0;
    editorMocks.requireTrainerAccess.mockResolvedValue({
      id: 'trainer-1',
      activeDepartmentId: 'department-1',
    });
    editorMocks.from.mockImplementation((table: string) => createQuery(table));
  });

  it.each(['course_outline', 'scheme_of_work'] as const)(
    'only supersedes and writes the selected %s document type',
    async (documentType) => {
      await saveOnlineCurriculumAction({
        documentType,
        unitId: 'unit-1',
        unitCode: 'CND 1101',
        unitName: 'Human Anatomy and Physiology',
        unitDescription: '',
        overallCompetencies: '',
        references: '',
        topics: [{ id: '1', topicTitle: 'Introduction', subTopics: 'Key concepts' }],
      });

      const versionLookup = editorMocks.queries.find(
        (query) => query.table === 'curriculum_document_versions' && query.operation === 'select',
      );
      const supersedeUpdate = editorMocks.queries.find(
        (query) => query.table === 'curriculum_document_versions' && query.operation === 'update',
      );
      const insertQuery = editorMocks.queries.find(
        (query) => query.table === 'curriculum_document_versions' && query.operation === 'insert',
      );

      expect(versionLookup?.filters).toContainEqual(['document_type', documentType]);
      expect(versionLookup?.filters).toContainEqual(['unit_id', 'unit-1']);
      expect(supersedeUpdate?.filters).toContainEqual(['unit_id', 'unit-1']);
      expect(supersedeUpdate?.filters).toContainEqual(['document_type', documentType]);
      expect(supersedeUpdate?.filters).toContainEqual(['status', 'active']);
      expect(supersedeUpdate?.filters).not.toContainEqual([
        'document_type',
        documentType === 'scheme_of_work' ? 'course_outline' : 'scheme_of_work',
      ]);
      expect(insertQuery?.inserted[0]).toMatchObject({ document_type: documentType });
    },
  );

  it('defaults a direct save without documentType to Course Outline', async () => {
    await saveOnlineCurriculumAction({
      unitId: 'unit-1',
      unitCode: 'CND 1101',
      unitName: 'Human Anatomy and Physiology',
      unitDescription: '',
      overallCompetencies: '',
      references: '',
      topics: [{ id: '1', topicTitle: 'Introduction', subTopics: 'Key concepts' }],
    });

    const supersedeUpdate = editorMocks.queries.find(
      (query) => query.table === 'curriculum_document_versions' && query.operation === 'update',
    );
    const insertQuery = editorMocks.queries.find(
      (query) => query.table === 'curriculum_document_versions' && query.operation === 'insert',
    );

    expect(supersedeUpdate?.filters).toContainEqual(['document_type', 'course_outline']);
    expect(insertQuery?.inserted[0]).toMatchObject({ document_type: 'course_outline' });
  });
});
