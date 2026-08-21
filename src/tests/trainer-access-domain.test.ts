import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  canProvisionTrainerAccess,
  summarizeTrainerAccess,
  trainerAccessLabel,
} from '@/features/trainer-access/domain';
import type {
  TrainerAccessRecord,
} from '@/features/trainer-access/types';
import {
  canUsePostLoginPath,
  getHomePathForRole,
} from '@/features/auth/routing';

function record(
  accessState:
    TrainerAccessRecord['accessState'],
): TrainerAccessRecord {
  return {
    trainerId:
      crypto.randomUUID(),
    fullName:
      'Trainer',
    email:
      'trainer@example.com',
    trainerActive:
      true,
    linkedProfileId:
      null,
    matchedProfileId:
      null,
    profileRole:
      null,
    profileActive:
      null,
    accessState,
  };
}

describe('trainer access domain', () => {
  it('keeps pending accounts out of privileged homes', () => {
    expect(
      getHomePathForRole(
        'pending',
      ),
    ).toBe(
      '/unauthorized',
    );

    expect(
      canUsePostLoginPath(
        'pending',
        '/dashboard',
      ),
    ).toBe(
      false,
    );

    expect(
      canUsePostLoginPath(
        'pending',
        '/staff',
      ),
    ).toBe(
      false,
    );
  });

  it('allows manual linking only when a matching account is ready', () => {
    expect(
      canProvisionTrainerAccess(
        'ready_to_link',
      ),
    ).toBe(
      true,
    );

    expect(
      canProvisionTrainerAccess(
        'administrative_profile',
      ),
    ).toBe(
      false,
    );
  });

  it('summarizes access states', () => {
    expect(
      summarizeTrainerAccess([
        record(
          'linked',
        ),
        record(
          'ready_to_link',
        ),
        record(
          'account_required',
        ),
      ]),
    ).toEqual({
      total:
        3,
      linked:
        1,
      ready:
        1,
      accountRequired:
        1,
    });
  });

  it('uses concise labels', () => {
    expect(
      trainerAccessLabel(
        'account_required',
      ),
    ).toBe(
      'Account required',
    );
  });
});
