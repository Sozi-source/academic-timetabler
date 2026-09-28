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
  sm: 'min-h-8 rounded-md px-2.5 py-1.5 text-[11px] xl:min-h-8.5 xl:px-3 xl:py-1.5 xl:text-xs',
  md: 'min-h-8.5 rounded-md px-3 py-1.5 text-[12px] xl:min-h-9 xl:px-3.5 xl:py-2 xl:text-xs',
  lg: 'min-h-9.5 rounded-lg px-4 py-2 text-[13px] xl:min-h-10 xl:px-4.5 xl:py-2 xl:text-sm',
  icon: 'size-8.5 rounded-md xl:size-9',
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
    'inline-flex max-w-full shrink-0 items-center justify-center gap-2 whitespace-normal text-center border font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-institutional-yellow/30 focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-55',
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
