import type {
  TeachingDocumentStatus,
  TeachingDocumentType,
} from './domain';

export interface TeachingDocumentTemplateSummary {
  id: string;
  documentType: TeachingDocumentType;
  name: string;
  versionNumber: number;
  status:
    | 'draft'
    | 'active'
    | 'retired';
  storagePath: string | null;
  originalFilename: string | null;
  updatedAt: string;
}

export interface TeachingDocumentRecord {
  id: string;
  allocationId: string;
  documentType: TeachingDocumentType;
  templateId: string;
  versionNumber: number;
  status: TeachingDocumentStatus;
  storagePath: string | null;
  originalFilename: string | null;
  updatedAt: string;
}
