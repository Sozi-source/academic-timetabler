import { Slot } from '@radix-ui/react-slot';
import type {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';

import { cn } from '@/lib/utils/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';

export type ButtonSize =
  | 'sm'
  | 'md'
  | 'lg'
  | 'icon';

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  asChild?: boolean;
}

const variantClasses: Record<
  ButtonVariant,
  string
> = {
  primary:
    'border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
  secondary:
    'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary-hover',
  outline:
    'border-border-strong bg-surface text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
  ghost:
    'border-transparent bg-transparent text-text-secondary hover:bg-navigation-hover hover:text-text-primary',
  danger:
    'border-transparent bg-danger text-white hover:opacity-90',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-lg px-3 text-xs',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-xl px-5 text-sm',
  icon: 'size-10 rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = 'button',
  asChild = false,
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center gap-2 border font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35 disabled:pointer-events-none disabled:opacity-55',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}