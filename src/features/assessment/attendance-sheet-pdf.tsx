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
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  pagePortrait: {
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 16,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#1e293b',
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
    color: '#1e293b',
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
    borderWidth: 0.75,
    borderColor: '#64748b',
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
    fontSize: 8,
    color: '#334155',
    width: 68,
  },
  metaValue: {
    fontSize: 8,
    color: '#1e293b',
    flex: 1,
  },
  cohortBanner: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#033B36',
    backgroundColor: '#ecfdf5',
    borderWidth: 0.75,
    borderColor: '#6ee7b7',
    borderRadius: 2,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  table: {
    borderWidth: 1,
    borderColor: '#475569',
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#475569',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.75,
    borderBottomColor: '#64748b',
    minHeight: 22,
    alignItems: 'center',
  },
  tableRowLast: {
    flexDirection: 'row',
    minHeight: 22,
    alignItems: 'center',
  },
  thCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: '#1e293b',
    paddingVertical: 4,
    paddingHorizontal: 3,
    textAlign: 'center',
    borderRightWidth: 0.75,
    borderRightColor: '#64748b',
    justifyContent: 'center',
  },
  tdCell: {
    fontSize: 11,
    color: '#1e293b',
    paddingVertical: 3.5,
    paddingHorizontal: 4,
    borderRightWidth: 0.75,
    borderRightColor: '#64748b',
    justifyContent: 'center',
  },
  cellNoBorderRight: {
    borderRightWidth: 0,
  },
  classDateHeader: {
    fontSize: 7,
    textAlign: 'left',
    paddingLeft: 2,
    color: '#334155',
  },
  centerText: {
    textAlign: 'center',
  },
  boldText: {
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  examSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#64748b',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 10,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  signoffContainerLandscape: {
    marginTop: 8,
    gap: 7,
  },
  signoffRowLandscape: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 18,
  },
  signoffLabelLandscape: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#1e293b',
    width: 112,
  },
  signoffLineLandscapeName: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    width: 140,
    height: 16,
    paddingHorizontal: 2,
    justifyContent: 'flex-end',
  },
  signoffLabelComment: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#1e293b',
    width: 52,
    textAlign: 'right',
    paddingRight: 4,
  },
  signoffLineComment: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    flex: 1,
    height: 16,
    marginRight: 6,
  },
  signoffLabelSign: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#1e293b',
    width: 32,
    textAlign: 'right',
    paddingRight: 4,
  },
  signoffLineSign: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    width: 90,
    height: 16,
  },
  signoffContainerPortrait: {
    marginTop: 12,
    gap: 8,
  },
  signoffRowPortrait: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 18,
  },
  signoffLabelPortrait: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#1e293b',
    width: 82,
  },
  signoffLinePortraitName: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    width: 160,
    height: 16,
    paddingHorizontal: 2,
    justifyContent: 'flex-end',
  },
  signoffLabelPortraitSign: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#1e293b',
    width: 34,
    textAlign: 'right',
    paddingRight: 4,
  },
  signoffLinePortraitSign: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    width: 100,
    height: 16,
  },
  signoffLabelPortraitDate: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#1e293b',
    width: 34,
    textAlign: 'right',
    paddingRight: 4,
  },
  signoffLinePortraitDate: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    width: 80,
    height: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 8,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 7.5,
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

  // Column width constants for Landscape Class Attendance (Total: 808pt)
  const COL_CLASS_NO = 24;
  const COL_CLASS_ADM = 144;
  const COL_CLASS_NAME = 208;
  const COL_CLASS_SESSION = 54; // 8 sessions * 54 = 432. Total = 808pt

  // Column width constants for Portrait CAT / Exam Attendance (Total: 562pt)
  const COL_EXAM_NO = 24;
  const COL_EXAM_ADM = 140;
  const COL_EXAM_NAME = 196;
  const COL_EXAM_BOOKLET = 68;
  const COL_EXAM_SIGN = 67;
  const COL_EXAM_DATE = 67; // Total = 562pt

  const COL_CAT_NO = 24;
  const COL_CAT_ADM = 140;
  const COL_CAT_NAME = 210;
  const COL_CAT_SIGN = 76;
  const COL_CAT_SCORE = 56;
  const COL_CAT_DATE = 56; // Total = 562pt

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

            {/* Notice if no pre-registered students found */}
            {group.candidates.length === 0 ? (
              <View style={[styles.cohortBanner, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                <Text style={{ color: '#92400e' }}>
                  CLASS REGISTER (MANUAL ENTRY): No pre-registered student records were found in the system for this cohort. Use the manual rows below to record attending students.
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
                      <Text style={styles.classDateHeader}>Date: ____</Text>
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
                    <View key={cand.studentId} wrap={false} style={styles.tableRow}>
                      <View style={[styles.tdCell, { width: COL_CLASS_NO }]}>
                        <Text style={styles.centerText}>{idx + 1}.</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_CLASS_ADM }]}>
                        <Text wrap={false} style={styles.boldText}>{cand.admissionNumber}</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_CLASS_NAME }]}>
                        <Text wrap={false}>{cand.fullName}</Text>
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
                    <View key={cand.studentId} wrap={false} style={styles.tableRow}>
                      <View style={[styles.tdCell, { width: COL_EXAM_NO }]}>
                        <Text style={styles.centerText}>{idx + 1}.</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_ADM }]}>
                        <Text wrap={false} style={styles.boldText}>{cand.admissionNumber}</Text>
                      </View>
                      <View style={[styles.tdCell, { width: COL_EXAM_NAME }]}>
                        <Text wrap={false}>{cand.fullName}</Text>
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
                  <View key={cand.studentId} wrap={false} style={styles.tableRow}>
                    <View style={[styles.tdCell, { width: COL_CAT_NO }]}>
                      <Text style={styles.centerText}>{idx + 1}.</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_ADM }]}>
                      <Text wrap={false} style={styles.boldText}>{cand.admissionNumber}</Text>
                    </View>
                    <View style={[styles.tdCell, { width: COL_CAT_NAME }]}>
                      <Text wrap={false}>{cand.fullName}</Text>
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

              {/* Blank Candidate Entry Rows: 25 rows for manual entry if empty, else 4 buffer rows */}
              {(() => {
                const blankCount = group.candidates.length === 0 ? 25 : 4;
                return Array.from({ length: blankCount }, (_, bIdx) => {
                  const rowNum = group.candidates.length + bIdx + 1;
                  const isLast = bIdx === blankCount - 1;
                  const rowStyle = isLast ? styles.tableRowLast : styles.tableRow;

                if (isClass) {
                  return (
                    <View key={`blank-${bIdx}`} wrap={false} style={rowStyle}>
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
                    <View key={`blank-${bIdx}`} wrap={false} style={rowStyle}>
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
                  <View key={`blank-${bIdx}`} wrap={false} style={rowStyle}>
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
              });
            })()}
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
