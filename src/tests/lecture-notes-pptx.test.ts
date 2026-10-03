import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { extractTextFromPptx } from '@/features/lecture-notes/ingest/pptx-parser';
import { unpackLectureSourceZip } from '@/features/lecture-notes/ingest/zip-parser';

describe('extractTextFromPptx', () => {
  it('extracts slides and paragraphs from PPTX presentation buffer', async () => {
    const zip = new JSZip();
    zip.file(
      'ppt/slides/slide1.xml',
      '<p:spTree xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>Introduction to Epidemiology</a:t></a:r></a:p><a:p><a:r><a:t>Study of disease patterns</a:t></a:r></a:p></p:spTree>'
    );
    zip.file(
      'ppt/slides/slide2.xml',
      '<p:spTree xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>Key Metrics &amp; Rates</a:t></a:r></a:p></p:spTree>'
    );

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const text = await extractTextFromPptx(buffer);

    expect(text).toContain('--- Slide 1 ---');
    expect(text).toContain('Introduction to Epidemiology');
    expect(text).toContain('Study of disease patterns');
    expect(text).toContain('--- Slide 2 ---');
    expect(text).toContain('Key Metrics & Rates');
  });

  it('unpacks ZIP archive containing PPTX slides', async () => {
    const pptxZip = new JSZip();
    pptxZip.file(
      'ppt/slides/slide1.xml',
      '<p:spTree xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>Slide deck content</a:t></a:r></a:p></p:spTree>'
    );
    const pptxBuffer = await pptxZip.generateAsync({ type: 'nodebuffer' });

    const archive = new JSZip();
    archive.file('Course_Slides.pptx', pptxBuffer);
    archive.file('Readings.txt', 'Important reading text');

    const archiveBuffer = await archive.generateAsync({ type: 'nodebuffer' });
    const entries = await unpackLectureSourceZip(archiveBuffer);

    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.filename)).toEqual(
      expect.arrayContaining(['Course_Slides.pptx', 'Readings.txt'])
    );
  });
});
