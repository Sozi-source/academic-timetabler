// ============================================================
// Lecture Notes — DOCX Export Builder
// ============================================================
// Builds a structured Word document from a LectureNotesDocument.
// Uses the existing `docx` package already in the stack.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from 'docx';
import type { LectureNotesDocument } from '../types';

function markdownLineToRuns(line: string): TextRun[] {
  // Simple inline markdown: **bold**, *italic*, `code`
  const runs: TextRun[] = [];
  const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: 'Courier New', size: 18 }));
    } else if (part) {
      runs.push(new TextRun(part));
    }
  }
  return runs;
}

function bodyToDocxParagraphs(body: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    // Bullet points: - item or * item
    if (/^[-*]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, '');
      paragraphs.push(
        new Paragraph({
          children: markdownLineToRuns(text),
          bullet: { level: 0 },
          indent: { left: 720 },
        })
      );
    // Numbered lists
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s+/, '');
      paragraphs.push(
        new Paragraph({
          children: markdownLineToRuns(text),
          numbering: { reference: 'list', level: 0 },
          indent: { left: 720 },
        })
      );
    // H3 sub-headings
    } else if (trimmed.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.slice(4), bold: true, size: 22 })],
          heading: HeadingLevel.HEADING_3,
        })
      );
    // [No source material] warning
    } else if (trimmed.startsWith('[No source material')) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, color: 'C0392B', italics: true, size: 18 })],
          shading: { type: ShadingType.SOLID, color: 'FDEBD0' },
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: markdownLineToRuns(trimmed),
        })
      );
    }
  }

  return paragraphs;
}

export async function buildLectureNotesDocx(doc: LectureNotesDocument): Promise<Buffer> {
  const children: Paragraph[] = [];

  // ── Cover block ──────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: doc.topic, bold: true, size: 40, color: '1B4332' })],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${doc.unitCode}: ${doc.unitName}`,
          size: 24,
          color: '555555',
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: doc.granularity === 'session' && doc.sessionWeek != null
            ? `Week ${doc.sessionWeek} Session`
            : 'Full Unit Notes',
          size: 20,
          italics: true,
          color: '777777',
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date(doc.generatedAt).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'long', year: 'numeric',
          })}`,
          size: 18,
          color: '999999',
        }),
      ],
    }),
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '1B4332', space: 1 },
      },
      text: '',
      spacing: { after: 240 },
    })
  );

  // ── Sections ─────────────────────────────────────────────────
  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: section.heading, bold: true, size: 28, color: '1B4332' })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 120 },
      }),
      ...bodyToDocxParagraphs(section.body)
    );
  }

  // ── Source materials footer ───────────────────────────────────
  if (doc.sourceMaterials.length > 0) {
    children.push(
      new Paragraph({ text: '', spacing: { before: 480 } }),
      new Paragraph({
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 },
        },
        children: [new TextRun({ text: 'Source Materials', bold: true, size: 18, color: '555555' })],
        spacing: { before: 240, after: 80 },
      }),
      ...doc.sourceMaterials.map(
        (title) =>
          new Paragraph({
            children: [new TextRun({ text: `• ${title}`, size: 18, color: '777777', italics: true })],
          })
      )
    );
  }

  const document = new Document({
    numbering: {
      config: [
        {
          reference: 'list',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
