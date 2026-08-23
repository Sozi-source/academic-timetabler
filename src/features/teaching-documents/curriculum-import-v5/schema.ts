export type CurriculumImportDocumentType =
  | 'course_outline'
  | 'scheme_of_work'
  | 'unknown';

export type CurriculumImportIssueSeverity =
  | 'error'
  | 'review'
  | 'warning';

export type CurriculumImportMatchMethod =
  | 'exact_code'
  | 'normalized_code'
  | 'exact_name'
  | 'manual'
  | 'unmatched';

export interface CurriculumImportIssueV5 {
  id: string;
  severity: CurriculumImportIssueSeverity;
  code: string;
  message: string;
  sourceUnitKey?: string;
  sourceSheet?: string;
  sourceRow?: number;
}

export interface CurriculumImportUnitV5 {
  sourceUnitKey: string;
  sourceUnitCode: string;
  sourceUnitName: string;
  documentType: CurriculumImportDocumentType;
  contentFamilyKey: string;
  curriculumVersion: number;
  unitDescription: string;
  coreLearningOutcomes: string;
  teachingLearningApproaches: string;
  assessmentApproaches: string;
  referencesResources: string;
  matchedUnitId: string | null;
  matchedUnitCode: string | null;
  matchedUnitName: string | null;
  matchMethod: CurriculumImportMatchMethod;
}

export interface CurriculumImportContentV5 {
  sourceUnitKey: string;
  sequence: number;
  sourceWeek: number | null;
  topic: string;
  coverage: string;
  learningOutcomes: string;
  activities: string;
  assessment: string;
  resources: string;
  sourceSheet: string;
  sourceRow: number;
  excludedAsCalendarActivity: boolean;
}

export interface CurriculumImportBatchPayloadV5 {
  engineVersion: 5;
  documentType: CurriculumImportDocumentType;
  units: CurriculumImportUnitV5[];
  content: CurriculumImportContentV5[];
  issues: CurriculumImportIssueV5[];
  source: {
    fileName: string;
    parser: 'xlsx-flex-v5';
  };
}

export interface SystemUnitForImportV5 {
  id: string;
  code: string;
  name: string;
}

export const V5_ENGINE_VERSION = 5 as const;

export const UNIT_SHEET_NAMES = [
  'unit details',
  'units',
  'course details',
  'curriculum units',
] as const;

export const CONTENT_SHEET_NAMES = [
  'weekly content',
  'content',
  'curriculum content',
  'delivery plan',
  'learning plan',
  'scheme of work',
] as const;

export const FIELD_ALIASES = {
  unit_code: [
    'unit_code',
    'unit code',
    'course_code',
    'course code',
    'code',
  ],
  unit_name: [
    'unit_name',
    'unit name',
    'course_name',
    'course name',
    'unit title',
    'course title',
    'title',
  ],
  document_type: [
    'document_type',
    'document type',
    'type',
  ],
  content_family_key: [
    'content_family_key',
    'content family key',
    'family_key',
    'family key',
  ],
  curriculum_version: [
    'curriculum_version',
    'curriculum version',
    'version',
  ],
  unit_description: [
    'unit_description',
    'unit description',
    'course description',
    'description',
  ],
  core_learning_outcomes: [
    'core_learning_outcomes',
    'core learning outcomes',
    'learning outcomes',
    'course learning outcomes',
  ],
  teaching_learning_approaches: [
    'teaching_learning_approaches',
    'teaching learning approaches',
    'teaching approaches',
    'delivery methods',
    'teaching methods',
  ],
  assessment_approaches: [
    'assessment_approaches',
    'assessment approaches',
    'assessment methods',
  ],
  references_resources: [
    'references_resources',
    'references resources',
    'references',
    'reference resources',
  ],
  sequence: [
    'sequence',
    'seq',
    'order',
    'week_number',
    'week number',
    'week',
    'wk',
  ],
  topic: [
    'topic',
    'topic title',
    'session title',
    'content',
    'theme',
  ],
  coverage: [
    'specific_coverage',
    'specific coverage',
    'coverage',
    'subtopics',
    'sub topics',
    'sub-topic',
    'sub topic',
  ],
  learning_outcomes: [
    'learning_outcomes',
    'learning outcomes',
    'specific learning outcomes',
    'objectives',
  ],
  activities: [
    'teaching_learning_activities',
    'teaching learning activities',
    'activities',
    'learning activities',
    'trainer activities',
    'learner activities',
  ],
  assessment: [
    'assessment_learning_check',
    'assessment learning check',
    'assessment',
    'learning check',
    'remarks',
  ],
  resources: [
    'resources',
    'teaching resources',
    'materials',
    'teaching aids',
    'references and resources',
  ],
} as const;

export const COURSE_OUTLINE_UNIT_HEADERS = [
  'unit_code',
  'unit_name',
  'content_family_key',
  'curriculum_version',
  'unit_description',
  'core_learning_outcomes',
  'teaching_learning_approaches',
  'assessment_approaches',
  'references_resources',
] as const;

export const COURSE_OUTLINE_CONTENT_HEADERS = [
  'unit_code',
  'sequence',
  'topic',
  'coverage',
] as const;

export const SCHEME_UNIT_HEADERS = [
  'unit_code',
  'unit_name',
  'content_family_key',
  'curriculum_version',
] as const;

export const SCHEME_CONTENT_HEADERS = [
  'unit_code',
  'sequence',
  'topic',
  'coverage',
  'learning_outcomes',
  'activities',
  'assessment',
  'resources',
] as const;
