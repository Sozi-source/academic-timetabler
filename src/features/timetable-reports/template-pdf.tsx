import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

import type {
  TimetableReportGroup,
  TimetableReportRow,
  TimetableReportsData,
} from './types';
import { getMasterSessionPresentation } from './master-presentation';

Font.registerHyphenationCallback((word) => [word]);

const INSTITUTION_NAME = 'IMPERIAL COLLEGE OF MEDICAL & HEALTH SCIENCES';
const MASTER_INSTITUTION_NAME = 'IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES';

const standardSlots = [
  { key: 'morning', label: '8:00 AM - 10:00 AM', startsAt: '08:00', endsAt: '10:00' },
  { key: 'mid-morning', label: '10:30 AM - 12:30 PM', startsAt: '10:30', endsAt: '12:30' },
  { key: 'afternoon', label: '2:00 PM - 4:00 PM', startsAt: '14:00', endsAt: '16:00' },
] as const;

const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function minutes(value: string) {
  const [hours, mins] = value.slice(0, 5).split(':').map(Number);
  return (hours * 60) + mins;
}

function overlapsSlot(
  row: TimetableReportRow,
  slot: (typeof standardSlots)[number],
) {
  return minutes(row.startsAt) < minutes(slot.endsAt)
    && minutes(row.endsAt) > minutes(slot.startsAt);
}

function cohortCodes(row: TimetableReportRow) {
  const codes = row.participantCohorts.map((cohort) => cohort.code);
  return codes.length > 0 ? codes : [row.cohort];
}

function rowsForCohort(
  rows: TimetableReportRow[],
  cohortCode: string,
  day: string,
) {
  return rows.filter((row) => (
    row.day.toLowerCase() === day.toLowerCase()
    && cohortCodes(row).includes(cohortCode)
  ));
}

function departmentHeading(departmentName: string) {
  const normalized = departmentName.trim();
  return /department$/i.test(normalized)
    ? normalized
    : `${normalized} Department`;
}

function masterCellRows(
  rows: TimetableReportRow[],
  slot: (typeof standardSlots)[number],
) {
  return rows.filter((row) => overlapsSlot(row, slot));
}

const masterStyles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingRight: 25,
    paddingBottom: 28,
    paddingLeft: 25,
    fontFamily: 'Times-Roman',
    fontSize: 7.2,
    color: '#111827',
  },
  institution: {
    color: '#17365D',
    fontFamily: 'Times-Bold',
    fontSize: 12.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  department: {
    marginTop: 4,
    color: '#8A001C',
    fontFamily: 'Times-Bold',
    fontSize: 11,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 3,
    fontFamily: 'Times-Bold',
    fontSize: 11.5,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 3,
    marginBottom: 10,
    fontSize: 7.5,
    textAlign: 'center',
  },
  table: {
    borderTopWidth: 0.75,
    borderLeftWidth: 0.75,
    borderColor: '#111827',
  },
  row: {
    flexDirection: 'row',
  },
  heading: {
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    backgroundColor: '#8A001C',
    color: '#FFFFFF',
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: '#111827',
    fontFamily: 'Times-Bold',
    fontSize: 7.5,
    textAlign: 'center',
  },
  dayHeading: {
    minHeight: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DCEAF3',
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: '#111827',
    fontFamily: 'Times-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  cell: {
    justifyContent: 'center',
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: '#111827',
  },
  cohortCell: {
    backgroundColor: '#EAF2F8',
    fontFamily: 'Times-Bold',
    fontSize: 6.2,
    textAlign: 'center',
    alignItems: 'center',
  },
  sessionCell: {
    textAlign: 'center',
    alignItems: 'center',
  },
  unit: {
    fontFamily: 'Times-Bold',
    fontSize: 6.8,
    lineHeight: 1.1,
  },
  trainer: {
    marginTop: 1.5,
    fontSize: 5.6,
    lineHeight: 1.1,
  },
  venue: {
    marginTop: 1,
    color: '#475569',
    fontFamily: 'Times-Italic',
    fontSize: 5.2,
    lineHeight: 1.05,
  },
  unassigned: {
    marginTop: 1,
    paddingHorizontal: 2,
    paddingVertical: 0.5,
    backgroundColor: '#FFF200',
    color: '#991B1B',
    fontFamily: 'Times-Bold',
    fontSize: 5.5,
  },
  separator: {
    marginVertical: 1,
    width: '80%',
    borderTopWidth: 0.4,
    borderColor: '#94A3B8',
  },
  footer: {
    position: 'absolute',
    bottom: 13,
    left: 25,
    right: 25,
    color: '#475569',
    fontSize: 6.8,
    textAlign: 'center',
  },
});

