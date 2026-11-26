import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/authorization', () => ({
  requireHodAccess: async () => ({
    id: 'user-1',
    fullName: 'Wilfred Osozi',
    email: 'wilfred@example.com',
    role: 'system_admin',
    departmentName: 'Human Nutrition and Dietetics',
    activeDepartmentId: 'dept-1',
    isActive: true,
  }),
}));

let mockUnitOfferings: unknown[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const emptyResult = { data: [], error: null };
    const periodsResult = {
      data: [
        { id: 'period-active', name: 'Sept-Dec 2026', code: 'SEP-DEC-26', status: 'active' },
        { id: '5e16a453-5977-435d-890e-57abbfc2e52e', name: 'Jan-Apr 2027', code: 'JAN-APR-27', status: 'planned' },
      ],
      error: null,
    };
    const trainersResult = {
      data: [
        {
          id: 'trainer-1',
          full_name: 'Andrew Mungai',
          staff_number: 'TRN-014',
          home_department: 'Applied Sciences',
          department_id: 'dept-2',
          normal_weekly_hours: 20,
          workload_role: 'full_time_trainer',
          availability_mode: 'selected_slots_only',
        },
      ],
      error: null,
    };

    const makeChain = (result: { data: unknown; error: null }) => {
      const chain: Record<string, unknown> = {
        then: (resolve: (value: { data: unknown; error: null }) => void) => Promise.resolve(result).then(resolve),
      };
      for (const method of ['select', 'eq', 'in', 'order']) {
        chain[method] = () => chain;
      }
      return chain;
    };

    return {
      from: (table: string) => {
        if (table === 'academic_periods') return makeChain(periodsResult);
        if (table === 'trainers') return makeChain(trainersResult);
        if (table === 'unit_offerings') return makeChain({ data: mockUnitOfferings, error: null });
        return makeChain(emptyResult);
      },
      rpc: async () => emptyResult,
    };
  },
}));

describe('Teaching allocations page', () => {
  it('renders a planned future period cleanly even with zero offerings and allocations', async () => {
    mockUnitOfferings = [];
    const { default: Page } = await import('@/app/(dashboard)/timetable/teaching-allocations/page');
    const element = await Page({
      searchParams: Promise.resolve({ period: '5e16a453-5977-435d-890e-57abbfc2e52e' }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Simple teaching allocation');
    expect(html).toContain('JAN-APR-27');
    expect(html).toContain('Reserve all unassigned (0)');
  });

  it('counts collapsed shared classes rather than raw cohort offering rows in awaiting counts', async () => {
    mockUnitOfferings = [
      {
        id: 'off-cnd',
        cohort_id: 'cohort-cnd',
        unit_id: 'unit-cnd',
        allocation_status: 'unallocated',
        is_provisionally_reserved: false,
        confirmed_shared_offering_id: 'shared-comm-skills',
        fixed_working_day_id: null,
        fixed_time_slot_id: null,
        weekly_sessions: 1,
        session_duration_minutes: 120,
        is_full_day_session: false,
        unit_offering_fixed_slots: [],
        cohorts: { code: 'CND-JAN-2027', name: 'CND JAN 27', actual_size: 0, programmes: { department_id: 'dept-1' } },
        units: { code: 'CND 1101', name: 'Communication Skills', weekly_sessions: 1, department_id: 'dept-1', owning_department: null, is_service_unit: false, departments: null, unit_equivalence_members: null },
      },
      {
        id: 'off-dnd',
        cohort_id: 'cohort-dnd',
        unit_id: 'unit-dnd',
        allocation_status: 'unallocated',
        is_provisionally_reserved: false,
        confirmed_shared_offering_id: 'shared-comm-skills',
        fixed_working_day_id: null,
        fixed_time_slot_id: null,
        weekly_sessions: 1,
        session_duration_minutes: 120,
        is_full_day_session: false,
        unit_offering_fixed_slots: [],
        cohorts: { code: 'DND-JAN-2027', name: 'DND JAN 27', actual_size: 0, programmes: { department_id: 'dept-1' } },
        units: { code: 'DND 105', name: 'Communication Skills', weekly_sessions: 1, department_id: 'dept-1', owning_department: null, is_service_unit: false, departments: null, unit_equivalence_members: null },
      },
    ];
    const { default: Page } = await import('@/app/(dashboard)/timetable/teaching-allocations/page');
    const element = await Page({
      searchParams: Promise.resolve({ period: '5e16a453-5977-435d-890e-57abbfc2e52e' }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Reserve all unassigned (1)');
    expect(html).toContain('1 class from 2 cohort units (shared units merged)');
    expect(html).toContain('CND-JAN-2027 + DND-JAN-2027');
  });
});
