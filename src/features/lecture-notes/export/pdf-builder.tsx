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
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function SectionContent({ section }: { section: GeneratedSection }) {
  const lines = section.body.split('\n');

  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionHeading}>{section.heading}</Text>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('[No source material')) {
          return (
            <View key={idx} style={styles.warningBox}>
              <Text style={styles.warningText}>{trimmed}</Text>
            </View>
          );
        }

        if (/^[-*]\s+/.test(trimmed)) {
          const content = cleanMarkdownInline(trimmed.replace(/^[-*]\s+/, ''));
          return (
            <View key={idx} style={styles.bulletRow}>
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
            <View key={idx} style={styles.numberRow}>
              <Text style={styles.numberLabel}>{num}</Text>
              <Text style={styles.numberText}>{content}</Text>
            </View>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <Text key={idx} style={styles.subHeading}>
              {cleanMarkdownInline(trimmed.slice(4))}
            </Text>
          );
        }

        return (
          <Text key={idx} style={styles.paragraph}>
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
