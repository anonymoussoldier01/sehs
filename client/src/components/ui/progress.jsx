import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Progress. HeroUI-compat: `maxValue` maps to `max`.
 */
function Progress({ className, value, max, maxValue, ...props }) {
  const maxV = max ?? maxValue ?? 100;
  const pct = maxV > 0 ? Math.min(100, Math.max(0, ((value ?? 0) / maxV) * 100)) : 0;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={maxV}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-[var(--bg2)]', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full rounded-full bg-[var(--primary)] transition-all"
        style={{ width: `${pct}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
