export type SemesterActivityType =
  | 'instruction'
  | 'cat'
  | 'exam'
  | 'revision'
  | 'orientation'
  | 'remedial'
  | 'other';

export interface SemesterProgramActivity {
  id?: string;
  academicPeriodId?: string | null;
  weekNumber: number;
  activityType: SemesterActivityType;
  title: string;
  description?: string | null;
  isTeachingWeek: boolean;
  learningOutcomes?: string | null;
  learningActivities?: string | null;
  assessmentRemarks?: string | null;
}

export interface SemesterProgramOfActivitiesConfig {
  academicPeriodId?: string | null;
  academicPeriodName?: string | null;
  activities: SemesterProgramActivity[];
}

export const DEFAULT_PROGRAM_OF_ACTIVITIES: SemesterProgramActivity[] = [
  {
    weekNumber: 1,
    activityType: 'orientation',
    title: 'Term Commencement & Course Introduction',
    description: 'Trainee orientation, course outline distribution, learning contract, diagnostic assessment.',
    isTeachingWeek: true,
    learningOutcomes: 'Understand course expectations, syllabus structure, assessment criteria, and foundational concepts.',
    learningActivities: 'Interactive lecture · Syllabus review · Diagnostic brainstorm · Question & Answer',
    assessmentRemarks: 'Formative Diagnostic Assessment',
  },
  {
    weekNumber: 8,
    activityType: 'cat',
    title: 'Continuous Assessment Test (CAT)',
    description: 'Continuous Assessment Test (CAT) - 30% Coursework Weighting.',
    isTeachingWeek: false,
    learningOutcomes: 'Assess comprehensive theoretical and practical competencies covered across preceding weeks.',
    learningActivities: 'Administration of Continuous Assessment Test · Supervised examination',
    assessmentRemarks: 'Continuous Assessment Test (CAT)',
  },
  {
    weekNumber: 13,
    activityType: 'revision',
    title: 'Comprehensive Syllabus Revision & Tutorial Clinic',
    description: 'Intensive course review, past examination paper analysis, remedial tutorials.',
    isTeachingWeek: true,
    learningOutcomes: 'Synthesize course principles, resolve complex competency areas, prepare for final summative evaluation.',
    learningActivities: 'Comprehensive syllabus recap · Revision tutorials · Group problem-solving · Past paper drills',
    assessmentRemarks: 'Remedial Consultations & Formative Revision',
  },
  {
    weekNumber: 14,
    activityType: 'exam',
    title: 'End of Term Examination',
    description: 'Institutional End of Term Examinations & TVET CDACC Competency Assessments - 70 Marks.',
    isTeachingWeek: false,
    learningOutcomes: 'Demonstrate overall theoretical and practical competence as per TVET national curriculum standards.',
    learningActivities: 'Supervised End of Term Summative Examinations · Script marking',
    assessmentRemarks: 'End of Term Examination (70 Marks)',
  },
];
