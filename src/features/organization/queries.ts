import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedProfile } from '@/features/auth/queries';

export interface OrganizationDepartment {
  id: string;
  school_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface AccessibleDepartment {
  id: string;
  code: string;
  name: string;
  schoolName: string;
}

export interface OrganizationProfile {
  id: string;
  fullName: string;
  email: string;
  role: 'system_admin' | 'hod';
}

export const getOrganizationStructure = cache(
  async (): Promise<OrganizationDepartment[]> => {
    const db = await createClient();
    const { data, error } = await db
      .from('departments')
      .select('id,school_id,code,name,is_active')
      .order('name');

    if (error) {
      throw new Error(
        `Unable to load organization: ${error.message}`,
      );
    }

    return (data ?? []) as OrganizationDepartment[];
  },
);

export const getAccessibleDepartments = cache(
  async (): Promise<AccessibleDepartment[]> => {
    const workspaces = await getOrganizationStructure();

    return workspaces
      .filter((workspace) => workspace.is_active)
      .map((workspace) => ({
        id: workspace.id,
        code: workspace.code,
        name: workspace.name,
        schoolName: workspace.name,
      }));
  },
);

export const getWorkingDepartments = cache(
  async (): Promise<AccessibleDepartment[]> => {
    const [profile, departments] = await Promise.all([
      getAuthenticatedProfile(),
      getAccessibleDepartments(),
    ]);

    if (!profile?.activeDepartmentId) {
      return [];
    }

    return departments.filter(
      (department) =>
        department.id === profile.activeDepartmentId,
    );
  },
);

export const getOrganizationProfiles = cache(
  async (): Promise<OrganizationProfile[]> => {
    const db = await createClient();
    const { data, error } = await db
      .from('profiles')
      .select('id,full_name,email,role')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      throw new Error(
        `Unable to load users: ${error.message}`,
      );
    }

    return (data ?? []).map((profile) => ({
      id: profile.id as string,
      fullName: profile.full_name as string,
      email: profile.email as string,
      role: profile.role as 'system_admin' | 'hod',
    }));
  },
);
