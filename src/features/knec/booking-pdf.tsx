import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';

import type { KnecBookingFormContext } from './types';

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 22,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#000000',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'column',
  },
  approvalsSection: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    paddingBottom: 5,
    marginBottom: 6,
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  logo: {
    width: 46,
    height: 34,
    objectFit: 'contain',
  },
  titleCol: {
    flexDirection: 'column',
  },
  collegeName: {
    fontSize: 11.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  tagline: {
    fontSize: 7.5,
    fontStyle: 'italic',
    color: '#334155',
    marginTop: 0.5,
  },
  officeName: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginTop: 0.5,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  seriesLabel: {
    fontSize: 7.5,
    color: '#334155',
    textTransform: 'uppercase',
  },
  seriesVal: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 1,
  },
  formTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 5,
  },
  formTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  particularsBox: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 2,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
  },
  pRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
  },
  pRowLast: {
    flexDirection: 'row',
  },
  pCellLeft: {
    flex: 1,
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    borderRightWidth: 1,
    borderRightColor: '#64748b',
  },
  pCellRight: {
    flex: 1,
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    fontSize: 8.5,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  tableSection: {
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 6,
  },
  tableHeaderBar: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tableHeaderText: {
    color: '#000000',
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  tableHeadRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  thSn: { width: '6%', padding: 3, textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 8, borderRightWidth: 1, borderRightColor: '#334155' },
  thMod: { width: '12%', padding: 3, fontFamily: 'Helvetica-Bold', fontSize: 8, borderRightWidth: 1, borderRightColor: '#334155' },
  thCode: { width: '14%', padding: 3, fontFamily: 'Helvetica-Bold', fontSize: 8, borderRightWidth: 1, borderRightColor: '#334155' },
  thName: { width: '56%', padding: 3, fontFamily: 'Helvetica-Bold', fontSize: 8, borderRightWidth: 1, borderRightColor: '#334155' },
  thType: { width: '12%', padding: 3, textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  tdSn: { width: '6%', padding: 2.5, textAlign: 'center', fontSize: 8, borderRightWidth: 1, borderRightColor: '#cbd5e1' },
  tdMod: { width: '12%', padding: 2.5, fontSize: 8, fontFamily: 'Helvetica-Bold', borderRightWidth: 1, borderRightColor: '#cbd5e1' },
  tdCode: { width: '14%', padding: 2.5, fontSize: 8, fontFamily: 'Helvetica-Bold', borderRightWidth: 1, borderRightColor: '#cbd5e1' },
  tdName: { width: '56%', padding: 2.5, fontSize: 7.8, borderRightWidth: 1, borderRightColor: '#cbd5e1' },
  tdType: { width: '12%', padding: 2.5, textAlign: 'center', fontSize: 7.8, fontFamily: 'Helvetica-Bold' },
  cardBox: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  cardTitleBar: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cardTitleText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  cardRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    gap: 12,
  },
  cellLeft: {
    flex: 1.6,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#1e293b',
    paddingBottom: 2,
    fontSize: 8,
  },
  cellRight: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#1e293b',
    paddingBottom: 2,
    fontSize: 8,
  },
  cellHalf: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#1e293b',
    paddingBottom: 2,
    fontSize: 8,
  },
  footerContainer: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 3,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 8,
    color: '#1e293b',
    fontStyle: 'italic',
  },
});

