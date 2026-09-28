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

export interface PasswordResetActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  email?: string;
  fieldErrors?: {
    email?: string[];
  };
}

export const initialPasswordResetActionState: PasswordResetActionState = {
  status: 'idle',
  message: null,
};

export interface UpdatePasswordActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    password?: string[];
    confirmPassword?: string[];
  };
}

export const initialUpdatePasswordActionState: UpdatePasswordActionState = {
  status: 'idle',
  message: null,
};