export type AppRole =
  | 'system_admin'
  | 'hod'
  | 'trainer';

export interface AuthenticatedProfile {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  departmentName: string;
  activeDepartmentId: string | null;
  isActive: boolean;
}
