export interface LoginActionState {
  status: 'idle' | 'error';
  message: string | null;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
}

export const initialLoginActionState: LoginActionState = {
  status: 'idle',
  message: null,
};