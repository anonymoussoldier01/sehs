import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-bold outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm hover:brightness-110 active:scale-[.98]',
        primary: 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm hover:brightness-110 active:scale-[.98]',
        secondary: 'border border-[var(--line2)] bg-[var(--panel)] text-[var(--txt)] shadow-sm hover:-translate-y-px',
        outline: 'border border-[var(--line2)] bg-transparent text-[var(--txt)] shadow-sm hover:bg-[var(--bg2)]',
        ghost: 'text-[var(--txt)] hover:bg-[var(--bg2)]',
        destructive: 'bg-[var(--destructive)] text-white shadow-sm hover:brightness-110',
        link: 'text-[var(--acc)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-[42px] px-5 py-2.5',
        sm: 'min-h-[36px] rounded-[10px] px-3.5 py-1.5 text-[13px]',
        lg: 'min-h-[48px] rounded-[12px] px-6 text-base',
        icon: 'h-10 w-10 min-h-[40px] min-w-[40px] p-0',
        'icon-sm': 'h-8 w-8 min-h-[32px] min-w-[32px] rounded-lg p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * shadcn/ui Button with HeroUI-compat props so the migration stays runnable:
 * - `onPress` maps to `onClick`
 * - `isDisabled` maps to `disabled`
 * - `isIconOnly` maps to `size="icon"`
 * - `fullWidth` adds `w-full`
 * - `variant="primary"` maps to `default`
 */
function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  fullWidth = false,
  isIconOnly = false,
  isDisabled = false,
  disabled,
  onPress,
  onClick,
  type,
  ...props
}) {
  const Comp = asChild ? Slot : 'button';
  const handleClick = (e) => {
    if (onPress) onPress(e);
    if (onClick) onClick(e);
  };
  return (
    <Comp
      data-slot="button"
      type={type ?? (asChild ? undefined : 'button')}
      disabled={disabled ?? isDisabled ?? undefined}
      onClick={handleClick}
      className={cn(
        buttonVariants({ variant: variant === 'primary' ? 'default' : variant, size: isIconOnly ? 'icon' : size }),
        fullWidth && 'w-full',
        className
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };
