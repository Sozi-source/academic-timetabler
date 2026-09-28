export interface CurriculumContentImportState {
  status: 'idle' | 'error' | 'success';
  message: string | null;
  details?: string[];
  batchId?: string;
}

export const initialCurriculumContentImportState: CurriculumContentImportState = {
  status: 'idle',
  message: null,
};
