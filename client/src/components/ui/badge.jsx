import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[var(--acc-line)] bg-transparent text-[var(--acc)]',
        secondary: 'border-[var(--line)] bg-[var(--bg2)] text-[var(--mut)]',
        success: 'border-transparent bg-[var(--ok-bg)] text-[var(--ok)]',
        accent: 'border-[var(--acc-line)] bg-transparent text-[var(--acc)]',
        warning: 'border-transparent bg-[var(--warn-bg)] text-[var(--warn)]',
        destructive: 'border-transparent bg-[var(--bad-bg)] text-[var(--bad)]',
        outline: 'border-[var(--line2)] bg-transparent text-[var(--mut)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * shadcn/ui Badge. Replaces HeroUI `Chip`.
 * Accepts HeroUI-compat props: `size` (ignored, sm is default),
 * `color="success|accent"` maps to the matching variant.
 */
function Badge({ className, variant = 'default', color, size, ...props }) {
  const resolved = color === 'success' ? 'success' : color === 'accent' ? 'accent' : variant;
  return <span data-slot="badge" className={cn(badgeVariants({ variant: resolved }), className)} {...props} />;
}

export { Badge, badgeVariants };
