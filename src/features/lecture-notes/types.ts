// ============================================================
// Lecture Notes — Domain Types
// ============================================================

export type MaterialSourceType = 'pdf' | 'docx' | 'zip' | 'text' | 'url';
export type GenerationGranularity = 'session' | 'unit';
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface LectureMaterial {
  id: string;
  trainerId: string;
  teachingAllocationId: string | null;
  unitId: string;
  departmentId: string | null;
  title: string;
  sourceType: MaterialSourceType;
  sourceUrl: string | null;
  originalFilename: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  contentText: string | null;
  chunkCount: number;
  ingestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LectureMaterialChunk {
  id: string;
  materialId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  createdAt: string;
}

export interface LectureNoteJob {
  id: string;
  trainerId: string;
  teachingAllocationId: string | null;
  unitId: string;
  departmentId: string | null;
  granularity: GenerationGranularity;
  sessionWeek: number | null;
  topic: string | null;
  status: JobStatus;
  errorMessage: string | null;
  promptTokenCount: number | null;
  outputTokenCount: number | null;
  docxStorageBucket: string | null;
  docxStoragePath: string | null;
  pdfStorageBucket: string | null;
  pdfStoragePath: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ── Input / output types ──────────────────────────────────────

export interface MaterialUploadInput {
  unitId: string;
  teachingAllocationId?: string | null;
  departmentId?: string | null;
  title: string;
  sourceType: MaterialSourceType;
  sourceUrl?: string | null;
  /** Raw file bytes for pdf/docx/text uploads */
  fileBuffer?: Buffer | null;
  originalFilename?: string | null;
  mimeType?: string | null;
}

export interface GenerationRequest {
  jobId: string;
  unitId: string;
  trainerId: string;
  granularity: GenerationGranularity;
  sessionWeek?: number | null;
  /** Specific topic from course outline week or full-unit topics */
  topic: string;
  learningOutcomes: string[];
  weeklyPlanContext: string;
}

export interface RetrievedChunk {
  id: string;
  materialId: string;
  content: string;
  similarity: number;
}

export interface GeneratedSection {
  heading: string;
  body: string;
}

export interface LectureNotesDocument {
  unitCode: string;
  unitName: string;
  topic: string;
  granularity: GenerationGranularity;
  sessionWeek?: number | null;
  sections: GeneratedSection[];
  generatedAt: string;
  /** Source material titles used in generation */
  sourceMaterials: string[];
}

/** Thin summary joined from units + teaching_allocations for the UI */
export interface LectureNotesAllocationSummary {
  allocationId: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  cohortName: string;
  academicPeriodName: string;
  materialCount: number;
  jobCount: number;
}
