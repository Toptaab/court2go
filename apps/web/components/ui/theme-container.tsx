import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ThemeContainerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Tenant white-label override for `--accent` (docs/DESIGN.md: "White-label
   * = swap this one variable per tenant"). Pass the tenant's brand hex once
   * a tenant/branding fetch exists (M10.2+); omit to fall through to the
   * platform default (`--accent: #0C8C6A`, `app/globals.css`).
   *
   * Deliberately just ONE variable — every tint (`--accent-tint`,
   * `--accent-tint-strong`) is `color-mix()`-derived from it in
   * `app/globals.css`, so overriding it here re-skins everything downstream
   * with no other prop needed.
   */
  accent?: string;
  /** Force a color scheme for this subtree regardless of OS preference. */
  theme?: 'light' | 'dark';
}

/**
 * The token-scoping primitive every page-level shell wraps its content in.
 * Sets `--accent` (and optionally `data-theme`) as inline style on a div —
 * CSS custom properties cascade to all descendants, so nothing below this
 * needs to know it's tenant-tinted.
 *
 * The `(admin)` layout intentionally does NOT use the `accent` prop for its
 * chrome (DESIGN.md: admin chrome stays neutral) — it only reaches for
 * `ThemeContainer` with `theme` when it needs to pin a color scheme, and
 * scopes `accent` narrowly to primary actions / the branding preview, not
 * the page shell.
 */
export function ThemeContainer({
  accent,
  theme,
  className,
  style,
  ...props
}: ThemeContainerProps) {
  const themedStyle: CSSProperties = {
    ...(accent ? { '--accent': accent } : {}),
    ...style,
  } as CSSProperties;

  return (
    <div
      data-theme={theme}
      style={themedStyle}
      className={cn('bg-bg text-fg', className)}
      {...props}
    />
  );
}
