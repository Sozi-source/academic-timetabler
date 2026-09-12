/**
 * Authoritative TVET Curriculum Types
 */

export interface SeedWeeklyTopic {
  weekNumber: number;
  topicTitle: string;
  subTopics: string[];
  hours?: number;
  learningActivities?: string;
  resourcesAndReferences?: string;
  assessmentAndRemarks?: string;
  specificLearningOutcomes?: string;
}

export interface UnitCurriculumDefinition {
  /** Legacy ingestion tag retained for ZIP/import compatibility. */
  documentType?: 'course_outline' | 'scheme_of_work';
  unitCode: string;
  unitName: string;
  unitDescription?: string;
  overallCompetency?: string;
  learningOutcomes?: string[];
  weeklySchedule?: SeedWeeklyTopic[];
  references?: string[];
  instructionalEquipment?: string[];
  teachingLearningApproaches?: string;
  assessmentApproaches?: string;
}

export interface CanonicalCurriculumUnit extends UnitCurriculumDefinition {
  canonicalKey: string;
  moduleNumber: 1 | 2 | 3;
  syllabusCode: string;
  nominalHours: number;
  theoryHours?: number;
  practicalHours?: number;
  aliases: string[];
}
