import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Token-driven `<select>` — see `components/ui/input.tsx` for why this was factored out. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg',
        'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';
