import type {
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
  updatedAt: string;
}
