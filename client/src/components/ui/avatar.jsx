import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

function Avatar({ className, ...props }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        'grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-full border border-[var(--line2)] bg-[var(--bg2)] text-sm font-bold text-[var(--txt)]',
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn('grid h-full w-full place-items-center bg-[var(--bg2)] text-sm font-bold', className)}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
