import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type AvatarSize =
  | 'sm'
  | 'md'
  | 'lg';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: AvatarSize;
  fallbackIcon?: ReactNode;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'size-8 text-[0.625rem]',
  md: 'size-10 text-xs',
  lg: 'size-12 text-sm',
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function Avatar({
  name,
  imageUrl,
  size = 'md',
  fallbackIcon,
  className,
}: AvatarProps) {
  const initials = getInitials(name);

  return (
    <div
      title={name}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary-soft font-semibold text-primary',
        sizeClasses[size],
        className,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="size-full object-cover"
        />
      ) : (
        initials || fallbackIcon
      )}
    </div>
  );
}