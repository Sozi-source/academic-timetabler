import 'server-only';

import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type { ExamBlueprintWorkspace } from './types';

export const getExamBlueprintWorkspace = cache(
  async (): Promise<ExamBlueprintWorkspace> => {
    const profile = await requireHodAccess();
    if (!profile.activeDepartmentId) {
      return {
        departmentName: profile.departmentName,
        programmes: [],
        blueprints: [],
        migrationRequired: false,
      };
    }

    const supabase = await createClient();
    const [programmeResult, blueprintResult] = await Promise.all([
      supabase
        .from('programmes')
        .select('id,code,name')
        .eq('department_id', profile.activeDepartmentId)
        .eq('is_active', true)
        .order('code', { ascending: true }),
      supabase
        .from('exam_blueprints')
        .select('id,name,programme_id,version_number,status,total_marks,duration_minutes,created_at')
        .eq('department_id', profile.activeDepartmentId)
        .order('name', { ascending: true })
        .order('version_number', { ascending: false }),
    ]);

    if (programmeResult.error) {
      throw new Error(`Unable to load programmes: ${programmeResult.error.message}`);
    }

    if (blueprintResult.error) {
      const migrationRequired =
        blueprintResult.error.code === '42P01'
        || blueprintResult.error.code === 'PGRST205';
      if (migrationRequired) {
        return {
          departmentName: profile.departmentName,
          programmes: programmeResult.data ?? [],
          blueprints: [],
          migrationRequired: true,
        };
      }
      throw new Error(`Unable to load exam blueprints: ${blueprintResult.error.message}`);
    }

    return {
      departmentName: profile.departmentName,
      programmes: programmeResult.data ?? [],
      blueprints: (blueprintResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        programmeId: row.programme_id,
        versionNumber: row.version_number,
        status: row.status,
        totalMarks: row.total_marks,
        durationMinutes: row.duration_minutes,
        createdAt: row.created_at,
      })),
      migrationRequired: false,
    };
  },
);
