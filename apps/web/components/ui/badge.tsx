import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import type { BookingStatus, PaymentStatus } from '@repo/types';
import { cn } from '@/lib/utils';
import { formatBilingual, type Bilingual } from '@/lib/copy';

/**
 * Base badge — one variant per DESIGN.md semantic status color, plus
 * `accent` (tenant white-label, NOT used for status meaning) and
 * `neutral` (no status opinion — e.g. terminal-but-unremarkable states).
 * These are the SAME six fixed status colors everywhere in the app —
 * never re-skinned by tenant or theme (docs/DESIGN.md).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        ok: 'border-status-ok/30 bg-status-ok/10 text-status-ok',
        warn: 'border-status-warn/30 bg-status-warn/10 text-status-warn',
        danger: 'border-status-danger/30 bg-status-danger/10 text-status-danger',
        info: 'border-status-info/30 bg-status-info/10 text-status-info',
        'pay-onsite': 'border-status-pay-onsite/30 bg-status-pay-onsite/10 text-status-pay-onsite',
        line: 'border-status-line/30 bg-status-line/10 text-status-line',
        accent: 'border-accent/30 bg-accent-tint text-accent-ink',
        neutral: 'border-line-300 bg-surface-2 text-fg-muted',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const BOOKING_STATUS_META: Record<BookingStatus, { variant: BadgeVariant; label: Bilingual }> = {
  PENDING_VERIFICATION: { variant: 'warn', label: { th: 'รอยืนยันตัวตน', en: 'Pending verification' } },
  PENDING_PAYMENT: { variant: 'warn', label: { th: 'รอชำระเงิน', en: 'Pending payment' } },
  PENDING_PAYMENT_CONFIRMATION: {
    variant: 'info',
    label: { th: 'รอตรวจสอบการชำระเงิน', en: 'Pending confirmation' },
  },
  CONFIRMED: { variant: 'ok', label: { th: 'ยืนยันแล้ว', en: 'Confirmed' } },
  CANCELLATION_REQUESTED: {
    variant: 'warn',
    label: { th: 'ขอยกเลิก', en: 'Cancellation requested' },
  },
  REJECTED: { variant: 'danger', label: { th: 'ถูกปฏิเสธ', en: 'Rejected' } },
  EXPIRED: { variant: 'danger', label: { th: 'หมดเวลา', en: 'Expired' } },
  CANCELLED: { variant: 'danger', label: { th: 'ยกเลิกแล้ว', en: 'Cancelled' } },
  COMPLETED: { variant: 'ok', label: { th: 'เสร็จสิ้น', en: 'Completed' } },
  NO_SHOW: { variant: 'danger', label: { th: 'ไม่มาใช้บริการ', en: 'No-show' } },
};

const PAYMENT_STATUS_META: Record<PaymentStatus, { variant: BadgeVariant; label: Bilingual }> = {
  AWAITING_SLIP_UPLOAD: { variant: 'warn', label: { th: 'รออัปโหลดสลิป', en: 'Awaiting slip' } },
  SLIP_UPLOADED_PENDING_REVIEW: {
    variant: 'info',
    label: { th: 'รอตรวจสอบสลิป', en: 'Slip pending review' },
  },
  CONFIRMED: { variant: 'ok', label: { th: 'ยืนยันแล้ว', en: 'Confirmed' } },
  REJECTED: { variant: 'danger', label: { th: 'ถูกปฏิเสธ', en: 'Rejected' } },
  PAY_ONSITE_NOT_COLLECTED: {
    variant: 'pay-onsite',
    label: { th: 'ชำระที่สนาม', en: 'Pay onsite' },
  },
};

interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Bilingual by default (`"th / en"`, per `lib/copy.ts`); pass `false` for English-only UI chrome. */
  bilingualLabel?: boolean;
}

/** `BookingStatus` → the correct semantic `Badge` variant + bilingual label. */
export function BookingStatusBadge({
  status,
  bilingualLabel = true,
  className,
  ...props
}: StatusBadgeProps & { status: BookingStatus }) {
  const meta = BOOKING_STATUS_META[status];
  return (
    <Badge variant={meta.variant} className={className} {...props}>
      {bilingualLabel ? formatBilingual(meta.label) : meta.label.en}
    </Badge>
  );
}

/** `PaymentStatus` → the correct semantic `Badge` variant + bilingual label. */
export function PaymentStatusBadge({
  status,
  bilingualLabel = true,
  className,
  ...props
}: StatusBadgeProps & { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return (
    <Badge variant={meta.variant} className={className} {...props}>
      {bilingualLabel ? formatBilingual(meta.label) : meta.label.en}
    </Badge>
  );
}
