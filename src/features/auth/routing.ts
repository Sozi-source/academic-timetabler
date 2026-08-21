import type {
  AppRole,
} from './types';

export function getHomePathForRole(
  role: AppRole,
): string {
  return role ===
    'trainer'
    ? '/staff'
    : '/dashboard';
}

export function canUsePostLoginPath(
  role: AppRole,
  path: string | null | undefined,
): boolean {
  if (
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