function ApprovalCardPdf({
  num,
  title,
  approverLabel,
  rowPaddingY,
  minLineHeight,
}: {
  num: number;
  title: string;
  approverLabel: string;
  rowPaddingY: number;
  minLineHeight: number;
}) {
  return (
    <View style={styles.cardBox} wrap={false}>
      <View style={styles.cardTitleBar}>
        <Text style={styles.cardTitleText}>{num}. {title}</Text>
      </View>
      <View style={[styles.cardRow, { paddingTop: rowPaddingY, paddingBottom: rowPaddingY }]}>
        <View style={[styles.cellLeft, { minHeight: minLineHeight }]}>
          <Text style={styles.bold}>{approverLabel}</Text>
        </View>
        <View style={[styles.cellRight, { minHeight: minLineHeight }]}>
          <Text style={styles.bold}>Date:</Text>
        </View>
      </View>
      <View style={[styles.cardRow, { paddingTop: rowPaddingY, paddingBottom: rowPaddingY + 1 }]}>
        <View style={[styles.cellLeft, { minHeight: minLineHeight }]}>
          <Text style={styles.bold}>Comment:</Text>
        </View>
        <View style={[styles.cellRight, { minHeight: minLineHeight }]}>
          <Text style={styles.bold}>Signature:</Text>
        </View>
      </View>
    </View>
  );
}

