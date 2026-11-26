import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
const revalidatePathMock = vi.fn();

let rpcResult: { data: unknown; error: { message: string } | null } = {
  data: { allocationId: 'alloc-1', rescheduleRequired: false },
  error: null,
};

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock('@/features/auth/authorization', () => ({
  requireHodAccess: async () => ({
    id: 'user-1',
    activeDepartmentId: 'dept-1',
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const chain = {
      select: () => chain,
      update: () => chain,
      eq: () => chain,
      in: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (value: { data: unknown; error: null }) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return {
      from: () => chain,
      rpc: async () => rpcResult,
    };
  },
}));

import {
  assignOfferingInlineAction,
  reserveOfferingWithoutTrainerInlineAction,
  unassignTeachingAllocationInlineAction,
} from '@/features/teaching-allocations/simple-allocation-actions';
import { initialInlineAllocationState } from '@/features/teaching-allocations/inline-allocation-state';

describe('inline allocation actions (scroll-preserving)', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    rpcResult = {
      data: { allocationId: 'alloc-1', rescheduleRequired: false },
      error: null,
    };
  });

  it('assigns a trainer inline without calling redirect', async () => {
    const fd = new FormData();
    fd.set('offeringId', 'off-1');
    fd.set('trainerId', 'trainer-1');
    fd.set('academicPeriodId', 'period-1');

    const result = await assignOfferingInlineAction(initialInlineAllocationState, fd);

    expect(result).toEqual({
      status: 'success',
      rescheduleNeeded: false,
      sequence: 1,
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith('/timetable/teaching-allocations');
  });

  it('returns trainer-availability link metadata inline when selected slots are missing', async () => {
    rpcResult = {
      data: null,
      error: { message: 'Trainer must have an available teaching time for this slot.' },
    };
    const fd = new FormData();
    fd.set('offeringId', 'off-1');
    fd.set('trainerId', 'trainer-2');
    fd.set('academicPeriodId', 'period-1');

    const result = await assignOfferingInlineAction(initialInlineAllocationState, fd);

    expect(result.status).toBe('error');
    expect(result.availabilityRequired).toEqual({
      trainerId: 'trainer-2',
      periodId: 'period-1',
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('reserves and unassigns offerings inline without redirecting', async () => {
    const reserveFd = new FormData();
    reserveFd.set('offeringId', 'off-1');
    const reserved = await reserveOfferingWithoutTrainerInlineAction(
      initialInlineAllocationState,
      reserveFd,
    );
    expect(reserved.status).toBe('success');

    const unassignFd = new FormData();
    unassignFd.set('allocationId', 'alloc-1');
    const unassigned = await unassignTeachingAllocationInlineAction(
      initialInlineAllocationState,
      unassignFd,
    );
    expect(unassigned.status).toBe('success');
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
