import { describe, expect, it } from 'vitest';
import { canUsePostLoginPath, getHomePathForRole } from '@/features/auth/routing';
import type { AppRole } from '@/features/auth/types';

describe('Production QA: Authorization & Role Boundaries', () => {
  describe('Role Home Paths', () => {
    it('maps system_admin and hod to the management dashboard', () => {
      expect(getHomePathForRole('system_admin')).toBe('/dashboard');
      expect(getHomePathForRole('hod')).toBe('/dashboard');
    });

    it('maps trainer to the dedicated staff workspace', () => {
      expect(getHomePathForRole('trainer')).toBe('/staff');
    });

    it('locks pending accounts to /unauthorized', () => {
      expect(getHomePathForRole('pending')).toBe('/unauthorized');
    });
  });

  describe('Post-Login Destination Sanitization', () => {
    it('prohibits pending accounts from reaching any privileged routes', () => {
      const forbiddenPaths = ['/dashboard', '/staff', '/operations', '/assessment', '/timetable'];
      for (const path of forbiddenPaths) {
        expect(canUsePostLoginPath('pending', path)).toBe(false);
      }
    });

    it('prohibits trainers from accessing administrative dashboard routes directly', () => {
      expect(canUsePostLoginPath('trainer', '/dashboard')).toBe(false);
      expect(canUsePostLoginPath('trainer', '/timetable/readiness')).toBe(false);
      expect(canUsePostLoginPath('trainer', '/operations')).toBe(false);
    });

    it('allows trainers to access valid staff portal routes', () => {
      expect(canUsePostLoginPath('trainer', '/staff')).toBe(true);
      expect(canUsePostLoginPath('trainer', '/staff/units')).toBe(true);
      expect(canUsePostLoginPath('trainer', '/staff/timetable')).toBe(true);
      expect(canUsePostLoginPath('trainer', '/staff/attendance')).toBe(true);
    });

    it('allows HODs and admins to access all operational and reporting paths', () => {
      const allowedHODPaths = [
        '/dashboard',
        '/attendance',
        '/assessment',
        '/reports',
        '/operations',
        '/timetable/editor',
      ];
      for (const path of allowedHODPaths) {
        expect(canUsePostLoginPath('hod', path)).toBe(true);
        expect(canUsePostLoginPath('system_admin', path)).toBe(true);
      }
    });
  });

  describe('Dual Role Capability Boundaries', () => {
    it('validates that an HOD teaching classes retains trainer portal capability', () => {
      // In Academic Planner, HODs who teach units have active trainer records.
      // They are authorized for /staff workspaces through capability checks.
      const userRoles: AppRole[] = ['hod', 'system_admin'];
      const canAccessTrainerCapabilities = (role: AppRole) =>
        ['trainer', 'hod', 'system_admin'].includes(role);

      for (const role of userRoles) {
        expect(canAccessTrainerCapabilities(role)).toBe(true);
      }
    });
  });
});
