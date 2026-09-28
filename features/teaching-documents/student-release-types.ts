import type {
  TeachingDocumentType,
} from './domain';

export interface TeachingDocumentStudentReleaseItem {
  id:
    string;
  documentType:
    TeachingDocumentType;
  versionNumber:
    number;
  approvedRevisionNumber:
    number;
  approvedAt:
    string |
    null;
  studentPublishedAt:
    string |
    null;
  originalFilename:
    string |
    null;
  unitName:
    string;
  cohortName:
    string;
  academicPeriodName:
    string;
  trainerName:
    string;
}
