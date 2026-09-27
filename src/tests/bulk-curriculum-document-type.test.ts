import { beforeEach, describe, expect, it, vi } from 'vitest';

const { bulkMocks } = vi.hoisted(() => ({
  bulkMocks: {
    requireHodAccess: vi.fn(),
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
  requireHodAccess: bulkMocks.requireHodAccess,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: bulkMocks.from }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: bulkMocks.revalidatePath,
}));

import { commitBulkCourseOutlinesAction } from '@/features/teaching-documents/bulk-curriculum-actions';

function createQuery(table: string) {
  const queryRecord = {
    table,
    operation: 'select',
    filters: [] as Array<[string, unknown]>,
    inserted: [] as unknown[],
  };
  bulkMocks.queries.push(queryRecord);

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
    then<TResult1 = { data: Array<{ version_number: number }>; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: Array<{ version_number: number }>; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve({ data: [{ version_number: 1 }], error: null }).then(onfulfilled, onrejected);
    },
  };

  return query;
}

describe('bulk curriculum document type commits', () => {
  beforeEach(() => {
    bulkMocks.queries.length = 0;
    bulkMocks.requireHodAccess.mockResolvedValue({
      id: 'hod-1',
      activeDepartmentId: 'department-1',
    });
    bulkMocks.from.mockImplementation((table: string) => createQuery(table));
  });

  it('versions, supersedes, and inserts mixed document types independently', async () => {
    const result = await commitBulkCourseOutlinesAction([
      {
        documentType: 'course_outline',
        unitCode: 'CND 1101',
        unitName: 'Human Anatomy and Physiology',
        matchedUnitId: 'unit-1',
        matchedUnitCode: 'CND 1101',
        matchedUnitName: 'Human Anatomy and Physiology',
        status: 'matched',
        topics: [{ sequence: 1, topic: 'Course topic', coverage: 'Course coverage' }],
      },
      {
        documentType: 'scheme_of_work',
        unitCode: 'CND 1101',
        unitName: 'Human Anatomy and Physiology',
        matchedUnitId: 'unit-1',
        matchedUnitCode: 'CND 1101',
        matchedUnitName: 'Human Anatomy and Physiology',
        status: 'matched',
        topics: [{ sequence: 1, topic: 'Scheme topic', coverage: 'Scheme coverage' }],
      },
    ]);

    const versionQueries = bulkMocks.queries.filter(
      (query) => query.table === 'curriculum_document_versions' && query.operation === 'select',
    );
    const updateQueries = bulkMocks.queries.filter(
      (query) => query.table === 'curriculum_document_versions' && query.operation === 'update',
    );
    const insertQueries = bulkMocks.queries.filter(
      (query) => query.table === 'curriculum_document_versions' && query.operation === 'insert',
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(versionQueries.map((query) => query.filters.find(([field]) => field === 'document_type')?.[1]))
      .toEqual(['course_outline', 'scheme_of_work']);
    expect(updateQueries.map((query) => query.filters.find(([field]) => field === 'document_type')?.[1]))
      .toEqual(['course_outline', 'scheme_of_work']);
    expect(insertQueries.map((query) => (query.inserted[0] as { document_type: string }).document_type))
      .toEqual(['course_outline', 'scheme_of_work']);
  });
});
