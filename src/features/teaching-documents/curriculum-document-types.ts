export type CurriculumDocumentType = 'course_outline' | 'scheme_of_work';

export function isCurriculumDocumentType(value: unknown): value is CurriculumDocumentType {
  return value === 'course_outline' || value === 'scheme_of_work';
}

export function inferCurriculumDocumentType(value: string): CurriculumDocumentType {
  return /scheme/i.test(value) ? 'scheme_of_work' : 'course_outline';
}
