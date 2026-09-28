import type {
  AppRole,
} from './types';

export function getHomePathForRole(
  role: AppRole,
): string {
  if (
    role ===
    'trainer'
  ) {
    return '/staff';
  }

  if (
    role ===
    'pending'
  ) {
    return '/unauthorized';
  }

  return '/dashboard';
}

export function canUsePostLoginPath(
  role: AppRole,
  path: string | null | undefined,
): boolean {
  if (
    role ===
    'pending' ||
    !path ||
    !path.startsWith(
      '/',
    ) ||
    path.startsWith(
      '//',
    )
  ) {
    return false;
  }

  if (path === '/reset-password') {
    return true;
  }

  if (
    role ===
    'trainer'
  ) {
    return (
      path ===
        '/staff' ||
      path.startsWith(
        '/staff/',
      )
    );
  }

  return !(
    path ===
      '/staff' ||
    path.startsWith(
      '/staff/',
    )
  );
}
