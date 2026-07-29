import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Bilingual (Thai / English) screen title — H2, `font-disp` semibold. */
  title: string;
  /** Optional muted subtitle line under the title (e.g. scope/context copy, or a status chip). */
  subtitle?: ReactNode;
  /** Right-aligned actions slot (buttons, filter triggers, etc). */
  actions?: ReactNode;
}

/**
 * Per-screen admin page header (mockup's per-screen `.topbar`: title + sub on
 * the left, actions right-aligned). Every `/admin/**` page owns exactly one
 * of these — the shell's own `<header>` (`app/(admin)/layout.tsx`) stays a
 * blank neutral bar so a screen is never double-titled.
 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-100 pb-4 ">
      <div className="min-w-0">
        <h2 className="font-disp text-lg font-semibold text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
