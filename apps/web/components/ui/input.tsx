import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Token-driven text input — the same classes every hand-rolled `<input>`
 * across M10.5–M10.8 already used inline (walk-in form, cancel/reject
 * reason fields); factored out here (M10.9) because the catalog editors
 * have enough fields that inlining this class string everywhere would drift.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300',
        'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
