import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BannerVariant = 'info' | 'danger' | 'warn' | 'ok';

interface BannerProps {
  variant: BannerVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BannerVariant, string> = {
  info: 'bg-status-info/5 text-status-info border-status-info/15',
  danger: 'bg-status-danger/5 text-status-danger border-status-danger/15',
  warn: 'bg-status-warn/5 text-status-warn-ink border-status-warn/15',
  ok: 'bg-status-ok/5 text-status-ok border-status-ok/15',
};

const variantIcons: Record<BannerVariant, string> = {
  info: 'ℹ',
  danger: '⚠',
  warn: '⚡',
  ok: '✓',
};

/**
 * Banner / alert component (Design `.banner .b-{variant}` pattern).
 *
 * Visual spec from design:
 * - rounded-md, padding 12px 13px, font-size 12.5px
 * - Icon on left (flex-none, 15px), message content on right
 * - Variants: info (blue), danger (red), warn (amber), ok (green)
 *
 * Used for:
 * - M18 recovery states (slot expired, payment rejected)
 * - M6 info notes about pricing
 * - M10 payment instructions
 */
export function Banner({ variant, children, className }: BannerProps) {
  return (
    <div
      className={cn(
        'flex gap-2 rounded-md border px-3 py-3 text-[12.5px]',
        variantStyles[variant],
        className,
      )}
    >
      <span className="flex-none text-[15px]">{variantIcons[variant]}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
