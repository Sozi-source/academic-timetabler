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
import type { StudentPortalRegistrationContext } from './types';

const PRIMARY = '#0f172a';

const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    paddingBottom: 5,
    marginBottom: 8,
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  logo: {
    width: 48,
    height: 36,
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
    fontSize: 8,
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
  formTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  formTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  semesterLabel: {
    fontSize: 8,
    color: '#334155',
    textTransform: 'uppercase',
  },
  semesterVal: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 1,
  },
  particularsBox: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 2,
    marginBottom: 8,
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
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: '#64748b',
    color: '#000000',
  },
  pCellRight: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 9,
    color: '#000000',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  unitSection: {
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  unitHeaderBar: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  unitHeaderText: {
    color: '#000000',
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  unitHeadRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  unitRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
  },
  thSn: { width: '6%', padding: 3.5, textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 8.5, borderRightWidth: 1, borderRightColor: '#334155', color: '#000000' },
  thCode: { width: '16%', padding: 3.5, fontFamily: 'Helvetica-Bold', fontSize: 8.5, borderRightWidth: 1, borderRightColor: '#334155', color: '#000000' },
  thTitleLeft: { width: '28%', padding: 3.5, fontFamily: 'Helvetica-Bold', fontSize: 8.5, borderRightWidth: 1, borderRightColor: '#334155', color: '#000000' },
  thTitleRight: { width: '28%', padding: 3.5, fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#000000' },

  tdSn: { width: '6%', padding: 3.5, textAlign: 'center', fontSize: 8.5, borderRightWidth: 1, borderRightColor: '#64748b', color: '#000000' },
  tdCode: { width: '16%', padding: 3.5, fontFamily: 'Helvetica-Bold', fontSize: 8.5, borderRightWidth: 1, borderRightColor: '#64748b', color: '#000000' },
  tdTitleLeft: { width: '28%', padding: 3.5, fontSize: 8.5, borderRightWidth: 1, borderRightColor: '#334155', color: '#000000' },
  tdTitleRight: { width: '28%', padding: 3.5, fontSize: 8.5, color: '#000000' },

  cardBox: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 2,
    marginBottom: 5.5,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  cardTitleBar: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 3.5,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cardTitleText: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  cardRow: {
    flexDirection: 'row',
    paddingTop: 3.5,
    paddingBottom: 3.5,
    paddingHorizontal: 6,
    gap: 12,
  },
  cardRowLast: {
    flexDirection: 'row',
    paddingTop: 3.5,
    paddingBottom: 4.5,
    paddingHorizontal: 6,
    gap: 12,
  },
  cellLeft: {
    flex: 1.6,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#1e293b',
    paddingBottom: 2,
    fontSize: 8.5,
    color: '#000000',
  },
  cellRight: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#1e293b',
    paddingBottom: 2,
    fontSize: 8.5,
    color: '#000000',
  },
  cellHalf: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#1e293b',
    paddingBottom: 2,
    fontSize: 8.5,
    color: '#000000',
  },
  cellHalfNoLine: {
    flex: 1,
    paddingBottom: 2,
    fontSize: 8.5,
    color: '#000000',
  },
  footerText: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 8.5,
    color: '#1e293b',
    fontStyle: 'italic',
  },
});

