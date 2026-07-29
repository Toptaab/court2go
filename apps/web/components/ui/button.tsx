import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Token-driven button — every color is a Tailwind class bound to a
 * `var(--…)` in `app/globals.css` (`accent`/`status.*`/`ink`), never a
 * hardcoded hex. `primary` is the only variant that carries the tenant
 * `--accent` — so a tenant re-skin (swap one CSS variable) instantly
 * re-skins every primary CTA, while `destructive` stays the fixed
 * `--status-danger` regardless of tenant.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card text-sm font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
    'focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:opacity-90',
        secondary: 'bg-surface-2 text-fg border border-line-300 hover:bg-line-100',
        outline: 'border border-line-300 bg-transparent text-fg hover:bg-surface-2',
        ghost: 'bg-transparent text-fg hover:bg-surface-2',
        destructive: 'bg-status-danger text-white hover:opacity-90',
        line: 'bg-status-line text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
