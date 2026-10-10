import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('', className)} {...props} />;
}

function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-1 shadow-sm',
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex min-h-[36px] items-center justify-center rounded-lg px-4 py-1.5 text-sm font-bold text-[var(--mut)] outline-none transition-all hover:text-[var(--txt)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[state=active]:bg-[var(--txt)] data-[state=active]:text-[var(--bg)] data-[state=active]:shadow-sm disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('pt-2 outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
