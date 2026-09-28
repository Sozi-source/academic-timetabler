export type CurriculumLibraryDocumentTypeV54 =
  | 'course_outline'
  | 'scheme_of_work';

export interface CurriculumLibraryDocumentV54 {
  id: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  documentType: CurriculumLibraryDocumentTypeV54;
  versionNumber: number;
  status: 'active' | 'superseded' | 'retired';
  sourceType: 'admin_import' | 'legacy_import' | 'trainer_upload';
  sourceFileName: string | null;
  createdAt: string;
}

export interface CurriculumLibraryHistoryV54
  extends CurriculumLibraryDocumentV54 {}
