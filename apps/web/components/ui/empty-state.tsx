import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Emoji or icon content for the circle */
  icon?: string;
  title: string;
  description?: string;
  /** Optional action below the description */
  action?: ReactNode;
  className?: string;
}

/**
 * Empty state box (Design `.emptybox` pattern).
 *
 * Visual spec from design:
 * - Centered text, padding 36px 20px
 * - 60px circle with surface-2 bg, icon/emoji inside (26px)
 * - h3: 16px font-size, 5px margin-bottom
 * - p: 13px, ink-500, 16px margin-bottom
 * - Optional CTA button below
 *
 * Used for:
 * - No bookings state (M18)
 * - No news state
 * - Empty search results
 */
export function EmptyState({ icon = '📭', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center rounded-lg border border-line-100 px-5 py-9 text-center', className)}>
      <div className="mb-3.5 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-surface-2 text-[26px]">
        {icon}
      </div>
      <h3 className="mb-1 text-base font-semibold text-fg">{title}</h3>
      {description && (
        <p className="mb-4 text-[13px] text-ink-500">{description}</p>
      )}
      {action}
    </div>
  );
}