const personalStyles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingRight: 30,
    paddingBottom: 42,
    paddingLeft: 30,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#000000',
  },
  institution: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    textAlign: 'center',
  },
  title: {
    marginTop: 5,
    marginBottom: 18,
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
  },
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000000',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  meta: {
    minHeight: 42,
    justifyContent: 'center',
    lineHeight: 1.45,
  },
  dayHeader: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  timeHeader: {
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textAlign: 'center',
  },
  dayCell: {
    minHeight: 101,
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  department: {
    marginTop: 2,
    color: '#8A001C',
    fontSize: 6.6,
  },
  personalVenue: {
    marginTop: 1.5,
    color: '#475569',
    fontFamily: 'Helvetica-Oblique',
    fontSize: 6.4,
  },
  sessionCell: {
    minHeight: 101,
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    lineHeight: 1.3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  separator: {
    marginVertical: 4,
    width: '80%',
    borderTopWidth: 0.5,
    borderColor: '#64748B',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 30,
    right: 30,
    fontSize: 7,
    textAlign: 'center',
  },
});

function MasterSessionCell({
  rows,
  rowHeight,
  width = '25.5%',
}: {
  rows: TimetableReportRow[];
  rowHeight: number;
  width?: string;
}) {
  if (rows.length === 0) {
    return <View style={[masterStyles.cell, masterStyles.sessionCell, { width, height: rowHeight }]} />;
  }

  return (
    <View style={[masterStyles.cell, masterStyles.sessionCell, { width, height: rowHeight }]}>
      {rows.map((row, index) => {
        const presentation = getMasterSessionPresentation(row);

        return (
          <View key={row.sessionId} style={{ alignItems: 'center', width: '100%' }}>
            {index > 0 ? <View style={masterStyles.separator} /> : null}
            <Text style={masterStyles.unit}>{presentation.unitName}</Text>
            <Text style={row.trainerId ? masterStyles.trainer : masterStyles.unassigned}>
              Trainer: {presentation.trainer}
            </Text>
            <Text style={masterStyles.venue}>Venue: {presentation.venue}</Text>
          </View>
        );
      })}
    </View>
  );
}

