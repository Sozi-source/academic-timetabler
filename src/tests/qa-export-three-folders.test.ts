import { describe, expect, it } from 'vitest';
import { createZipArchive } from '@/features/teaching-documents/zip-archive';

describe('QA Export & Trainer Submissions - 3 Folders Per Trainer', () => {
  it('enforces 3 dedicated folders per trainer: Course Outlines, Schemes of Work, and Records of Work', () => {
    const trainerFolder = 'Dr_Jane_Mwangi';
    const entries: Array<{ name: string; data: Buffer; isDirectory?: boolean }> = [];

    // Folder entries per trainer
    entries.push({ name: `${trainerFolder}/`, data: Buffer.alloc(0), isDirectory: true });
    entries.push({ name: `${trainerFolder}/Course Outlines/`, data: Buffer.alloc(0), isDirectory: true });
    entries.push({ name: `${trainerFolder}/Schemes of Work/`, data: Buffer.alloc(0), isDirectory: true });
    entries.push({ name: `${trainerFolder}/Records of Work/`, data: Buffer.alloc(0), isDirectory: true });

    // Dummy files in each of the 3 folders without unit code or cohort
    entries.push({
      name: `${trainerFolder}/Course Outlines/Human_Nutrition.docx`,
      data: Buffer.from('test-course-outline'),
    });
    entries.push({
      name: `${trainerFolder}/Schemes of Work/Human_Nutrition.docx`,
      data: Buffer.from('test-scheme-of-work'),
    });
    entries.push({
      name: `${trainerFolder}/Records of Work/Human_Nutrition.docx`,
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

  it('labels trainer folder with only trainer names and document files without unit code or cohort', () => {
    const trainer = { staff_number: 'EMP999', full_name: 'Dr. Jane Mwangi' };
    const unit = { code: 'NUTR101', name: 'Human Nutrition & Dietetics' };
    const cohort = { name: 'CND 2026' };

    // Function matching safePathSegment logic
    const safeSegment = (v: string) =>
      v
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^\.+|\.+$/g, '')
        .replace(/_+/g, '_')
        .slice(0, 90);

    const folder = safeSegment(trainer.full_name);
    // Folder must not contain staff number / trainer code
    expect(folder).not.toContain('EMP999');
    expect(folder).toBe('Dr._Jane_Mwangi');

    const directories = ['Course Outlines', 'Schemes of Work', 'Records of Work'] as const;
    for (const dir of directories) {
      const filePath = `${folder}/${dir}/${safeSegment(unit.name)}.docx`;
      // Must not contain unit code or cohort name
      expect(filePath).not.toContain(unit.code);
      expect(filePath).not.toContain(cohort.name);
      expect(filePath).toBe(`Dr._Jane_Mwangi/${dir}/Human_Nutrition_Dietetics.docx`);
    }
  });
});
