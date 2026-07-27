import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Canonical shadcn/ui-style class merger — every `components/ui/*`
 * primitive uses this for its `className` prop so caller overrides win
 * over the component's own defaults instead of just concatenating.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
