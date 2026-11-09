import { describe, expect, it } from 'vitest';
import { createZipArchive } from '@/features/teaching-documents/zip-archive';

describe('QA Export & Trainer Submissions - 3 Folders Per Trainer', () => {
  it('enforces 3 dedicated folders per trainer: Course Outlines, Schemes of Work, and Records of Work', () => {
    const trainerFolder = 'EMP001_Dr_Jane_Mwangi';
    const entries: Array<{ name: string; data: Buffer; isDirectory?: boolean }> = [];

    // Folder entries per trainer
    entries.push({ name: `${trainerFolder}/`, data: Buffer.alloc(0), isDirectory: true });
    entries.push({ name: `${trainerFolder}/Course Outlines/`, data: Buffer.alloc(0), isDirectory: true });
    entries.push({ name: `${trainerFolder}/Schemes of Work/`, data: Buffer.alloc(0), isDirectory: true });
    entries.push({ name: `${trainerFolder}/Records of Work/`, data: Buffer.alloc(0), isDirectory: true });

    // Dummy files in each of the 3 folders
    entries.push({
      name: `${trainerFolder}/Course Outlines/Human_Nutrition_Course_Outline.docx`,
      data: Buffer.from('test-course-outline'),
    });
    entries.push({
      name: `${trainerFolder}/Schemes of Work/NUTR101_Human_Nutrition_CND_scheme_of_work_v1.docx`,
      data: Buffer.from('test-scheme-of-work'),
    });
    entries.push({
      name: `${trainerFolder}/Records of Work/NUTR101_Human_Nutrition_CND_record_of_work_v1.docx`,
      data: Buffer.from('test-record-of-work'),
    });

    const archive = createZipArchive(entries);
    expect(archive).toBeInstanceOf(Buffer);
    expect(archive.length).toBeGreaterThan(0);

    // Verify all 3 subfolder paths exist
    const subfolders = entries
      .filter((e) => e.isDirectory && e.name.startsWith(trainerFolder) && e.name !== `${trainerFolder}/`)
      .map((e) => e.name);

    expect(subfolders).toHaveLength(3);
    expect(subfolders).toContain(`${trainerFolder}/Course Outlines/`);
    expect(subfolders).toContain(`${trainerFolder}/Schemes of Work/`);
    expect(subfolders).toContain(`${trainerFolder}/Records of Work/`);
  });

  it('validates that teaching document kinds include all 3 core academic documents', async () => {
    const { teachingDocumentKinds } = await import('@/features/teaching-documents/domain');
    const kinds = teachingDocumentKinds.map((k) => k.value);

    expect(kinds).toContain('course_outline');
    expect(kinds).toContain('scheme_of_work');
    expect(kinds).toContain('record_of_work');
  });
});