function MasterTimetable({
  data,
  departmentName,
  periodLabel,
}: {
  data: TimetableReportsData;
  departmentName: string;
  periodLabel: string;
}) {
  const cohortCodesForReport = Array.from(new Set(
    data.rows.flatMap(cohortCodes),
  )).sort((left, right) => left.localeCompare(right));
  const rowHeight = Math.max(
    20,
    Math.min(35, 560 / Math.max(cohortCodesForReport.length, 1)),
  );

  return (
    <Document title={`${departmentName} Department Master Timetable`}>
      {weekdayNames.map((day) => (
        <Page key={day} size="A4" orientation="portrait" style={masterStyles.page}>
          <Text style={masterStyles.institution}>{MASTER_INSTITUTION_NAME}</Text>
          <Text style={masterStyles.department}>{departmentHeading(departmentName)}</Text>
          <Text style={masterStyles.title}>DEPARTMENT MASTER TIMETABLE</Text>
          <Text style={masterStyles.subtitle}>{periodLabel} - based on the current Units on Offer</Text>

          <View style={masterStyles.table}>
            <View style={masterStyles.row}>
              <View style={[masterStyles.heading, { width: '8%' }]}><Text>DAY</Text></View>
              <View style={[masterStyles.heading, { width: '15.5%' }]}><Text>COHORT</Text></View>
              {standardSlots.map((slot) => (
                <View key={slot.key} style={[masterStyles.heading, { width: '25.5%' }]}>
                  <Text>{slot.label}</Text>
                </View>
              ))}
            </View>
            <View style={masterStyles.row} wrap={false}>
              <View style={[
                masterStyles.cell,
                masterStyles.cohortCell,
                {
                  width: '8%',
                  height: rowHeight * cohortCodesForReport.length,
                },
              ]}>
                <Text>{day.toUpperCase()}</Text>
              </View>
              <View style={{ width: '92%' }}>
                {cohortCodesForReport.map((cohortCode) => {
                  const cohortRows = rowsForCohort(data.rows, cohortCode, day);
                  return (
                    <View key={`${day}-${cohortCode}`} style={masterStyles.row} wrap={false}>
                      <View style={[
                        masterStyles.cell,
                        masterStyles.cohortCell,
                        { width: '16.8478%', height: rowHeight },
                      ]}>
                        <Text>{cohortCode}</Text>
                      </View>
                      {standardSlots.map((slot) => (
                        <MasterSessionCell
                          key={slot.key}
                          rows={masterCellRows(cohortRows, slot)}
                          rowHeight={rowHeight}
                          width="27.7174%"
                        />
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <Text style={masterStyles.footer} fixed>
            Departmental Timetable - Rooms to be allocated after approval
          </Text>
        </Page>
      ))}
    </Document>
  );
}

function PersonalSessionCell({ rows }: { rows: TimetableReportRow[] }) {
  return (
    <View style={[personalStyles.cell, personalStyles.sessionCell, { width: '29.5%' }]}>
      {rows.map((row, index) => (
        <View key={row.sessionId} style={{ alignItems: 'center', width: '100%' }}>
          {index > 0 ? <View style={personalStyles.separator} /> : null}
          <Text>{row.unitCode} - {row.unitName}</Text>
          <Text>({cohortCodes(row).join(' + ')})</Text>
          {row.departmentName ? (
            <Text style={personalStyles.department}>
              {row.departmentCode ? `${row.departmentCode} - ` : ''}{row.departmentName}
            </Text>
          ) : null}
          <Text style={personalStyles.personalVenue}>
            Venue: {row.roomCode ? row.roomName || row.roomCode : 'Unallocated'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PersonalPage({
  group,
  periodLabel,
  generatedOn,
}: {
  group: TimetableReportGroup;
  periodLabel: string;
  generatedOn: string;
}) {
  return (
    <Page size="A4" orientation="portrait" style={personalStyles.page}>
      <Text style={personalStyles.institution}>{INSTITUTION_NAME}</Text>
      <Text style={personalStyles.title}>PERSONAL TIMETABLE</Text>

      <View style={personalStyles.table}>
        <View style={personalStyles.row}>
          <View style={[personalStyles.cell, personalStyles.dayHeader, { width: '11.5%' }]}>
            <Text>DAY</Text>
          </View>
          <View style={[personalStyles.cell, personalStyles.meta, { width: '88.5%' }]}>
            <Text><Text style={personalStyles.metaLabel}>NAME: </Text>{group.label.toUpperCase()}</Text>
            <Text><Text style={personalStyles.metaLabel}>HOURS: </Text>{group.contactHours} HOURS</Text>
            <Text><Text style={personalStyles.metaLabel}>SEMESTER: </Text>{periodLabel.toUpperCase()}</Text>
          </View>
        </View>
        <View style={personalStyles.row}>
          <View style={[personalStyles.cell, personalStyles.timeHeader, { width: '11.5%' }]} />
          {standardSlots.map((slot) => (
            <View key={slot.key} style={[personalStyles.cell, personalStyles.timeHeader, { width: '29.5%' }]}>
              <Text>{slot.label}</Text>
            </View>
          ))}
        </View>
        {weekdayNames.map((day) => {
          const dayRows = group.rows.filter((row) => row.day.toLowerCase() === day.toLowerCase());
          return (
            <View key={day} style={personalStyles.row} wrap={false}>
              <View style={[personalStyles.cell, personalStyles.dayCell, { width: '11.5%' }]}>
                <Text>{day}</Text>
              </View>
              {standardSlots.map((slot) => (
                <PersonalSessionCell
                  key={slot.key}
                  rows={masterCellRows(dayRows, slot)}
                />
              ))}
            </View>
          );
        })}
      </View>

      <Text style={personalStyles.footer} fixed>
        Generated: {generatedOn} | {INSTITUTION_NAME}
      </Text>
    </Page>
  );
}

function PersonalTimetables({
  data,
  periodLabel,
  generatedOn,
}: {
  data: TimetableReportsData;
  periodLabel: string;
  generatedOn: string;
}) {
  return (
    <Document title={`Personal Timetables - ${periodLabel}`}>
      {data.byTrainer.map((group) => (
        <PersonalPage
          key={group.key}
          group={group}
          periodLabel={periodLabel}
          generatedOn={generatedOn}
        />
      ))}
    </Document>
  );
}

export function TimetableTemplateDocument({
  report,
  data,
  departmentName,
  periodLabel,
  generatedOn,
}: {
  report: 'master' | 'trainer';
  data: TimetableReportsData;
  departmentName: string;
  periodLabel: string;
  generatedOn: string;
}) {
  if (report === 'trainer') {
    return (
      <PersonalTimetables
        data={data}
        periodLabel={periodLabel}
        generatedOn={generatedOn}
      />
    );
  }

  return (
    <MasterTimetable
      data={data}
      departmentName={departmentName}
      periodLabel={periodLabel}
    />
  );
}
