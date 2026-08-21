import type {
  TeachingDocumentType,
} from './domain';

export interface TeachingDocumentPublicationItem {
  id:
    string;
  documentType:
    TeachingDocumentType;
  versionNumber:
    number;
  approvedRevisionNumber:
    number;
  studentVisible:
    boolean;
  approvedAt:
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
