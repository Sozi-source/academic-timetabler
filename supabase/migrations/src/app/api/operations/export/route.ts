import ExcelJS from 'exceljs';
import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  operationsReadinessIssues,
  operationsReadinessScore,
} from '@/features/operations/domain';
import {
  getDepartmentAttendanceOverview,
  getOperationsAudit,
  getOperationsSnapshot,
} from '@/features/operations/queries';

function styleHeader(
  row:
    ExcelJS.Row,
) {
  row.font = {
    bold:
      true,
  };

  row.alignment = {
    vertical:
      'middle',
    wrapText:
      true,
  };
}

function styleSheet(
  sheet:
    ExcelJS.Worksheet,
) {
  sheet.views = [
    {
      state:
        'frozen',
      ySplit:
        1,
    },
  ];

  sheet.eachRow(
    (
      row,
    ) => {
      row.alignment = {
        vertical:
          'top',
        wrapText:
          true,
      };
    },
  );
}

export async function GET() {
  await requireHodAccess();

  const [
    snapshot,
    attendance,
    audit,
  ] =
    await Promise.all([
      getOperationsSnapshot(),
      getDepartmentAttendanceOverview(
        500,
      ),
      getOperationsAudit(
        500,
      ),
    ]);

  const readiness =
    operationsReadinessIssues(
      snapshot,
    );

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    'Academic Planner';

  workbook.created =
    new Date();

  const summary =
    workbook.addWorksheet(
      'Operations Summary',
    );

  summary.columns = [
    {
      header:
        'Area',
      width:
        24,
    },
    {
      header:
        'Metric',
      width:
        34,
    },
    {
      header:
        'Value',
      width:
        18,
    },
  ];

  styleHeader(
    summary.getRow(
      1,
    ),
  );

  const summaryRows:
    Array<
      [
        string,
        string,
        string |
        number,
      ]
    > = [
      [
        'Academic Period',
        'Active Period',
        snapshot.activePeriodName ??
          'None',
      ],
      [
        'QA',
        'Readiness Score',
        `${operationsReadinessScore(
          snapshot,
        )}%`,
      ],
      [
        'Students',
        'Eligible Students',
        snapshot.students.eligible,
      ],
      [
        'Students',
        'Registered Students',
        snapshot.students.registered,
      ],
      [
        'Students',
        'Unregistered Students',
        snapshot.students.unregistered,
      ],
      [
        'Students',
        'Portal Access Active',
        snapshot.students.portalActive,
      ],
      [
        'Timetable',
        'Active Allocations',
        snapshot.timetable.activeAllocations,
      ],
      [
        'Timetable',
        'Published Sessions',
        snapshot.timetable.publishedSessions,
      ],
      [
        'Assessment',
        'Assessments',
        snapshot.assessment.total,
      ],
      [
        'Assessment',
        'Finalised',
        snapshot.assessment.finalised,
      ],
      [
        'Assessment',
        'Published',
        snapshot.assessment.published,
      ],
      [
        'Documents',
        'Active Templates',
        snapshot.documents.activeTemplates,
      ],
      [
        'Documents',
        'Submitted',
        snapshot.documents.submitted,
      ],
      [
        'Documents',
        'Returned',
        snapshot.documents.returned,
      ],
      [
        'Documents',
        'Approved',
        snapshot.documents.approved,
      ],
      [
        'Attendance',
        'Open Sessions',
        snapshot.attendance.open,
      ],
      [
        'Attendance',
        'Completed Sessions',
        snapshot.attendance.completed,
      ],
    ];

  summary.addRows(
    summaryRows,
  );

  styleSheet(
    summary,
  );

  const readinessSheet =
    workbook.addWorksheet(
      'Readiness Issues',
    );

  readinessSheet.columns = [
    {
      header:
        'Severity',
      width:
        14,
    },
    {
      header:
        'Area',
      width:
        18,
    },
    {
      header:
        'Issue',
      width:
        42,
    },
    {
      header:
        'Detail',
      width:
        70,
    },
  ];

  styleHeader(
    readinessSheet.getRow(
      1,
    ),
  );

  if (
    readiness.length ===
    0
  ) {
    readinessSheet.addRow([
      'Ready',
      'Operations',
      'No automated readiness issues',
      '',
    ]);
  } else {
    for (
      const issue of
        readiness
    ) {
      readinessSheet.addRow([
        issue.severity,
        issue.area,
        issue.title,
        issue.detail,
      ]);
    }
  }

  styleSheet(
    readinessSheet,
  );

  const attendanceSheet =
    workbook.addWorksheet(
      'Class Attendance',
    );

  attendanceSheet.columns = [
    {
      header:
        'Date',
      width:
        14,
    },
    {
      header:
        'Academic Period',
      width:
        24,
    },
    {
      header:
        'Unit',
      width:
        34,
    },
    {
      header:
        'Cohort',
      width:
        28,
    },
    {
      header:
        'Trainer',
      width:
        30,
    },
    {
      header:
        'Status',
      width:
        14,
    },
    {
      header:
        'Roster',
      width:
        10,
    },
    {
      header:
        'Present',
      width:
        10,
    },
    {
      header:
        'Absent',
      width:
        10,
    },
    {
      header:
        'Unmarked',
      width:
        10,
    },
  ];

  styleHeader(
    attendanceSheet.getRow(
      1,
    ),
  );

  for (
    const session of
      attendance
  ) {
    attendanceSheet.addRow([
      session.sessionDate,
      session.academicPeriodName,
      session.unitName,
      session.cohortName,
      session.trainerName,
      session.sessionStatus,
      session.rosterCount,
      session.presentCount,
      session.absentCount,
      session.unmarkedCount,
    ]);
  }

  styleSheet(
    attendanceSheet,
  );

  const auditSheet =
    workbook.addWorksheet(
      'Operational Audit',
    );

  auditSheet.columns = [
    {
      header:
        'Date / Time',
      width:
        24,
    },
    {
      header:
        'Area',
      width:
        22,
    },
    {
      header:
        'Event',
      width:
        28,
    },
    {
      header:
        'Subject',
      width:
        42,
    },
    {
      header:
        'Actor',
      width:
        28,
    },
    {
      header:
        'Detail',
      width:
        60,
    },
  ];

  styleHeader(
    auditSheet.getRow(
      1,
    ),
  );

  for (
    const item of
      audit
  ) {
    auditSheet.addRow([
      item.occurredAt,
      item.area,
      item.eventType,
      item.subject,
      item.actorName,
      item.detail ??
        '',
    ]);
  }

  styleSheet(
    auditSheet,
  );

  const buffer =
    await workbook.xlsx.writeBuffer();

  return new NextResponse(
    new Uint8Array(
      buffer,
    ),
    {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="academic-planner-operations-report.xlsx"',
        'Cache-Control':
          'private, no-store',
        'X-Content-Type-Options':
          'nosniff',
      },
    },
  );
}
