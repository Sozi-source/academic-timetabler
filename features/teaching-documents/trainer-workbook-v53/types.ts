export type TrainerTeachingDocumentType =
  | 'course_outline'
  | 'scheme_of_work';

export interface TrainerAllocationDocumentRowV53 {
  allocationId: string;
  unitId: string;
  unitCode: string;
  unitName: string;
}

export interface TrainerDocumentVersionRowV53 {
  id: string;
  allocationId: string;
  unitId: string;
  documentType: TrainerTeachingDocumentType;
  versionNumber: number;
  status: 'active' | 'superseded' | 'retired';
  sourceFileName: string | null;
  createdAt: string;
}

export interface TrainerDocumentSummaryV53 {
  totalAllocations: number;
  activeCourseOutlines: number;
  activeSchemes: number;
  missingCourseOutlines: TrainerAllocationDocumentRowV53[];
  missingSchemes: TrainerAllocationDocumentRowV53[];
}
