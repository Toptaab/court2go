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
 *
 * Chip look, per the `admin-console.html` mockup: borderless, with a
 * leading 6px dot in the FULL-strength status color ahead of the label,
 * and a soft tinted background — `color-mix(in oklab, <status>, #fff 84%)`
 * — i.e. the status color mixed to ~16% strength against white, applied
 * as an inline style (Tailwind can't express `color-mix()` as a static
 * utility). `accent`/`neutral` carry no status meaning, so they keep
 * their existing bordered/flat look and render without a dot.
 */
const STATUS_VARIANTS = ['ok', 'warn', 'danger', 'info', 'pay-onsite', 'line'] as const;
type StatusVariant = (typeof STATUS_VARIANTS)[number];

function isStatusVariant(variant: string | null | undefined): variant is StatusVariant {
  return !!variant && (STATUS_VARIANTS as readonly string[]).includes(variant);
}

/** `--status-<variant>` CSS custom property backing a status color, e.g. `pay-onsite` → `--status-pay-onsite`. */
function statusVar(variant: StatusVariant) {
  return `var(--status-${variant})`;
}

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        ok: 'text-status-ok',
        // Darkened for contrast vs. the plain status-warn hex (DESIGN.md
        // mockup). Light/dark values live in the shared `--status-warn-ink`
        // token in `app/globals.css` (mapped to `status-warn-ink` in
        // tailwind.config.ts), so this stays a single-source token reference
        // like every other status color.
        warn: 'text-status-warn-ink',
        danger: 'text-status-danger',
        info: 'text-status-info',
        'pay-onsite': 'text-status-pay-onsite',
        line: 'text-status-line',
        accent: 'border border-accent/30 bg-accent-tint text-accent-ink',
        neutral: 'border border-line-300 bg-surface-2 text-fg-muted',
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

export function Badge({ className, variant, style, children, ...props }: BadgeProps) {
  const resolvedVariant = variant ?? 'neutral';
  const dotColor = isStatusVariant(resolvedVariant) ? statusVar(resolvedVariant) : null;

  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      style={
        dotColor
          ? { backgroundColor: `color-mix(in oklab, ${dotColor}, #fff 84%)`, ...style }
          : style
      }
      {...props}
    >
      {dotColor ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      ) : null}
      {children}
    </span>
  );
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
