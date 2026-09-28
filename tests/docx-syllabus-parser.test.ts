import { describe, expect, it } from 'vitest';
import { parseDocxSyllabus } from '@/features/teaching-documents/curriculum-editor/docx-parser';

function createMockDocx(xmlContent: string): Buffer {
  const contentBuf = Buffer.from(xmlContent, 'utf8');
  const filename = 'word/document.xml';
  const filenameBuf = Buffer.from(filename, 'utf8');

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(contentBuf.length, 18);
  localHeader.writeUInt32LE(contentBuf.length, 22);
  localHeader.writeUInt16LE(filenameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

  return Buffer.concat([localHeader, filenameBuf, contentBuf]);
}

describe('Word (.docx) Syllabus Parser & Normalizer', () => {
  it('parses a table-based Word syllabus cleanly into topics and subtopics', () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Unit Code: DHN 2304</w:t></w:r></w:p>
          <w:p><w:r><w:t>Course Title: Biochemistry II</w:t></w:r></w:p>
          <w:tbl>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Topic</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Content Coverage</w:t></w:r></w:p></w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Carbohydrate Chemistry</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Monosaccharides, Disaccharides and Polysaccharides</w:t></w:r></w:p></w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Lipids and Membranes</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Fatty acids, Triglycerides and Phospholipids</w:t></w:r></w:p></w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Amino Acids and Proteins</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Peptide bonds, Primary and Tertiary structures</w:t></w:r></w:p></w:tc>
            </w:tr>
          </w:tbl>
        </w:body>
      </w:document>`;

    const buffer = createMockDocx(mockXml);
    const result = parseDocxSyllabus(buffer);

    expect(result.unitCode).toBe('DHN 2304');
    expect(result.unitName).toBe('Biochemistry II');
    expect(result.topics).toHaveLength(3);
    expect(result.topics[0].topicTitle).toBe('Carbohydrate Chemistry');
    expect(result.topics[0].subTopics).toContain('Monosaccharides');
  });

  it('parses a list-based Word syllabus cleanly into topics and subtopics', () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Unit Code: NUT 102</w:t></w:r></w:p>
          <w:p><w:r><w:t>Unit Name: Principles of Human Nutrition</w:t></w:r></w:p>
          <w:p><w:r><w:t>1. Introduction to Macronutrients</w:t></w:r></w:p>
          <w:p><w:r><w:t>• Dietary sources and functions</w:t></w:r></w:p>
          <w:p><w:r><w:t>• Energy values and balance</w:t></w:r></w:p>
          <w:p><w:r><w:t>2. Micronutrients and Minerals</w:t></w:r></w:p>
          <w:p><w:r><w:t>• Fat-soluble and water-soluble vitamins</w:t></w:r></w:p>
          <w:p><w:r><w:t>• Trace elements and deficiencies</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

    const buffer = createMockDocx(mockXml);
    const result = parseDocxSyllabus(buffer);

    expect(result.unitCode).toBe('NUT 102');
    expect(result.unitName).toBe('Principles of Human Nutrition');
    expect(result.topics).toHaveLength(2);
    expect(result.topics[0].topicTitle).toBe('Introduction to Macronutrients');
    expect(result.topics[0].subTopics).toContain('Dietary sources');
    expect(result.topics[1].topicTitle).toBe('Micronutrients and Minerals');
  });
});
