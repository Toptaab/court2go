/**
 * Bilingual copy convention (M10.1 — every later slice follows this).
 *
 * docs/DESIGN.md: "Copy is bilingual (Thai + English). Preserve Thai
 * strings verbatim [from the Claude Design mockups]." This file just
 * fixes the SHAPE that convention takes in code — a plain `{ th, en }`
 * object, no i18n framework, no locale routing (out of scope for MVP).
 *
 * Usage: `bilingual('ยืนยันการจอง', 'Confirm booking')` inline at the
 * call site (JSX renders `copy.th` / `copy.en` directly — most screens in
 * the design show both, stacked or paired), or `formatBilingual(copy)`
 * where a single string is needed (toasts, error messages, `<title>`).
 */

export interface Bilingual {
  th: string;
  en: string;
}

export function bilingual(th: string, en: string): Bilingual {
  return { th, en };
}

/** Single-string rendering of a `Bilingual` pair — Thai first, per DESIGN.md ordering. */
export function formatBilingual(copy: Bilingual): string {
  return `${copy.th} / ${copy.en}`;
}
