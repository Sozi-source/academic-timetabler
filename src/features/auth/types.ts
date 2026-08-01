export type AppRole =
  | 'system_admin'
  | 'hod';

export interface AuthenticatedProfile {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  departmentName: string;
  isActive: boolean;
}