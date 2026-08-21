import type {
  TeachingDocumentReviewDecision,
  TeachingDocumentStatus,
  TeachingDocumentTemplateStatus,
  TeachingDocumentType,
} from './domain';

export interface TeachingDocumentTemplateSummary {
  id: string;
  documentType: TeachingDocumentType;
  name: string;
  versionNumber: number;
  status: TeachingDocumentTemplateStatus;
  storageBucket: string;
  storagePath: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  sha256: string | null;
  notes: string | null;
  activatedAt: string | null;
  retiredAt: string | null;
  uploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingDocumentRecord {
  id: string;
  allocationId: string;
  documentType: TeachingDocumentType;
  templateId: string;
  versionNumber: number;
  status: TeachingDocumentStatus;
  storageBucket: string;
  storagePath: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  sha256: string | null;
  currentRevisionNumber: number | null;
  submittedRevisionNumber: number | null;
  approvedRevisionNumber: number | null;
  reviewNote: string | null;
  generatedAt: string | null;
  submittedAt: string | null;
  returnedAt: string | null;
  approvedAt: string | null;
  updatedAt: string;
}

export interface TeachingDocumentReviewItem {
  id: string;
  documentType: TeachingDocumentType;
  versionNumber: number;
  currentRevisionNumber: number | null;
  submittedRevisionNumber: number | null;
  originalFilename: string | null;
  fileSizeBytes: number | null;
  submittedAt: string | null;
  unitName: string;
  cohortName: string;
  academicPeriodName: string;
  trainerName: string;
}

export interface TeachingDocumentReviewHistoryItem {
  id: string;
  documentId: string;
  revisionNumber: number;
  decision: TeachingDocumentReviewDecision;
  note: string | null;
  reviewedAt: string;
}
