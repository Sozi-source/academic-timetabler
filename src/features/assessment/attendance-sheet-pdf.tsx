import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';

import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';
import type {
  AttendanceSheetDocumentCandidate,
  AttendanceSheetDocumentData,
} from './attendance-sheet-docx';

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  pageLandscape: {
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 24,
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  pagePortrait: {
    paddingTop: 20,
    paddingBottom: 22,
    paddingHorizontal: 26,
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  headerContainer: {
    marginBottom: 6,
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    marginBottom: 3,
    objectFit: 'contain',
  },
  institutionName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#033B36',
    textAlign: 'center',
    marginBottom: 1.5,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 1.5,
    textTransform: 'uppercase',
  },
  academicPeriod: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 6,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  metaColumn: {
    flex: 1,
    gap: 1.5,
  },
  metaRow: {
    flexDirection: 'row',
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#334155',
    width: 68,
  },
  metaValue: {
    fontSize: 7,
    color: '#0f172a',
    flex: 1,
  },
  cohortBanner: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#033B36',
    backgroundColor: '#ecfdf5',
    borderWidth: 0.5,
    borderColor: '#a7f3d0',
    borderRadius: 2,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  table: {
    borderWidth: 0.75,
    borderColor: '#0f172a',
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 0.75,
    borderBottomColor: '#0f172a',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    minHeight: 14,
    alignItems: 'center',
  },
  tableRowLast: {
    flexDirection: 'row',
    minHeight: 14,
    alignItems: 'center',
  },
  thCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#0f172a',
    paddingVertical: 3,
    paddingHorizontal: 2,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#0f172a',
    justifyContent: 'center',
  },
  tdCell: {
    fontSize: 6.8,
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
    justifyContent: 'center',
  },
  cellNoBorderRight: {
    borderRightWidth: 0,
  },
  centerText: {
    textAlign: 'center',
  },
  boldText: {
    fontFamily: 'Helvetica-Bold',
  },
  examSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 0.75,
    borderColor: '#0f172a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 10,
    fontSize: 7.2,
    fontFamily: 'Helvetica-Bold',
  },
  signoffContainerLandscape: {
    marginTop: 8,
    gap: 7,
  },
  signoffRowLandscape: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 16,
  },
  signoffLabelLandscape: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#0f172a',
    width: 108,
  },
  signoffLineLandscapeName: {
    borderBottomWidth: 0.75,
    borderBottomColor: '#0f172a',
    width: 140,
    height: 14,
    paddingHorizontal: 2,
    justifyContent: 'flex-end',
  },
  signoffLabelComment: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#0f172a',
    width: 52,
    textAlign: 'right',
    paddingRight: 4,
  },
  signoffLineComment: {
    borderBottomWidth: 0.75,
    borderBottomColor: '#0f172a',
    flex: 1,
    height: 14,
    marginRight: 6,
  },
  signoffLabelSign: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#0f172a',
    width: 32,
    textAlign: 'right',
    paddingRight: 4,
  },
  signoffLineSign: {
    borderBottomWidth: 0.75,
    borderBottomColor: '#0f172a',
    width: 90,
    height: 14,
  },
  signoffContainerPortrait: {
    marginTop: 12,
    gap: 8,
  },
  signoffRowPortrait: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 16,
  },
  signoffLabelPortrait: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#0f172a',
    width: 78,
  },
  signoffLinePortraitName: {
    borderBottomWidth: 0.75,
    borderBottomColor: '#0f172a',
    width: 160,
    height: 14,
    paddingHorizontal: 2,
    justifyContent: 'flex-end',
  },
  signoffLabelPortraitSign: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#0f172a',
    width: 34,
    textAlign: 'right',
    paddingRight: 4,
  },
  signoffLinePortraitSign: {
    borderBottomWidth: 0.75,
    borderBottomColor: '#0f172a',
    width: 100,
    height: 14,
  },
  signoffLabelPortraitDate: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#0f172a',
    width: 34,
    textAlign: 'right',
    paddingRight: 4,
  },
  signoffLinePortraitDate: {
    borderBottomWidth: 0.75,
    borderBottomColor: '#0f172a',
    width: 80,
    height: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 8,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 6.8,
    color: '#64748b',
  },
});

