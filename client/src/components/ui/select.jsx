import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * shadcn-styled native select (accessible, keyboard-friendly, no JS popover
 * positioning issues). API mirrors shadcn's Select value/onValueChange, with
 * HeroUI-compat aliases `selectedKey` / `onSelectionChange` so existing call
 * sites keep working during migration.
 *
 * Options are plain <option> children:
 *   <Select value={sort} onValueChange={setSort} aria-label="Sort">
 *     <option value="relevance">Best match</option>
 *   </Select>
 */
function Select({
  className,
  children,
  value,
  selectedKey,
  onValueChange,
  onSelectionChange,
  placeholder,
  ...props
}) {
  const resolved = value ?? selectedKey ?? '';
  const handle = (e) => {
    const v = e.target.value;
    if (onValueChange) onValueChange(v);
    if (onSelectionChange) onSelectionChange(v);
    if (props.onChange) props.onChange(e);
  };
  return (
    <span data-slot="select" className={cn('relative inline-flex items-center', className)}>
      <select
        data-slot="select-trigger"
        value={resolved}
        onChange={handle}
        className={cn(
          'min-h-[42px] w-full appearance-none rounded-[10px] border border-[var(--line2)] bg-[var(--panel)] py-2 pl-3.5 pr-9 text-sm font-semibold text-[var(--txt)] shadow-sm outline-none transition-all focus:border-[var(--acc)] focus:ring-2 focus:ring-[var(--acc-line)] disabled:cursor-not-allowed disabled:opacity-50'
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 h-4 w-4 text-[var(--faint)]"
      />
    </span>
  );
}

export { Select };
