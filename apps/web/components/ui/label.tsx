import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Token-driven form label — see `components/ui/input.tsx` for why this was factored out. */
export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-xs font-medium text-fg', className)} {...props} />;
}
