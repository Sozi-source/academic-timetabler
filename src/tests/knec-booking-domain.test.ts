import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildStudentKnecBookingPdf } from '@/features/knec/booking-pdf';
import {
  canonicalKnecTrackLabel,
  deriveStudentKnecProgress,
  parseBookedPapersByModule,
  parseHistoricalProgressSheetRow,
  parseModuleTokenList,
} from '@/features/knec/domain';
import { parseKnecIndexImportFile } from '@/features/knec/index-import';
import type { KnecBookingFormContext, KnecModuleItem } from '@/features/knec/types';
import { getMissingKnecBiodataFields, studentProfileSchema } from '@/features/student-portal/profile';

const sampleCertMod1: KnecModuleItem = {
  id: 'm-1905-1',
  courseFamily: '1905',
  moduleCode: '1905/1',
  moduleNumber: 1,
  title: 'Certificate in Nutrition and Dietetics - Module I',
  sequenceOrder: 1,
  requirementRole: 'prerequisite_cert',
  papers: [
    {
      id: 'p-101',
      moduleId: 'm-1905-1',
      moduleCode: '1905/1',
      paperCode: '1905/101',
      paperNumber: '101',
      paperName: 'ICT, Mathematics and Entrepreneurship',
      paperType: 'theory',
      sortOrder: 1,
    },
    {
      id: 'p-102',
      moduleId: 'm-1905-1',
      moduleCode: '1905/1',
      paperCode: '1905/102',
      paperNumber: '102',
      paperName: 'Applied Sciences and Anatomy',
      paperType: 'theory',
      sortOrder: 2,
    },
  ],
};

const sampleCertMod2: KnecModuleItem = {
  id: 'm-1905-2',
  courseFamily: '1905',
  moduleCode: '1905/2',
  moduleNumber: 2,
  title: 'Certificate in Nutrition and Dietetics - Module II',
  sequenceOrder: 2,
  requirementRole: 'prerequisite_cert',
  papers: [
    {
      id: 'p-201',
      moduleId: 'm-1905-2',
      moduleCode: '1905/2',
      paperCode: '1905/201',
      paperNumber: '201',
      paperName: 'Communication Skills',
      paperType: 'theory',
      sortOrder: 1,
    },
    {
      id: 'p-207',
      moduleId: 'm-1905-2',
      moduleCode: '1905/2',
      paperCode: '1905/207',
      paperNumber: '207',
      paperName: 'Trade Project',
      paperType: 'trade_project',
      sortOrder: 7,
    },
  ],
};

const sampleDipMod2: KnecModuleItem = {
  id: 'm-2916-2',
  courseFamily: '2916',
  moduleCode: '2916/2',
  moduleNumber: 2,
  title: 'Diploma in Nutrition and Dietetics - Module II',
  sequenceOrder: 4,
  requirementRole: 'transition_core',
  papers: [
    {
      id: 'p-2916-201',
      moduleId: 'm-2916-2',
      moduleCode: '2916/2',
      paperCode: '2916/201',
      paperNumber: '201',
      paperName: 'Basic Biochemistry',
      paperType: 'theory',
      sortOrder: 1,
    },
  ],
};