function ApprovalCardPdf({
  num,
  title,
  approverLabel,
  cardMarginBottom,
  cardRowPaddingY,
  minLineHeight,
}: {
  num: number;
  title: string;
  approverLabel: string;
  cardMarginBottom: number;
  cardRowPaddingY: number;
  minLineHeight: number;
}) {
  return (
    <View style={[styles.cardBox, { marginBottom: cardMarginBottom }]} wrap={false}>
      <View style={styles.cardTitleBar}>
        <Text style={styles.cardTitleText}>{num}. {title}</Text>
      </View>
      <View style={[styles.cardRow, { paddingTop: cardRowPaddingY, paddingBottom: cardRowPaddingY }]}>
        <View style={[styles.cellLeft, { minHeight: minLineHeight }]}>
          <Text style={styles.bold}>{approverLabel}</Text>
        </View>
        <View style={[styles.cellRight, { minHeight: minLineHeight }]}>
          <Text style={styles.bold}>Date:</Text>
        </View>
      </View>
      <View style={[styles.cardRowLast, { paddingTop: cardRowPaddingY, paddingBottom: cardRowPaddingY }]}>
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

export function UnitRegistrationPdfDocument({
  context,
  logoDataUri,
}: {
  context: StudentPortalRegistrationContext;
  logoDataUri?: string | null;
}) {
  const period = context.period;
  if (!period) return null;

  const units = context.units
    .filter((unit) => unit.registrationStatus === 'registered')
    .sort((first, second) =>
      first.unitCode.localeCompare(second.unitCode, 'en', { numeric: true }),
    );

  const halfCount = Math.ceil(units.length / 2);
  const leftUnits = units.slice(0, halfCount);
  const rightUnits = units.slice(halfCount);
  const rowCount = Math.max(1, halfCount);

  // Stable 1-page A4 height budget (Total document height ~650-680pt out of 801pt printable limit):
  // Ensures strict 1-page A4 fit across 1 to 12 registered units with +1mm expanded writing cards.
  const cardMarginBottom = rowCount <= 3 ? 7.5 : rowCount === 4 ? 6 : 4.5;
  const cardRowPaddingY = rowCount <= 3 ? 5.5 : rowCount === 4 ? 4 : 3;
  const minLineHeight = rowCount <= 3 ? 17 : rowCount === 4 ? 14 : 12;
  const sectionMarginBottom = rowCount <= 3 ? 7.5 : rowCount === 4 ? 6 : 4.5;

  return (
    <Document title={`${context.student.admissionNumber} Unit Registration Form`}>
      <Page size="A4" style={styles.page}>
        {/* HEADER SECTION */}
        <View style={styles.header}>
          <View style={styles.logoGroup}>
            {logoDataUri ? (
              <Image src={logoDataUri} style={styles.logo} />
            ) : null}
            <View style={styles.titleCol}>
              <Text style={styles.collegeName}>
                Imperial College of Medical and Health Sciences
              </Text>
              <Text style={styles.tagline}>
                Committed to Professional Excellence
              </Text>
              <Text style={styles.officeName}>
                OFFICE OF THE REGISTRAR (ACADEMIC AFFAIRS)
              </Text>
            </View>
          </View>
          <View style={styles.rightCol}>
            <Text style={styles.semesterLabel}>Semester / Period:</Text>
            <Text style={styles.semesterVal}>{period.name}</Text>
          </View>
        </View>

        {/* CENTERED DOCUMENT FORM TITLE */}
        <View style={styles.formTitleContainer}>
          <Text style={styles.formTitle}>
            CONTINUING STUDENT UNIT REGISTRATION FORM
          </Text>
        </View>

        {/* STUDENT PARTICULARS (3 ROWS - REMOVED REDUNDANT ACADEMIC PERIOD ROW) */}
        <View style={[styles.particularsBox, { marginBottom: sectionMarginBottom }]}>
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
              <Text><Text style={styles.bold}>Course:</Text> {context.student.programmeName}</Text>
            </View>
            <View style={styles.pCellRight}>
              <Text><Text style={styles.bold}>Stage:</Text> {context.student.stageCode ?? context.student.stageName ?? 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.pRowLast}>
            <View style={styles.pCellLeft}>
              <Text><Text style={styles.bold}>Department:</Text> {context.student.departmentName}</Text>
            </View>
            <View style={styles.pCellRight}>
              <Text><Text style={styles.bold}>Intake:</Text> {context.student.cohortName ?? 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* REGISTERED UNITS OVERVIEW (2-COLUMN PARALLEL GRID) */}
        <View style={[styles.unitSection, { marginBottom: 23 }]}>
          <View style={styles.unitHeaderBar}>
            <Text style={styles.unitHeaderText}>
              Registered Units Overview ({units.length} Units)
            </Text>
          </View>
          <View style={styles.unitHeadRow}>
            <Text style={styles.thSn}>S/N</Text>
            <Text style={styles.thCode}>Code</Text>
            <Text style={styles.thTitleLeft}>Unit Name</Text>
            <Text style={styles.thSn}>S/N</Text>
            <Text style={styles.thCode}>Code</Text>
            <Text style={styles.thTitleRight}>Unit Name</Text>
          </View>
          {leftUnits.map((left, idx) => {
            const right = rightUnits[idx];
            return (
              <View key={left.registrationId} style={styles.unitRow}>
                <Text style={styles.tdSn}>{idx + 1}</Text>
                <Text style={styles.tdCode}>{left.unitCode}</Text>
                <Text style={styles.tdTitleLeft}>{left.unitName}</Text>
                <Text style={styles.tdSn}>{right ? idx + halfCount + 1 : ''}</Text>
                <Text style={styles.tdCode}>{right ? right.unitCode : ''}</Text>
                <Text style={styles.tdTitleRight}>{right ? right.unitName : ''}</Text>
              </View>
            );
          })}
        </View>

        {/* 1. ACCOUNTS CLEARANCE CARD */}
        <View style={[styles.cardBox, { marginBottom: cardMarginBottom }]} wrap={false}>
          <View style={styles.cardTitleBar}>
            <Text style={styles.cardTitleText}>1. ACCOUNTS CLEARANCE</Text>
          </View>
          <View style={[styles.cardRow, { paddingTop: cardRowPaddingY, paddingBottom: cardRowPaddingY }]}>
            <View style={[styles.cellHalf, { minHeight: minLineHeight }]}>
              <Text style={styles.bold}>Previous balance: KShs</Text>
            </View>
            <View style={[styles.cellHalf, { minHeight: minLineHeight }]}>
              <Text style={styles.bold}>Amount paid: KShs</Text>
            </View>
          </View>
          <View style={[styles.cardRow, { paddingTop: cardRowPaddingY, paddingBottom: cardRowPaddingY }]}>
            <View style={[styles.cellHalf, { minHeight: minLineHeight }]}>
              <Text style={styles.bold}>Balance: KShs</Text>
            </View>
            <View style={[styles.cellHalf, { minHeight: minLineHeight }]}>
              <Text style={styles.bold}>Hostel fees: KShs</Text>
            </View>
          </View>
          <View style={[styles.cardRowLast, { paddingTop: cardRowPaddingY, paddingBottom: cardRowPaddingY }]}>
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

        {/* 2-6. OFFICIAL APPROVAL CARDS */}
        <ApprovalCardPdf
          num={2}
          title="HOD APPROVAL"
          approverLabel="Approved/not approved by: HOD:"
          cardMarginBottom={cardMarginBottom}
          cardRowPaddingY={cardRowPaddingY}
          minLineHeight={minLineHeight}
        />
        <ApprovalCardPdf
          num={3}
          title="HOSTEL ALLOCATION"
          approverLabel="Administrator:"
          cardMarginBottom={cardMarginBottom}
          cardRowPaddingY={cardRowPaddingY}
          minLineHeight={minLineHeight}
        />
        <ApprovalCardPdf
          num={4}
          title="REGISTRAR APPROVAL"
          approverLabel="REGISTRAR:"
          cardMarginBottom={cardMarginBottom}
          cardRowPaddingY={cardRowPaddingY}
          minLineHeight={minLineHeight}
        />
        <ApprovalCardPdf
          num={5}
          title="PRINCIPAL APPROVAL"
          approverLabel="PRINCIPAL:"
          cardMarginBottom={cardMarginBottom}
          cardRowPaddingY={cardRowPaddingY}
          minLineHeight={minLineHeight}
        />
        <ApprovalCardPdf
          num={6}
          title="MANAGING DIRECTOR APPROVAL"
          approverLabel="MANAGING DIRECTOR:"
          cardMarginBottom={cardMarginBottom}
          cardRowPaddingY={cardRowPaddingY}
          minLineHeight={minLineHeight}
        />

        {/* FOOTER */}
        <Text style={styles.footerText}>
          Form Ref: ICMHS/REG/2026/0482  |  This form should be filled in one copy and filed at the Registrar of Students.
        </Text>
      </Page>
    </Document>
  );
}

export async function buildStudentUnitRegistrationPdf(
  context: StudentPortalRegistrationContext,
): Promise<Buffer> {
  if (!context.period) {
    throw new Error('No active academic period is available.');
  }

  let logoDataUri: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png');
    const logoBuffer = await readFile(logoPath);
    logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch {
    logoDataUri = null;
  }

  return await renderToBuffer(
    <UnitRegistrationPdfDocument context={context} logoDataUri={logoDataUri} />,
  );
}