export async function generateAttendanceSheetPdf(
  data: AttendanceSheetDocumentData,
): Promise<Buffer> {
  let logoDataUri: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'branding', 'icmhs-logo.png');
    const logoBuffer = await readFile(logoPath);
    logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch {
    logoDataUri = null;
  }

  const isClass = data.type === 'class';
  const isExam = data.type === 'exam';
  const heading = isClass
    ? 'CLASS ATTENDANCE LIST'
    : isExam
      ? 'FINAL EXAMINATION ATTENDANCE & SCRIPT REGISTER'
      : 'CONTINUOUS ASSESSMENT TEST (CAT) ATTENDANCE LIST';

  // Group candidates by cohort
  const cohortGroups = new Map<string, AttendanceSheetDocumentCandidate[]>();
  for (const cand of data.candidates) {
    const cName = cand.cohortName || data.cohortName || 'Cohort';
    if (!cohortGroups.has(cName)) {
      cohortGroups.set(cName, []);
    }
    cohortGroups.get(cName)!.push(cand);
  }

  const groups = Array.from(cohortGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cName, list]) => ({
      cohortName: cName,
      candidates: [...list].sort((first, second) =>
        compareAdmissionNumbers(first.admissionNumber, second.admissionNumber),
      ),
    }));

  if (groups.length === 0) {
    groups.push({
      cohortName: data.cohortName || 'Cohort',
      candidates: [],
    });
  }

  // Column width constants for Landscape Class Attendance
  const COL_CLASS_NO = 24;
  const COL_CLASS_ADM = 92;
  const COL_CLASS_NAME = 196;
  const COL_CLASS_SESSION = 59.5; // 8 sessions * 59.5 = 476. Total = 788pt

  // Column width constants for Portrait CAT / Exam Attendance
  const COL_EXAM_NO = 24;
  const COL_EXAM_ADM = 108;
  const COL_EXAM_NAME = 208;
  const COL_EXAM_BOOKLET = 86;
  const COL_EXAM_SIGN = 58;
  const COL_EXAM_DATE = 58; // Total = 542pt

  const COL_CAT_NO = 24;
  const COL_CAT_ADM = 112;
  const COL_CAT_NAME = 216;
  const COL_CAT_SIGN = 90;
  const COL_CAT_SCORE = 50;
  const COL_CAT_DATE = 50; // Total = 542pt

  const doc = (
    <Document
      title={`${data.unitName} - ${heading}`}
      author={data.institutionName}
      creator={data.institutionName}
    >
      {groups.map((group) => {
        return (
          <Page
            key={group.cohortName}
            size="A4"
            orientation={isClass ? 'landscape' : 'portrait'}
            style={isClass ? styles.pageLandscape : styles.pagePortrait}
          >
            {/* Header Block */}
            <View style={styles.headerContainer}>
              {logoDataUri ? (
                /* eslint-disable-next-line jsx-a11y/alt-text */
                <Image src={logoDataUri} style={styles.logo} />
              ) : null}
              <Text style={styles.institutionName}>{data.institutionName}</Text>
              <Text style={styles.heading}>{heading}</Text>
              <Text style={styles.academicPeriod}>{data.academicPeriodName}</Text>
            </View>

            {/* Department & Unit Metadata */}
            <View style={styles.metaContainer}>
              <View style={styles.metaColumn}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>School:</Text>
                  <Text style={styles.metaValue}>{data.schoolName}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Department:</Text>
                  <Text style={styles.metaValue}>{data.departmentName}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Programme:</Text>
                  <Text style={styles.metaValue}>{data.programmeName}</Text>
                </View>
              </View>

              <View style={styles.metaColumn}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Unit:</Text>
                  <Text style={styles.metaValue}>{data.unitCode} - {data.unitName}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Cohort:</Text>
                  <Text style={styles.metaValue}>{group.cohortName}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Trainer:</Text>
                  <Text style={styles.metaValue}>{data.trainerName || 'Departmental Staff'}</Text>
                </View>
                {data.venueName ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Venue:</Text>
                    <Text style={styles.metaValue}>{data.venueName}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Multi-Cohort Distinction Banner if multiple cohorts present */}
            {groups.length > 1 ? (
              <View style={styles.cohortBanner}>
                <Text>
                  REGISTER FOR COHORT: {group.cohortName} ({group.candidates.length} Registered Students)
                </Text>
              </View>
            ) : null}

            {/* Attendance Table */}
            <View style={styles.table}>
              {/* Header Row */}
              {isClass ? (
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.thCell, { width: COL_CLASS_NO }]}>
                    <Text>No.</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_CLASS_ADM }]}>
                    <Text>Admission No.</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_CLASS_NAME }]}>
                    <Text>Candidate&apos;s Full Name</Text>
                  </View>
                  {Array.from({ length: 8 }, (_, s) => (
                    <View
                      key={s}
                      style={[
                        styles.thCell,
                        { width: COL_CLASS_SESSION },
                        s === 7 ? styles.cellNoBorderRight : {},
                      ]}
                    >
                      <Text>Session {s + 1}</Text>
                      <Text style={{ fontSize: 5.5, color: '#64748b' }}>Date: _____</Text>
                    </View>
                  ))}
                </View>
              ) : isExam ? (
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.thCell, { width: COL_EXAM_NO }]}>
                    <Text>No.</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_EXAM_ADM }]}>
                    <Text>Admission No.</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_EXAM_NAME }]}>
                    <Text>Candidate&apos;s Full Name</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_EXAM_BOOKLET }]}>
                    <Text>Booklet No.</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_EXAM_SIGN }]}>
                    <Text>Sign</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_EXAM_DATE }, styles.cellNoBorderRight]}>
                    <Text>Date</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.thCell, { width: COL_CAT_NO }]}>
                    <Text>No.</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_CAT_ADM }]}>
                    <Text>Admission No.</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_CAT_NAME }]}>
                    <Text>Candidate&apos;s Full Name</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_CAT_SIGN }]}>
                    <Text>Sign</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_CAT_SCORE }]}>
                    <Text>Score</Text>
                  </View>
                  <View style={[styles.thCell, { width: COL_CAT_DATE }, styles.cellNoBorderRight]}>
                    <Text>Date</Text>
                  </View>
                </View>
              )}

              {/* Student Candidate Rows */}
              {group.candidates.map((cand, idx) => {
                if (isClass) {
                  return (
                    <View key={cand.studentId} style={styles.tableRow}>
                      <View style={[styles.tdCell, { width: COL_CLASS_NO }]}>
                        <Text style={styles.centerText}>{idx + 1}.</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_CLASS_ADM }]}>
                        <Text style={styles.boldText}>{cand.admissionNumber}</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_CLASS_NAME }]}>
                        <Text>{cand.fullName}</Text>
                      </View>
                      {Array.from({ length: 8 }, (_, s) => (
                        <View
                          key={s}
                          style={[
                            styles.tdCell,
                            { width: COL_CLASS_SESSION },
                            s === 7 ? styles.cellNoBorderRight : {},
                          ]}
                        >
                          <Text>&nbsp;</Text>
                        </View>
                      ))}
                    </View>
                  );
                }

                if (isExam) {
                  return (
                    <View key={cand.studentId} style={styles.tableRow}>
                      <View style={[styles.tdCell, { width: COL_EXAM_NO }]}>
                        <Text style={styles.centerText}>{idx + 1}.</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_ADM }]}>
                        <Text style={styles.boldText}>{cand.admissionNumber}</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_NAME }]}>
                        <Text>{cand.fullName}</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_BOOKLET }]}>
                        <Text>&nbsp;</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_SIGN }]}>
                        <Text>&nbsp;</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_DATE }, styles.cellNoBorderRight]}>
                        <Text>&nbsp;</Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={cand.studentId} style={styles.tableRow}>
                    <View style={[styles.tdCell, { width: COL_CAT_NO }]}>
                      <Text style={styles.centerText}>{idx + 1}.</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_ADM }]}>
                      <Text style={styles.boldText}>{cand.admissionNumber}</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_NAME }]}>
                      <Text>{cand.fullName}</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_SIGN }]}>
                      <Text>&nbsp;</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_SCORE }]}>
                      <Text>&nbsp;</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_DATE }, styles.cellNoBorderRight]}>
                      <Text>&nbsp;</Text>
                    </View>
                  </View>
                );
              })}

              {/* 4 Blank Candidate Entry Rows */}
              {Array.from({ length: 4 }, (_, bIdx) => {
                const rowNum = group.candidates.length + bIdx + 1;
                const isLast = bIdx === 3;
                const rowStyle = isLast ? styles.tableRowLast : styles.tableRow;

                if (isClass) {
                  return (
                    <View key={`blank-${bIdx}`} style={rowStyle}>
                      <View style={[styles.tdCell, { width: COL_CLASS_NO }]}>
                        <Text style={styles.centerText}>{rowNum}.</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_CLASS_ADM }]}>
                        <Text>&nbsp;</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_CLASS_NAME }]}>
                        <Text>&nbsp;</Text>
                      </View>
                      {Array.from({ length: 8 }, (_, s) => (
                        <View
                          key={s}
                          style={[
                            styles.tdCell,
                            { width: COL_CLASS_SESSION },
                            s === 7 ? styles.cellNoBorderRight : {},
                          ]}
                        >
                          <Text>&nbsp;</Text>
                        </View>
                      ))}
                    </View>
                  );
                }

                if (isExam) {
                  return (
                    <View key={`blank-${bIdx}`} style={rowStyle}>
                      <View style={[styles.tdCell, { width: COL_EXAM_NO }]}>
                        <Text style={styles.centerText}>{rowNum}.</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_ADM }]}>
                        <Text>&nbsp;</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_NAME }]}>
                        <Text>&nbsp;</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_BOOKLET }]}>
                        <Text>&nbsp;</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_SIGN }]}>
                        <Text>&nbsp;</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_DATE }, styles.cellNoBorderRight]}>
                        <Text>&nbsp;</Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={`blank-${bIdx}`} style={rowStyle}>
                    <View style={[styles.tdCell, { width: COL_CAT_NO }]}>
                      <Text style={styles.centerText}>{rowNum}.</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_ADM }]}>
                      <Text>&nbsp;</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_NAME }]}>
                      <Text>&nbsp;</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_SIGN }]}>
                      <Text>&nbsp;</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_SCORE }]}>
                      <Text>&nbsp;</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_DATE }, styles.cellNoBorderRight]}>
                      <Text>&nbsp;</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Exam Script Count Summary Box */}
            {isExam ? (
              <View style={styles.examSummaryBox}>
                <Text>Total Registered Candidates: {group.candidates.length}</Text>
                <Text>Total Scripts Collected: ___________</Text>
                <Text>Total Absent Candidates: ___________</Text>
              </View>
            ) : null}

            {/* Official Sign-off Footer */}
            {isClass ? (
              <View style={styles.signoffContainerLandscape}>
                {/* Row 1: Class Representative */}
                <View style={styles.signoffRowLandscape}>
                  <Text style={styles.signoffLabelLandscape}>Class Representative:</Text>
                  <View style={styles.signoffLineLandscapeName} />
                  <Text style={styles.signoffLabelComment}>Comment:</Text>
                  <View style={styles.signoffLineComment} />
                  <Text style={styles.signoffLabelSign}>Sign:</Text>
                  <View style={styles.signoffLineSign} />
                </View>

                {/* Row 2: Trainer */}
                <View style={styles.signoffRowLandscape}>
                  <Text style={styles.signoffLabelLandscape}>Trainer:</Text>
                  <View style={styles.signoffLineLandscapeName}>
                    <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }}>
                      {data.trainerName || ''}
                    </Text>
                  </View>
                  <Text style={styles.signoffLabelComment}>Comment:</Text>
                  <View style={styles.signoffLineComment} />
                  <Text style={styles.signoffLabelSign}>Sign:</Text>
                  <View style={styles.signoffLineSign} />
                </View>

                {/* Row 3: HOD */}
                <View style={styles.signoffRowLandscape}>
                  <Text style={styles.signoffLabelLandscape}>HOD:</Text>
                  <View style={styles.signoffLineLandscapeName} />
                  <Text style={styles.signoffLabelComment}>Comment:</Text>
                  <View style={styles.signoffLineComment} />
                  <Text style={styles.signoffLabelSign}>Sign:</Text>
                  <View style={styles.signoffLineSign} />
                </View>
              </View>
            ) : (
              <View style={styles.signoffContainerPortrait}>
                {/* Row 1: Invigilator */}
                <View style={styles.signoffRowPortrait}>
                  <Text style={styles.signoffLabelPortrait}>Invigilator:</Text>
                  <View style={styles.signoffLinePortraitName} />
                  <Text style={styles.signoffLabelPortraitSign}>Sign:</Text>
                  <View style={styles.signoffLinePortraitSign} />
                  <Text style={styles.signoffLabelPortraitDate}>Date:</Text>
                  <View style={styles.signoffLinePortraitDate} />
                </View>

                {/* Row 2: Examiner */}
                <View style={styles.signoffRowPortrait}>
                  <Text style={styles.signoffLabelPortrait}>Examiner:</Text>
                  <View style={styles.signoffLinePortraitName}>
                    <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }}>
                      {data.trainerName || ''}
                    </Text>
                  </View>
                  <Text style={styles.signoffLabelPortraitSign}>Sign:</Text>
                  <View style={styles.signoffLinePortraitSign} />
                  <Text style={styles.signoffLabelPortraitDate}>Date:</Text>
                  <View style={styles.signoffLinePortraitDate} />
                </View>

                {/* Row 3: Exam Officer */}
                <View style={styles.signoffRowPortrait}>
                  <Text style={styles.signoffLabelPortrait}>Exam Officer:</Text>
                  <View style={styles.signoffLinePortraitName} />
                  <Text style={styles.signoffLabelPortraitSign}>Sign:</Text>
                  <View style={styles.signoffLinePortraitSign} />
                  <Text style={styles.signoffLabelPortraitDate}>Date:</Text>
                  <View style={styles.signoffLinePortraitDate} />
                </View>
              </View>
            )}

            {/* Page Numbering Footer */}
            <Text
              style={styles.footer}
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
              fixed
            />
          </Page>
        );
      })}
    </Document>
  );

  return Buffer.from(await renderToBuffer(doc));
}