export function KnecBookingPdfDocument({
  context,
  logoDataUri,
}: {
  context: KnecBookingFormContext;
  logoDataUri?: string | null;
}) {
  const allPapers = context.modulesSummary.flatMap((mod) =>
    mod.papers.map((paper) => ({
      moduleCode: mod.moduleCode,
      ...paper,
    })),
  );

  const count = allPapers.length;
  const rowPaddingY = count <= 7 ? 4.5 : 3;
  const minLineHeight = count <= 7 ? 15 : 12;

  return (
    <Document title={`${context.student.admissionNumber} KNEC Booking Clearance Form`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topSection}>
          <View style={styles.header}>
            <View style={styles.logoGroup}>
              {logoDataUri ? (
                /* eslint-disable-next-line jsx-a11y/alt-text */
                <Image src={logoDataUri} style={styles.logo} />
              ) : null}
              <View style={styles.titleCol}>
                <Text style={styles.collegeName}>
                  Imperial College of Medical and Health Sciences
                </Text>
                <Text style={styles.tagline}>Committed to Professional Excellence</Text>
                <Text style={styles.officeName}>
                  OFFICE OF THE REGISTRAR (KNEC EXAMINATION BOOKING)
                </Text>
              </View>
            </View>
            <View style={styles.rightCol}>
              <Text style={styles.seriesLabel}>KNEC Exam Series:</Text>
              <Text style={styles.seriesVal}>{context.booking.seriesName}</Text>
            </View>
          </View>

          <View style={styles.formTitleContainer}>
            <Text style={styles.formTitle}>KNEC EXAMINATION BOOKING &amp; CLEARANCE FORM</Text>
          </View>

          <View style={styles.particularsBox}>
            <View style={styles.pRow}>
              <View style={styles.pCellLeft}>
                <Text><Text style={styles.bold}>Student Name:</Text> {context.student.fullName}</Text>
              </View>
              <View style={styles.pCellRight}>
                <Text><Text style={styles.bold}>Admission No:</Text> {context.student.admissionNumber}</Text>
              </View>
            </View>
            <View style={styles.pRow}>
              <View style={styles.pCellLeft}>
                <Text><Text style={styles.bold}>KNEC Index No:</Text> {context.student.knecIndexNumber ?? 'To be assigned'}</Text>
              </View>
              <View style={styles.pCellRight}>
                <Text><Text style={styles.bold}>Exam Series:</Text> {context.booking.seriesName} ({context.booking.bookingType.toUpperCase()})</Text>
              </View>
            </View>
            <View style={styles.pRowLast}>
              <View style={styles.pCellLeft}>
                <Text><Text style={styles.bold}>Course Track:</Text> {context.student.programmeName}</Text>
              </View>
              <View style={styles.pCellRight}>
                <Text><Text style={styles.bold}>Intake:</Text> {context.student.cohortName ?? 'N/A'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tableSection}>
            <View style={styles.tableHeaderBar}>
              <Text style={styles.tableHeaderText}>
                Booked Modules &amp; KNEC Papers ({allPapers.length} Papers · {context.modulesSummary.map((m) => m.moduleCode).join(', ')})
              </Text>
            </View>
            <View style={styles.tableHeadRow}>
              <Text style={styles.thSn}>S/N</Text>
              <Text style={styles.thMod}>Module</Text>
              <Text style={styles.thCode}>Paper Code</Text>
              <Text style={styles.thName}>Paper Name</Text>
              <Text style={styles.thType}>Type</Text>
            </View>
            {allPapers.map((paper, idx) => (
              <View key={paper.paperCode} style={styles.tableRow} wrap={false}>
                <Text style={styles.tdSn}>{idx + 1}</Text>
                <Text style={styles.tdMod}>{paper.moduleCode}</Text>
                <Text style={styles.tdCode}>{paper.paperCode}</Text>
                <Text style={styles.tdName}>{paper.paperName}</Text>
                <Text style={styles.tdType}>{paper.isResit ? 'RESIT' : 'NORMAL'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 5 REQUIRED SIGNOFF CARDS: HOD, ACCOUNTS, REGISTRAR, PRINCIPAL, MANAGING DIRECTOR */}
        <View style={styles.approvalsSection}>
          <ApprovalCardPdf
            num={1}
            title="HOD APPROVAL"
            approverLabel="Approved/not approved by: HOD:"
            rowPaddingY={rowPaddingY}
            minLineHeight={minLineHeight}
          />

          <View style={styles.cardBox} wrap={false}>
            <View style={styles.cardTitleBar}>
              <Text style={styles.cardTitleText}>2. ACCOUNTS CLEARANCE (KNEC EXAM &amp; TUITION FEES)</Text>
            </View>
            <View style={[styles.cardRow, { paddingTop: rowPaddingY, paddingBottom: rowPaddingY }]}>
              <View style={[styles.cellHalf, { minHeight: minLineHeight }]}>
                <Text style={styles.bold}>KNEC Exam Fee Paid: KShs</Text>
              </View>
              <View style={[styles.cellHalf, { minHeight: minLineHeight }]}>
                <Text style={styles.bold}>Balance: KShs</Text>
              </View>
            </View>
            <View style={[styles.cardRow, { paddingTop: rowPaddingY, paddingBottom: rowPaddingY + 1 }]}>
              <View style={[styles.cellLeft, { minHeight: minLineHeight }]}>
                <Text style={styles.bold}>Accounts Officer:</Text>
              </View>
              <View style={[styles.cellRight, { minHeight: minLineHeight }]}>
                <Text style={styles.bold}>Signature:</Text>
              </View>
              <View style={[styles.cellRight, { minHeight: minLineHeight }]}>
                <Text style={styles.bold}>Date:</Text>
              </View>
            </View>
          </View>

          <ApprovalCardPdf
            num={3}
            title="REGISTRAR APPROVAL"
            approverLabel="REGISTRAR:"
            rowPaddingY={rowPaddingY}
            minLineHeight={minLineHeight}
          />
          <ApprovalCardPdf
            num={4}
            title="PRINCIPAL APPROVAL"
            approverLabel="PRINCIPAL:"
            rowPaddingY={rowPaddingY}
            minLineHeight={minLineHeight}
          />
          <ApprovalCardPdf
            num={5}
            title="MANAGING DIRECTOR APPROVAL"
            approverLabel="MANAGING DIRECTOR:"
            rowPaddingY={rowPaddingY}
            minLineHeight={minLineHeight}
          />
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            Ref: {context.booking.clearanceRef ?? 'ICMHS/KNEC'}  |  This clearance form must be signed by HOD, Accounts, Registrar, Principal, and Managing Director before final KNEC portal submission.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildStudentKnecBookingPdf(context: KnecBookingFormContext): Promise<Buffer> {
  let logoDataUri: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png');
    const logoBuffer = await readFile(logoPath);
    logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch {
    logoDataUri = null;
  }

  return await renderToBuffer(
    <KnecBookingPdfDocument context={context} logoDataUri={logoDataUri} />,
  );
}
