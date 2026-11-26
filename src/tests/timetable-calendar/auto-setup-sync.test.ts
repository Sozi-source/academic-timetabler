import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcCalls: Array<{ fn: string; params: unknown }> = [];
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/features/auth/authorization', () => ({
  requireHodAccess: async () => ({
    id: 'user-1',
    activeDepartmentId: 'dept-1',
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'working_days') {
        const chain = {
          select: () => chain,
          insert: async () => ({ error: null }),
          upsert: async () => ({ error: null }),
          eq: () => chain,
          then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
            Promise.resolve({ data: [{ id: 'day-mon' }], error: null }).then(resolve),
        };
        return chain;
      }
      if (table === 'time_slots') {
        const chain = {
          select: () => chain,
          insert: async () => ({ error: null }),
          eq: () => chain,
          then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
            Promise.resolve({ data: [{ id: 'slot-am' }], error: null }).then(resolve),
        };
        return chain;
      }
      if (table === 'trainers') {
        const chain = {
          select: () => chain,
          update: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({
            data: { id: 'trainer-1', availability_mode: 'generally_available' },
            error: null,
          }),
          then: (resolve: (value: { error: null }) => void) =>
            Promise.resolve({ error: null }).then(resolve),
        };
        return chain;
      }
      if (table === 'trainer_availability') {
        const chain = {
          delete: () => chain,
          insert: async () => ({ error: null }),
          eq: () => chain,
          then: (resolve: (value: { error: null }) => void) =>
            Promise.resolve({ error: null }).then(resolve),
        };
        return chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: async (fn: string, params: unknown) => {
      rpcCalls.push({ fn, params });
      return { data: 3, error: null };
    },
  }),
}));

import { initializeDefaultWorkingDaysAction } from '@/features/timetable-calendar/actions';
import { saveTrainerAvailabilityAction } from '@/features/trainers/availability-actions';

describe('standing timetable setup auto-propagation', () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    revalidatePathMock.mockClear();
  });

  it('propagates default working days forward to future planned periods', async () => {
    const fd = new FormData();
    fd.set('academicPeriodId', '11111111-1111-4111-8111-111111111111');

    await initializeDefaultWorkingDaysAction(fd);

    expect(rpcCalls).toEqual([
      {
        fn: 'propagate_timetable_setup_to_planned_periods',
        params: {
          p_source_period_id: '11111111-1111-4111-8111-111111111111',
        },
      },
    ]);
  });

  it('syncs saved trainer availability into upcoming planned periods automatically', async () => {
    const fd = new FormData();
    fd.set('trainerId', 'trainer-1');
    fd.set('academicPeriodId', 'period-active');

    await saveTrainerAvailabilityAction(fd);

    expect(rpcCalls).toContainEqual({
      fn: 'sync_trainer_availability_to_future_periods',
      params: {
        p_trainer_id: 'trainer-1',
        p_source_period_id: 'period-active',
      },
    });
  });
});
