import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'w-full rounded-[10px] border border-[var(--line2)] bg-[var(--panel)] px-3.5 py-2.5 text-sm text-[var(--txt)] shadow-sm outline-none transition-all placeholder:text-[var(--faint)] focus:border-[var(--acc)] focus:ring-2 focus:ring-[var(--acc-line)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
