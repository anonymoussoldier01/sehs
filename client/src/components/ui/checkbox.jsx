import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Checkbox. HeroUI-compat: `isSelected` maps to `checked`,
 * `onChange(boolean)` maps to `onCheckedChange`.
 */
function Checkbox({ className, checked, isSelected, onCheckedChange, onChange, ...props }) {
  const resolved = checked ?? isSelected;
  const handle = (v) => {
    if (onCheckedChange) onCheckedChange(v);
    if (onChange) onChange(v);
  };
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={resolved}
      onCheckedChange={handle}
      className={cn(
        'grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border-[1.5px] border-[var(--line2)] bg-[var(--panel)] shadow-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[state=checked]:border-[var(--primary)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-items-center">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
