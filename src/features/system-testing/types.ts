export interface TestingSnapshot {
  departmentId:
    string;
  activePeriod:
    {
      id:
        string;
      name:
        string;
    } |
    null;
  students:
    {
      total:
        number;
      active:
        number;
    };
  studentPortal:
    {
      issued:
        number;
      active:
        number;
    };
  timetable:
    {
      allocations:
        number;
      publishedSessions:
        number;
    };
  assessments:
    {
      total:
        number;
      published:
        number;
    };
  documents:
    {
      activeTemplates:
        number;
      total:
        number;
      submitted:
        number;
      approved:
        number;
      studentVisible:
        number;
      studentDownloads:
        number;
    };
  attendance:
    {
      sessions:
        number;
      open:
        number;
      completed:
        number;
    };
}

export type TestingAreaStatus =
  | 'ready'
  | 'attention'
  | 'not_started';

export interface TestingArea {
  key:
    string;
  title:
    string;
  description:
    string;
  status:
    TestingAreaStatus;
  metric:
    string;
  detail:
    string;
  href:
    string;
}
