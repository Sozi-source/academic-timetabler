import type {
  TestingArea,
  TestingAreaStatus,
  TestingSnapshot,
} from './types';

export function testingStatusLabel(
  status:
    TestingAreaStatus,
): string {
  switch (
    status
  ) {
    case 'ready':
      return 'Ready to test';

    case 'attention':
      return 'Needs attention';

    default:
      return 'Not started';
  }
}

export function testingStatusVariant(
  status:
    TestingAreaStatus,
):
  | 'success'
  | 'warning'
  | 'neutral' {
  if (
    status ===
    'ready'
  ) {
    return 'success';
  }

  if (
    status ===
    'attention'
  ) {
    return 'warning';
  }

  return 'neutral';
}

export function buildTestingAreas(
  snapshot:
    TestingSnapshot,
): TestingArea[] {
  const timetableStatus:
    TestingAreaStatus =
      snapshot.timetable
        .publishedSessions >
      0
        ? 'ready'
        : snapshot.timetable
            .allocations >
          0
          ? 'attention'
          : 'not_started';

  const studentStatus:
    TestingAreaStatus =
      snapshot.students
        .active >
      0
        ? 'ready'
        : 'not_started';

  const portalStatus:
    TestingAreaStatus =
      snapshot.studentPortal
        .active >
      0
        ? snapshot.studentPortal
              .active >=
            snapshot.students
              .active
          ? 'ready'
          : 'attention'
        : snapshot.students
              .active >
            0
          ? 'attention'
          : 'not_started';

  const assessmentStatus:
    TestingAreaStatus =
      snapshot.assessments
        .total >
      0
        ? 'ready'
        : 'not_started';

  const documentStatus:
    TestingAreaStatus =
      snapshot.documents
        .activeTemplates >
        0 &&
      snapshot.documents
        .total >
        0
        ? 'ready'
        : snapshot.documents
              .activeTemplates >
            0
          ? 'attention'
          : 'not_started';

  const attendanceStatus:
    TestingAreaStatus =
      snapshot.timetable
        .publishedSessions >
      0
        ? 'ready'
        : 'not_started';

  return [
    {
      key:
        'timetable',
      title:
        'Timetable',
      description:
        'Allocation, generation and publication.',
      status:
        timetableStatus,
      metric:
        `${snapshot.timetable.publishedSessions} published sessions`,
      detail:
        `${snapshot.timetable.allocations} active-period allocations`,
      href:
        '/timetable/readiness',
    },
    {
      key:
        'students',
      title:
        'Student lifecycle',
      description:
        'Registry, progression and registration.',
      status:
        studentStatus,
      metric:
        `${snapshot.students.active} active students`,
      detail:
        `${snapshot.students.total} department records`,
      href:
        '/students',
    },
    {
      key:
        'student-portal',
      title:
        'Student portal',
      description:
        'PIN access, units, timetable and downloads.',
      status:
        portalStatus,
      metric:
        `${snapshot.studentPortal.active} active portal accounts`,
      detail:
        `${snapshot.studentPortal.issued} access credentials issued`,
      href:
        '/students/access',
    },
    {
      key:
        'assessment',
      title:
        'Assessment',
      description:
        'Population, Excel/online marks and publication.',
      status:
        assessmentStatus,
      metric:
        `${snapshot.assessments.total} assessments`,
      detail:
        `${snapshot.assessments.published} published`,
      href:
        '/assessment',
    },
    {
      key:
        'documents',
      title:
        'Teaching documents',
      description:
        'Templates, review and student publication.',
      status:
        documentStatus,
      metric:
        `${snapshot.documents.activeTemplates} active templates`,
      detail:
        `${snapshot.documents.approved} approved · ${snapshot.documents.studentVisible} student visible`,
      href:
        '/teaching-documents',
    },
    {
      key:
        'attendance',
      title:
        'Class attendance',
      description:
        'Published classes, Present/Absent and HOD oversight.',
      status:
        attendanceStatus,
      metric:
        `${snapshot.attendance.sessions} recorded sessions`,
      detail:
        `${snapshot.attendance.completed} completed · ${snapshot.attendance.open} open`,
      href:
        '/attendance-clinical',
    },
  ];
}

export function testingReadyCount(
  areas:
    TestingArea[],
): number {
  return areas.filter(
    (area) =>
      area.status ===
      'ready',
  ).length;
}
