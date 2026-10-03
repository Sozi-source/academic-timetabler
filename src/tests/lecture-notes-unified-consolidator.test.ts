import { describe, expect, it } from 'vitest';
import { buildUnifiedLectureNotesDocument } from '@/features/lecture-notes/generation/unified-consolidator';

describe('buildUnifiedLectureNotesDocument', () => {
  it('reads every ready material and removes exact duplicate paragraphs only', () => {
    const { document, stats } = buildUnifiedLectureNotesDocument({
      unitCode: 'TEST 101',
      unitName: 'Sample Unit',
      topic: 'Full Unit',
      materials: [
        {
          id: '1', trainerId: 't', teachingAllocationId: null, unitId: 'u', departmentId: null,
          title: 'Version A', sourceType: 'docx', sourceUrl: null, originalFilename: 'a.docx',
          storageBucket: null, storagePath: null, contentText: '1. Introduction\nEpidemiology is the study of disease occurrence.\nExtra material from A.',
          chunkCount: 2, ingestedAt: '2026-10-03T00:00:00Z', createdAt: '', updatedAt: '',
        },
        {
          id: '2', trainerId: 't', teachingAllocationId: null, unitId: 'u', departmentId: null,
          title: 'Version B', sourceType: 'pdf', sourceUrl: null, originalFilename: 'b.pdf',
          storageBucket: null, storagePath: null, contentText: '1. Introduction\nEpidemiology is the study of disease occurrence.\nAdditional material from B.',
          chunkCount: 2, ingestedAt: '2026-10-03T00:00:00Z', createdAt: '', updatedAt: '',
        },
      ],
    });

    const joined = document.sections.map((s) => s.body).join('\n');
    expect(stats.materialCount).toBe(2);
    expect(stats.duplicateParagraphCount).toBeGreaterThan(0);
    expect(joined).toContain('Extra material from A.');
    expect(joined).toContain('Additional material from B.');
    expect(joined.match(/Epidemiology is the study of disease occurrence\./g)?.length).toBe(1);
  });
});
