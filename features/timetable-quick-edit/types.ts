export type QuickEditActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  /** One suggested next step, shown right after the conflict message. */
  suggestion?: string | null;
};

export const initialQuickEditActionState: QuickEditActionState = {
  status: 'idle',
  message: null,
  suggestion: null,
};

/**
 * A Quick Edit changes exactly one of these at a time — see changes.md,
 * "No modal stacking". The action picked determines which single-purpose
 * RPC is called.
 */
export type QuickEditField = 'schedule' | 'room' | 'trainer';
