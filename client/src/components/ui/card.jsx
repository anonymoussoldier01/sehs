import * as React from 'react';
import { cn } from '@/lib/utils';

function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-[14px] border border-[var(--line)] bg-[var(--card)] p-[18px] text-[var(--txt)] shadow-sm',
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1', className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return (
    <h3
      data-slot="card-title"
      className={cn('font-display text-[15.5px] font-bold leading-snug', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }) {
  return (
    <p data-slot="card-description" className={cn('text-[13px] text-[var(--mut)]', className)} {...props} />
  );
}

function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn('', className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return (
    <div
      data-slot="card-footer"
      className={cn('mt-auto flex items-center gap-2 border-t border-dashed border-[var(--line)] pt-2.5', className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
