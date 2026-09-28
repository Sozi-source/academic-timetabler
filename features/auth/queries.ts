import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  AppRole,
  AuthenticatedProfile,
} from './types';

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  department_name: string;
  active_department_id: string | null;
  is_active: boolean;
}

export const getAuthenticatedProfile = cache(
  async (): Promise<AuthenticatedProfile | null> => {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(
        `
          id,
          full_name,
          email,
          role,
          department_name,
          active_department_id,
          is_active
        `,
      )
      .eq('id', user.id)
      .single<ProfileRow>();

    if (error || !data || !data.is_active) {
      return null;
    }

    return {
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      role: data.role,
      departmentName: data.department_name,
      activeDepartmentId:
        data.active_department_id,
      isActive: data.is_active,
    };
  },
);
