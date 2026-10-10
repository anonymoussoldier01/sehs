import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui RadioGroup. HeroUI-compat: `isDisabled` maps to `disabled`,
 * `onChange(value)` maps to `onValueChange`.
 */
function RadioGroup({ className, disabled, isDisabled, onValueChange, onChange, ...props }) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      disabled={disabled ?? isDisabled ?? undefined}
      onValueChange={(v) => {
        if (onValueChange) onValueChange(v);
        if (onChange) onChange(v);
      }}
      className={cn('grid gap-2', className)}
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-[1.5px] border-[var(--line2)] bg-[var(--panel)] shadow-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[state=checked]:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" className="grid place-items-center">
        <Circle className="h-2.5 w-2.5 fill-[var(--primary)] text-[var(--primary)]" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
