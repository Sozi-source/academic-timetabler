// ============================================================
// Lecture Notes — PDF Export Builder
// ============================================================
// Builds a structured PDF document from a LectureNotesDocument
// using @react-pdf/renderer. Matches institutional typography.

import React from 'react';
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
  type DocumentProps,
} from '@react-pdf/renderer';
import type { LectureNotesDocument, GeneratedSection } from '../types';

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1f2937',
    lineHeight: 1.45,
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#1b4332',
    borderBottomStyle: 'solid',
    paddingBottom: 10,
  },
  institution: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1b4332',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  topicTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 8.5,
    color: '#4b5563',
  },
  metaUnit: {
    fontFamily: 'Helvetica-Bold',
    color: '#1b4332',
  },
  metaRight: {
    fontFamily: 'Helvetica-Oblique',
    color: '#6b7280',
  },
  section: {
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1b4332',
    backgroundColor: '#f0fdf4',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
    borderLeftStyle: 'solid',
  },
  paragraph: {
    marginBottom: 5,
    fontSize: 8.5,
    color: '#374151',
    lineHeight: 1.4,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 10,
    fontSize: 9,
    color: '#16a34a',
  },
  bulletText: {
    flex: 1,
    fontSize: 8.5,
    color: '#374151',
  },
  numberRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  numberLabel: {
    width: 16,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },
  numberText: {
    flex: 1,
    fontSize: 8.5,
    color: '#374151',
  },
  subHeading: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    marginTop: 5,
    marginBottom: 3,
  },
  table: {
    marginTop: 4,
    marginBottom: 7,
    borderWidth: 0.7,
    borderColor: '#d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    flex: 1,
    borderRightWidth: 0.7,
    borderBottomWidth: 0.7,
    borderColor: '#d1d5db',
    padding: 4,
    fontSize: 7.8,
    color: '#374151',
  },
  tableHeaderCell: {
    flex: 1,
    borderRightWidth: 0.7,
    borderBottomWidth: 0.7,
    borderColor: '#d1d5db',
    padding: 4,
    fontSize: 7.8,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
  },
  warningBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  warningText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Oblique',
    color: '#92400e',
  },
  footer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
  footerTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  footerSource: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Oblique',
    color: '#4b5563',
    marginBottom: 2,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 16,
    right: 40,
    fontSize: 7.5,
    color: '#9ca3af',
  },
});

function cleanMarkdownInline(text: string): string {
  let value = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^{}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^{}]*)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\leftrightarrow/g, '↔')
    .replace(/\\geq/g, '≥')
    .replace(/\\leq/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\le/g, '≤')
    .replace(/\\approx/g, '≈')
    .replace(/\\pm/g, '±')
    .replace(/\\%/g, '%')
    .replace(/\\,/g, ' ')
    .replace(/\\cdot/g, '·')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '');

  // Turn simple LaTeX fractions into readable inline fractions.
  value = value.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1 / $2');

  return value
    .replace(/\\\\/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cleanMarkdownInline(cell.trim()));
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((line) => !isTableSeparator(line))
    .map(parseTableRow)
    .filter((row) => row.length > 0);

  if (rows.length === 0) return null;

  const columnCount = Math.max(...rows.map((row) => row.length));

  return (
    <View style={styles.table}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow}>
          {Array.from({ length: columnCount }, (_, columnIndex) => (
            <Text
              key={columnIndex}
              style={rowIndex === 0 ? styles.tableHeaderCell : styles.tableCell}
            >
              {row[columnIndex] ?? ''}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function SectionContent({ section }: { section: GeneratedSection }) {
  const lines = section.body.split('\n');
  const blocks: Array<{ type: 'line' | 'table'; lines: string[] }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      blocks.push({ type: 'line', lines: [''] });
      continue;
    }

    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines = [trimmed, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].trim().includes('|')) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      i -= 1;
      blocks.push({ type: 'table', lines: tableLines });
      continue;
    }

    blocks.push({ type: 'line', lines: [lines[i]] });
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{section.heading}</Text>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'table') {
          return <MarkdownTable key={`table-${blockIndex}`} lines={block.lines} />;
        }

        const line = block.lines[0];
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('[No source material')) {
          return (
            <View key={blockIndex} style={styles.warningBox}>
              <Text style={styles.warningText}>{trimmed}</Text>
            </View>
          );
        }

        if (/^[-*]\s+/.test(trimmed)) {
          const content = cleanMarkdownInline(trimmed.replace(/^[-*]\s+/, ''));
          return (
            <View key={blockIndex} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{content}</Text>
            </View>
          );
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s+(.+)$/);
          const num = match ? match[1] : '';
          const content = cleanMarkdownInline(match ? match[2] : trimmed);
          return (
            <View key={blockIndex} style={styles.numberRow}>
              <Text style={styles.numberLabel}>{num}</Text>
              <Text style={styles.numberText}>{content}</Text>
            </View>
          );
        }

        if (/^#{3,}\s+/.test(trimmed)) {
          return (
            <Text key={blockIndex} style={styles.subHeading}>
              {cleanMarkdownInline(trimmed.replace(/^#{3,}\s+/, ''))}
            </Text>
          );
        }

        return (
          <Text key={blockIndex} style={styles.paragraph}>
            {cleanMarkdownInline(trimmed)}
          </Text>
        );
      })}
    </View>
  );
}

export function LectureNotesPdfDocument({ doc }: { doc: LectureNotesDocument }) {
  const formattedDate = new Date(doc.generatedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const scopeLabel =
    doc.granularity === 'session' && doc.sessionWeek != null
      ? `Week ${doc.sessionWeek} Session`
      : 'Full Unit Notes';

  return (
    <Document title={`${doc.unitCode} - ${doc.topic}`} author="Imperial College of Medical & Health Sciences">
      <Page size="A4" style={styles.page}>
        {/* Cover / Header */}
        <View style={styles.header}>
          <Text style={styles.institution}>IMPERIAL COLLEGE OF MEDICAL &amp; HEALTH SCIENCES</Text>
          <Text style={styles.topicTitle}>{doc.topic}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaUnit}>
              {doc.unitCode}: {doc.unitName}
            </Text>
            <Text style={styles.metaRight}>
              {scopeLabel} · {formattedDate}
            </Text>
          </View>
        </View>

        {/* Sections */}
        {doc.sections.map((section, sIdx) => (
          <SectionContent key={sIdx} section={section} />
        ))}

        {/* Source materials */}
        {doc.sourceMaterials.length > 0 && (
          <View style={styles.footer} wrap={false}>
            <Text style={styles.footerTitle}>Grounded Source Materials</Text>
            {doc.sourceMaterials.map((title, mIdx) => (
              <Text key={mIdx} style={styles.footerSource}>
                • {title}
              </Text>
            ))}
          </View>
        )}

        {/* Page numbering */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function buildLectureNotesPdf(doc: LectureNotesDocument): Promise<Buffer> {
  const element = React.createElement(LectureNotesPdfDocument, { doc });
  const buffer = await renderToBuffer(element as unknown as React.ReactElement<DocumentProps>);
  return Buffer.from(buffer);
}
