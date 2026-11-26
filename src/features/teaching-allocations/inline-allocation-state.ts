export interface InlineAllocationMutationState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  rescheduleNeeded?: boolean;
  availabilityRequired?: {
    trainerId: string;
    periodId: string;
  };
  sequence: number;
}

export const initialInlineAllocationState: InlineAllocationMutationState = {
  status: 'idle',
  sequence: 0,
};