describe('KNEC Booking Engine & Progression Domain', () => {
  it('groups equivalent programmes CHN/CND, DHN/DND, and DHNT/DNDT transition tracks', () => {
    expect(canonicalKnecTrackLabel('CHN')).toBe(canonicalKnecTrackLabel('CND'));
    expect(canonicalKnecTrackLabel('DHN')).toBe(canonicalKnecTrackLabel('DND'));
    expect(canonicalKnecTrackLabel('DHNT')).toBe(canonicalKnecTrackLabel('DNDT'));
    expect(canonicalKnecTrackLabel('DNDT')).toContain('1905 Cert Modules + 2916 Mod II & III');
  });

  it('parses module tokens with resit tags and grouped paper codes including 207/307 trade projects', () => {
    expect(parseModuleTokenList('1905/1 (resit); 1905/2')).toEqual([
      { moduleCode: '1905/1', isResit: true },
      { moduleCode: '1905/2', isResit: false },
    ]);

    expect(
      parseBookedPapersByModule('1905/1: 102; 1905/2: 201,202,203,204,205,206,207'),
    ).toEqual({
      '1905/1': ['1905/102'],
      '1905/2': ['1905/201', '1905/202', '1905/203', '1905/204', '1905/205', '1905/206', '1905/207'],
    });

    const parsed = parseHistoricalProgressSheetRow([
      '232',
      'LAGAT, SANDRA CHEROTICH',
      'DHNT/S-6656/IC/25',
      'DHNT',
      'DHNT SEP 25',
      'On attachment',
      '1905/1; 1905/2; 2916/2; 2916/3',
      '1905/1; 1905/2; 2916/2; 2916/3',
      '4',
      '1905/1; 1905/2',
      '2916/2; 2916/3',
      '1905/1: 102; 1905/2: 201,202,203,204,205,206,207',
      'Not yet registered',
    ]);

    expect(parsed?.programmeCode).toBe('DHNT');
    expect(parsed?.registeredNov2026Modules).toEqual(['1905/1', '1905/2']);
    expect(parsed?.nov2026PapersByModule['1905/1']).toEqual(['1905/102']);
    expect(parsed?.nov2026PapersByModule['1905/2']).toContain('1905/207');
  });

  it('transitions module status from pending/resit -> booked -> completed as results arrive', () => {
    const progressWithResults = deriveStudentKnecProgress({
      modules: [sampleCertMod1, sampleCertMod2, sampleDipMod2],
      storedStatuses: [
        {
          moduleId: 'm-1905-1',
          status: 'resit',
          completionSource: 'historical_import',
          completedSeriesName: null,
          resitPaperCodes: ['1905/102'],
          notes: null,
        },
        {
          moduleId: 'm-1905-2',
          status: 'completed',
          completionSource: 'historical_import',
          completedSeriesName: 'July 2026',
          resitPaperCodes: [],
          notes: null,
        },
      ],
      bookings: [
        {
          id: 'b-1',
          studentId: 'stu-1',
          seriesId: 'ser-1',
          seriesName: 'November 2026',
          seriesCode: 'NOV-2026',
          seriesYear: 2026,
          seriesMonth: 'November',
          seriesStatus: 'results_released',
          knecIndexNumber: '40210045012',
          bookingType: 'resit',
          bookingStatus: 'results_recorded',
          clearanceRef: 'ICMHS/KNEC/NOV-2026/001',
          submittedAt: null,
          hodClearedAt: null,
          notes: null,
          papers: [
            {
              id: 'bp-1',
              bookingId: 'b-1',
              moduleId: 'm-1905-1',
              moduleCode: '1905/1',
              paperId: 'p-101',
              paperCode: '1905/101',
              paperName: 'ICT, Mathematics and Entrepreneurship',
              isResit: false,
              paperStatus: 'passed',
              grade: 'PASS',
              remarks: null,
            },
            {
              id: 'bp-2',
              bookingId: 'b-1',
              moduleId: 'm-1905-1',
              moduleCode: '1905/1',
              paperId: 'p-102',
              paperCode: '1905/102',
              paperName: 'Applied Sciences and Anatomy',
              isResit: true,
              paperStatus: 'passed',
              grade: 'PASS',
              remarks: null,
            },
          ],
        },
        {
          id: 'b-2',
          studentId: 'stu-1',
          seriesId: 'ser-2',
          seriesName: 'March 2027',
          seriesCode: 'MAR-2027',
          seriesYear: 2027,
          seriesMonth: 'March',
          seriesStatus: 'booking_open',
          knecIndexNumber: '40210045012',
          bookingType: 'normal',
          bookingStatus: 'submitted',
          clearanceRef: 'ICMHS/KNEC/MAR-2027/001',
          submittedAt: null,
          hodClearedAt: null,
          notes: null,
          papers: [
            {
              id: 'bp-3',
              bookingId: 'b-2',
              moduleId: 'm-2916-2',
              moduleCode: '2916/2',
              paperId: 'p-2916-201',
              paperCode: '2916/201',
              paperName: 'Basic Biochemistry',
              isResit: false,
              paperStatus: 'booked',
              grade: null,
              remarks: null,
            },
          ],
        },
      ],
    });

    expect(progressWithResults.completedCount).toBe(2);
    expect(progressWithResults.bookedCount).toBe(1);
    expect(progressWithResults.overallStatus).toBe('booked');
    expect(progressWithResults.items[0]?.status).toBe('completed');
    expect(progressWithResults.items[2]?.status).toBe('booked');
  });

  it('generates a valid KNEC booking and 5-office clearance PDF document', async () => {
    const context: KnecBookingFormContext = {
      student: {
        id: 'stu-1',
        fullName: 'LAGAT, SANDRA CHEROTICH',
        admissionNumber: 'DHNT/S-6656/IC/25',
        programmeCode: 'DHNT',
        programmeName: 'Diploma in Human Nutrition (Transition)',
        equivalentTrackLabel: canonicalKnecTrackLabel('DHNT'),
        departmentName: 'Human Nutrition and Dietetics',
        cohortName: 'DHNT SEP 25',
        knecIndexNumber: '40210045012',
      },
      booking: {
        id: 'b-1',
        studentId: 'stu-1',
        seriesId: 'ser-1',
        seriesName: 'March 2027',
        seriesCode: 'MAR-2027',
        seriesYear: 2027,
        seriesMonth: 'March',
        seriesStatus: 'booking_open',
        knecIndexNumber: '40210045012',
        bookingType: 'mixed',
        bookingStatus: 'submitted',
        clearanceRef: 'ICMHS/KNEC/MAR-2027/6656',
        submittedAt: null,
        hodClearedAt: null,
        notes: null,
        papers: [],
      },
      modulesSummary: [
        {
          moduleCode: '2916/2',
          moduleTitle: 'Diploma Module II',
          papers: [
            {
              paperCode: '2916/201',
              paperName: 'Basic Biochemistry and Introduction to Biostatistics',
              isResit: false,
              paperStatus: 'booked',
            },
          ],
        },
      ],
    };

    const buffer = await buildStudentKnecBookingPdf(context);
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(2000);
    expect('kcseIndexNumber' in context.student).toBe(false);
    expect('nationalIdNumber' in context.student).toBe(false);
    expect('phoneNumber' in context.student).toBe(false);
    expect('birthCertificateEntryNumber' in context.student).toBe(false);
  });

  it('requires all 4 confidential KNEC Module I biodata fields in Student Profile', () => {
    expect(getMissingKnecBiodataFields(null)).toEqual([
      'KCSE Index Number',
      'National ID Number',
      'Phone Number',
      'Birth Certificate Entry Number',
    ]);

    expect(
      getMissingKnecBiodataFields({
        kcseIndexNumber: '12345678/001',
        nationalIdNumber: '38451200',
        phoneNumber: '0712345678',
        birthCertificateEntryNumber: '',
      }),
    ).toEqual(['Birth Certificate Entry Number']);

    expect(
      getMissingKnecBiodataFields({
        kcseIndexNumber: '12345678/001',
        nationalIdNumber: '38451200',
        phoneNumber: '0712345678',
        birthCertificateEntryNumber: 'B12345678',
      }),
    ).toEqual([]);

    const invalid = studentProfileSchema.safeParse({
      fullName: 'Amina Hassan',
      kcseIndexNumber: '12345678/001',
      nationalIdNumber: '38451200',
      phoneNumber: '0712345678',
      birthCertificateEntryNumber: '',
    });
    expect(invalid.success).toBe(false);

    const valid = studentProfileSchema.safeParse({
      fullName: 'Amina Hassan',
      kcseIndexNumber: '12345678/001',
      nationalIdNumber: '38451200',
      phoneNumber: '+254712345678',
      birthCertificateEntryNumber: 'BC-992014',
      email: '',
    });
    expect(valid.success).toBe(true);
  });

  it('parses bulk KNEC index number uploads from .csv and .xlsx registration rolls', async () => {
    const csv = [
      'Admission No.,Student Name,KNEC Index Number',
      'CND/S-5112/IC/25,Student One,40210045011',
      'DHN/S-6201/IC/25,Student Two,40210045022',
      'CND/S-5112/IC/25,Student One,40210045099',
    ].join('\n');

    const csvRows = await parseKnecIndexImportFile(Buffer.from(csv, 'utf8'), 'knec-indices.csv');
    expect(csvRows).toEqual([
      { admissionNumber: 'CND/S-5112/IC/25', knecIndexNumber: '40210045099' },
      { admissionNumber: 'DHN/S-6201/IC/25', knecIndexNumber: '40210045022' },
    ]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('KNEC Portal Roll');
    ws.addRow(['KNEC PORTAL REGISTRATION ROLL — MARCH 2027']);
    ws.addRow([
      'S/N',
      'Admission No.',
      'Student Name',
      'Course',
      'Cohort',
      'Series',
      'KCSE Index No.',
      'National ID No.',
      'Phone No.',
      'Birth Cert Entry No.',
      'Booked Modules',
      'Booked Papers',
      'Booking Status',
      'KNEC Index Number',
    ]);
    ws.addRow([
      1,
      'CND/S-5112/IC/25',
      'Student One',
      'CND',
      'CND MAY 25',
      'March 2027',
      '12345678/001',
      '38451200',
      '0712345678',
      'BC-992014',
      '1905/1',
      '1905/101, 1905/102',
      'hod_cleared',
      '40210045101',
    ]);
    ws.addRow([
      2,
      'DHN/S-6201/IC/25',
      'Student Two',
      'DHN',
      'DHN SEP 25',
      'March 2027',
      '87654321/002',
      '39451201',
      '0722000111',
      'BC-881122',
      '2916/1',
      '2916/101',
      'hod_cleared',
      '',
    ]);

    const xlsxBuffer = await wb.xlsx.writeBuffer();
    const xlsxRows = await parseKnecIndexImportFile(xlsxBuffer, 'KNEC_Registration_Roll.xlsx');
    expect(xlsxRows).toEqual([
      { admissionNumber: 'CND/S-5112/IC/25', knecIndexNumber: '40210045101' },
    ]);
  });
});
