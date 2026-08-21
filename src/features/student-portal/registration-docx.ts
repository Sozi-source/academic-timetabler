import type {
  StudentPortalRegistrationContext,
} from './types';

/**
 * The college-standardised registration form is intentionally not fabricated.
 *
 * This function remains as a compatibility boundary for the existing route.
 * It will be replaced by exact template ingestion once the official college
 * document is supplied.
 */
export async function buildStudentUnitRegistrationDocx(
  _context:
    StudentPortalRegistrationContext,
): Promise<Buffer> {
  throw new Error(
    'Official student unit-registration template is not configured.',
  );
}
