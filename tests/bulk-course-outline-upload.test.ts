import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createZipArchive } from '@/features/teaching-documents/zip-archive';
import {
  parseBulkCourseOutlineWorkbook,
  parseBulkCourseOutlineZip,
  type SystemUnitLookup,
} from '@/features/teaching-documents/bulk-curriculum-parser';
import {
  getUnitCurriculum,
  type UnitCurriculumDefinition,
} from '@/features/teaching-documents/curriculum-registry';

describe('Bulk Course Outline Upload & Ingestion', () => {
  const mockSystemUnits: SystemUnitLookup[] = [
    { id: 'unit-1', code: 'CND 1101', name: 'Human Anatomy and Physiology' },
    { id: 'unit-2', code: 'DHN 2304', name: 'Biochemistry II' },
    { id: 'unit-3', code: 'NUT 101', name: 'Introduction to Nutrition' },
  ];

  it('correctly parses multi-unit Excel workbook with Units and Topics sheets', async () => {
    const workbook = new ExcelJS.Workbook();

    // 1. Units sheet
    const unitsSheet = workbook.addWorksheet('Units');
    unitsSheet.addRow([
      'Unit Code',
      'Unit Name',
      'Unit Description / Purpose',
      'Summary of Learning Outcomes (Core Competencies)',
      'Teaching / Learning Approaches',
      'Assessment Approaches & Weighting',
      'References & Textbooks',
    ]);
    unitsSheet.addRow([
      'CND 1101',
      'Human Anatomy and Physiology',
      'Official authoritative course description provided by HOD.',
      '1. Describe tissue classification.\n2. Explain cardiovascular function.',
      'Interactive lectures and laboratory practicals.',
      'CATs 30% · Final Exam 70%',
      'Ross & Wilson Anatomy and Physiology',
    ]);
    unitsSheet.addRow([
      'DHN 2304',
      'Biochemistry II',
      'Authoritative intermediate metabolism and biochemistry description.',
      '1. Apply enzyme kinetics.\n2. Describe bioenergetics.',
      'Lectures and tutorials.',
      'Continuous Assessments · End Term Exam',
      'Harper Illustrated Biochemistry',
    ]);

    // 2. Topics sheet
    const topicsSheet = workbook.addWorksheet('Course Outline Topics');
    topicsSheet.addRow([
      'Unit Code',
      'Unit Name',
      'Sequence / Week',
      'Topic Title',
      'Sub-topics / Specific Coverage',
      'Estimated Hours',
      'References & Textbooks',
    ]);
    topicsSheet.addRow([
      'CND 1101',
      'Human Anatomy',
      1,
      'Cellular Organization',
      'Cell membrane · Organelles · Transport mechanisms',
      4,
      'Ch. 1',
    ]);
    topicsSheet.addRow([
      'CND 1101',
      'Human Anatomy',
      2,
      'Tissue Biology',
      'Epithelial · Connective · Muscle · Nervous',
      4,
      'Ch. 2',
    ]);
    topicsSheet.addRow([
      'DHN 2304',
      'Biochemistry II',
      1,
      'Enzymology Fundamentals',
      'Enzyme classification · Active site · Km and Vmax',
      3,
      'Ch. 5',
    ]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await parseBulkCourseOutlineWorkbook(buffer, 'test-outlines.xlsx', mockSystemUnits);

    expect(result.ok).toBe(true);
    expect(result.fileType).toBe('xlsx');
    expect(result.totalUnits).toBe(2);
    expect(result.matchedCount).toBe(2);
    expect(result.unmatchedCount).toBe(0);

    const cndUnit = result.units.find((u) => u.unitCode === 'CND 1101');
    expect(cndUnit).toBeDefined();
    expect(cndUnit?.documentType).toBe('course_outline');
    expect(cndUnit?.status).toBe('matched');
    expect(cndUnit?.matchedUnitId).toBe('unit-1');
    expect(cndUnit?.unitDescription).toBe('Official authoritative course description provided by HOD.');
    expect(cndUnit?.topics).toHaveLength(2);
    expect(cndUnit?.topics[0].topic).toBe('Cellular Organization');
    expect(cndUnit?.topics[0].coverage).toBe('Cell membrane · Organelles · Transport mechanisms');

    const dhnUnit = result.units.find((u) => u.unitCode === 'DHN 2304');
    expect(dhnUnit).toBeDefined();
    expect(dhnUnit?.status).toBe('matched');
    expect(dhnUnit?.matchedUnitId).toBe('unit-2');
    expect(dhnUnit?.topics).toHaveLength(1);
    expect(dhnUnit?.topics[0].topic).toBe('Enzymology Fundamentals');
  });

  it('keeps mixed Course Outline and Scheme of Work sheet pairs separate', async () => {
    const workbook = new ExcelJS.Workbook();

    for (const documentName of ['Course Outline', 'Scheme of Work']) {
      const unitsSheet = workbook.addWorksheet(`${documentName} Units`);
      unitsSheet.addRow(['Unit Code', 'Unit Name', 'Unit Description']);
      unitsSheet.addRow([
        'CND 1101',
        'Human Anatomy and Physiology',
        `${documentName} description`,
      ]);

      const topicsSheet = workbook.addWorksheet(`${documentName} Topics`);
      topicsSheet.addRow(['Unit Code', 'Sequence', 'Topic Title', 'Sub-topics']);
      topicsSheet.addRow([
        'CND 1101',
        1,
        `${documentName} topic`,
        `${documentName} coverage`,
      ]);
    }

    workbook.addWorksheet('Review Notes').addRow(['Review notes are not curriculum data']);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await parseBulkCourseOutlineWorkbook(buffer, 'mixed-curriculum.xlsx', mockSystemUnits);

    expect(result.ok).toBe(true);
    expect(result.totalUnits).toBe(2);
    expect(result.units.map((unit) => unit.documentType).sort()).toEqual([
      'course_outline',
      'scheme_of_work',
    ]);
    expect(result.units.find((unit) => unit.documentType === 'course_outline')?.topics[0].topic)
      .toBe('Course Outline topic');
    expect(result.units.find((unit) => unit.documentType === 'scheme_of_work')?.topics[0].topic)
      .toBe('Scheme of Work topic');
    expect(result.issues.some((issue) => issue.message.includes('Review Notes'))).toBe(true);
  });

  it('handles unmatched units and adds appropriate warning issues', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Units');
    sheet.addRow(['Unit Code', 'Unit Name', 'Description']);
    sheet.addRow(['UNKNOWN 999', 'Unknown Course', 'Some description']);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await parseBulkCourseOutlineWorkbook(buffer, 'unknown.xlsx', mockSystemUnits);

    expect(result.ok).toBe(true);
    expect(result.totalUnits).toBe(1);
    expect(result.unmatchedCount).toBe(1);
    expect(result.units[0].status).toBe('unmatched');
    expect(result.issues.some((i) => i.message.includes('UNKNOWN 999'))).toBe(true);
  });

  it('handles empty zip archive gracefully', async () => {
    // Empty zip header buffer (22 bytes end of central directory)
    const emptyZip = Buffer.from([
      0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    const result = await parseBulkCourseOutlineZip(emptyZip, 'empty.zip', mockSystemUnits);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No Word (.docx) documents found');
  });

  it('detects Scheme of Work Word documents from their filenames', async () => {
    const xml = [
      '<w:document><w:body><w:p><w:r><w:t>CND 1101</w:t></w:r></w:p><w:tbl>',
      '<w:tr><w:tc><w:p><w:r><w:t>Week</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Topic</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Coverage</w:t></w:r></w:p></w:tc></w:tr>',
      ...[1, 2, 3].map((week) =>
        `<w:tr><w:tc><w:p><w:r><w:t>${week}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Topic ${week}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Coverage ${week}</w:t></w:r></w:p></w:tc></w:tr>`,
      ),
      '</w:tbl></w:body></w:document>',
    ].join('');
    const docx = createZipArchive([
      { name: 'word/document.xml', data: Buffer.from(xml) },
    ]);
    const archive = createZipArchive([
      { name: 'Scheme of Work CND 1101.docx', data: docx },
    ]);

    const result = await parseBulkCourseOutlineZip(archive, 'schemes.zip', mockSystemUnits);

    expect(result.ok).toBe(true);
    expect(result.units).toHaveLength(1);
    expect(result.units[0].documentType).toBe('scheme_of_work');
    expect(result.units[0].unitCode).toBe('CND 1101');
  });

  it('formats authoritative topics into standard 14-week TVET layout without synthetic leakage', async () => {
    const { generateTVETCourseOutline } = await import('@/features/teaching-documents/tvet-standards');

    const header = {
      institutionName: 'Imperial College',
      departmentName: 'Nutrition & Dietetics',
      academicPeriodName: 'Jan - Apr 2026',
      unitCode: 'CND 1101',
      unitName: 'Human Anatomy and Physiology',
      cohortName: 'CND Jan 2026',
      trainerName: 'Dr. Jane Doe',
      totalNominalHours: 40,
      weeklyHours: 4,
    };

    const authoritativeCurriculum: UnitCurriculumDefinition = {
      unitCode: 'CND 1101',
      unitName: 'Human Anatomy and Physiology',
      unitDescription: 'Authoritative Human Anatomy syllabus directly from department.',
      overallCompetency: 'Apply anatomical principles in clinical nutrition practice.',
      learningOutcomes: ['Understand human body systems', 'Identify anatomical structures'],
      weeklySchedule: [
        { weekNumber: 1, topicTitle: 'Cell Physiology', subTopics: ['Membrane transport', 'Organelles'] },
        { weekNumber: 2, topicTitle: 'Epithelial Tissue', subTopics: ['Squamous', 'Cuboidal', 'Columnar'] },
        { weekNumber: 3, topicTitle: 'Musculoskeletal System', subTopics: ['Bone osteology', 'Myocytes'] },
      ],
      references: ['Ross and Wilson 13th Edition'],
      isAvailable: true,
    };

    const outline = generateTVETCourseOutline(header, authoritativeCurriculum);

    expect(outline.isAvailable).toBe(true);
    expect(outline.unitDescription).toBe('Authoritative Human Anatomy syllabus directly from department.');
    expect(outline.overallCompetency).toBe('Apply anatomical principles in clinical nutrition practice.');
    expect(outline.weeklySchedule).toHaveLength(14);
    expect(outline.weeklySchedule[0].topicTitle).toContain('Cell Physiology');
  });
});
