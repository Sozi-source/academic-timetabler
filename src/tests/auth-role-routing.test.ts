import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  canUsePostLoginPath,
  getHomePathForRole,
} from '@/features/auth/routing';

describe('role-based authentication routing', () => {
  it('routes trainers to the staff workspace', () => {
    expect(
      getHomePathForRole(
        'trainer',
      ),
    ).toBe(
      '/staff',
    );
  });

  it('keeps HOD and system admin on the administrative dashboard', () => {
    expect(
      getHomePathForRole(
        'hod',
      ),
    ).toBe(
      '/dashboard',
    );

    expect(
      getHomePathForRole(
        'system_admin',
      ),
    ).toBe(
      '/dashboard',
    );
  });

  it('does not honor cross-role post-login destinations', () => {
    expect(
      canUsePostLoginPath(
        'trainer',
        '/dashboard',
      ),
    ).toBe(
      false,
    );

    expect(
      canUsePostLoginPath(
        'trainer',
        '/staff/units',
      ),
    ).toBe(
      true,
    );

    expect(
      canUsePostLoginPath(
        'hod',
        '/staff',
      ),
    ).toBe(
      false,
    );
  });
});
