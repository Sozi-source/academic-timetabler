import { createClient } from '@/lib/supabase/server';

type RelationRow = Record<string, unknown>;

function relation(value: unknown): RelationRow | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? first as RelationRow : null;
  }

  return value && typeof value === 'object' ? value as RelationRow : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export interface AttendanceSheetMetadata {
  institutionName: string;
  campusName: string;
  schoolName: string;
  departmentName: string;
  programmeName: string;
  venueName: string;
}

export async function getAttendanceSheetMetadata(
  allocationId: string,
): Promise<AttendanceSheetMetadata> {
  const supabase = await createClient();
  const [allocResult, slotResult] = await Promise.all([
    supabase
      .from('teaching_allocations')
      .select(`
        cohorts (
          programmes (
            name,
            departments (name)
          )
        )
      `)
      .eq('id', allocationId)
      .maybeSingle(),
    supabase
      .from('timetable_slots')
      .select(`
        room:rooms (
          name,
          code
        )
      `)
      .eq('allocation_id', allocationId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (allocResult.error) {
    throw new Error(`Unable to load attendance-sheet details: ${allocResult.error.message}`);
  }

  const cohort = relation(allocResult.data?.cohorts);
  const programme = relation(cohort?.programmes);
  const department = relation(programme?.departments);

  const room = (slotResult.data as any)?.room;
  const venueName = room ? `${room.name || ''} ${room.code ? `(${room.code})` : ''}`.trim() : 'THK 2- 06/08';

  return {
    institutionName: 'Imperial College of Medical and Health Sciences',
    campusName: 'Thika',
    schoolName: 'Imperial',
    departmentName: text(department?.name) ?? 'Applied Science',
    programmeName: text(programme?.name) ?? 'Diploma in Science Laboratory Technology',
    venueName,
  };
}
