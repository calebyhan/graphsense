import { cn } from '@/lib/utils';

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
} as const;

interface AvatarProps {
  displayName: string;
  avatarColor: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function Avatar({ displayName, avatarColor, size = 'md', className }: AvatarProps) {
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 select-none',
        SIZE_CLASSES[size],
        className
      )}
      style={{ backgroundColor: avatarColor }}
      title={displayName}
    >
      {initial}
    </div>
  );
}
