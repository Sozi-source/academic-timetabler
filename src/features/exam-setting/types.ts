export type ExamBlueprintStatus = 'draft' | 'active' | 'retired';

export interface ExamBlueprint {
  id: string;
  name: string;
  programmeId: string | null;
  versionNumber: number;
  status: ExamBlueprintStatus;
  totalMarks: number;
  durationMinutes: number;
  createdAt: string;
}

export interface ExamBlueprintWorkspace {
  departmentName: string;
  programmes: Array<{ id: string; code: string; name: string }>;
  blueprints: ExamBlueprint[];
  migrationRequired: boolean;
}
