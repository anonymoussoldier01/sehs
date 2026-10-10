import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-[10px] border border-[var(--line)] bg-[var(--card)] p-4', className)}
      aria-hidden="true"
      {...props}
    >
      <div className="h-4 w-3/5 rounded-md bg-[var(--bg2)]" />
      <div className="mt-2.5 h-3 w-[90%] rounded-md bg-[var(--bg2)]" />
    </div>
  );
}

export { Skeleton };
