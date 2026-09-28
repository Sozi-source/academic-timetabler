import type {
  TrainerAccessRecord,
  TrainerAccessState,
} from './types';

export function trainerAccessLabel(
  state: TrainerAccessState,
): string {
  switch (state) {
    case 'linked':
      return 'Linked';

    case 'ready_to_link':
      return 'Ready to link';

    case 'account_required':
      return 'Account required';

    case 'administrative_profile':
      return 'Admin profile';

    case 'email_required':
      return 'Email required';

    case 'inactive':
      return 'Inactive';

    default:
      return 'Review';
  }
}

export function trainerAccessDetail(
  record: TrainerAccessRecord,
): string {
  switch (record.accessState) {
    case 'linked':
      return 'Staff workspace enabled.';

    case 'ready_to_link':
      return 'Matching account found.';

    case 'account_required':
      return 'Trainer creates an account first.';

    case 'administrative_profile':
      return 'Administrative account uses this email.';

    case 'email_required':
      return 'Add an email to the trainer record.';

    case 'inactive':
      return 'Activate the trainer first.';

    default:
      return 'Check profile role and account status.';
  }
}

export function canProvisionTrainerAccess(
  state: TrainerAccessState,
): boolean {
  return state ===
    'ready_to_link';
}

export function summarizeTrainerAccess(
  records: TrainerAccessRecord[],
) {
  return {
    total:
      records.length,
    linked:
      records.filter(
        (record) =>
          record.accessState ===
          'linked',
      ).length,
    ready:
      records.filter(
        (record) =>
          record.accessState ===
          'ready_to_link',
      ).length,
    accountRequired:
      records.filter(
        (record) =>
          record.accessState ===
          'account_required',
      ).length,
  };
}
