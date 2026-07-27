import type { Config } from 'tailwindcss';

/**
 * Tailwind theme layer over the Claude Design tokens defined as CSS custom
 * properties in `app/globals.css` (docs/DESIGN.md — do not hardcode hex here,
 * everything is a `var(--…)` reference so a single edit to globals.css is
 * the ONLY place a token value ever lives).
 *
 * Two colour families, per DESIGN.md's explicit split:
 *  - `accent` — the tenant white-label variable. Swappable per tenant
 *    (`components/ui/theme-container.tsx` sets it via inline style).
 *  - `status.*` — semantic, fixed, NEVER re-skinned regardless of tenant
 *    or theme (ok/warn/danger/info/pay-onsite/line).
 */
const config: Config = {
  // Reserved/unused: nothing in this app uses the `dark:` variant — dark
  // mode here is a pure CSS-custom-property cascade driven by globals.css
  // (`@media (prefers-color-scheme: dark)` + `:root[data-theme="dark"]`),
  // not Tailwind's dark-mode utility prefix. Kept configured so a future
  // slice that *does* want `dark:` utilities has this set up correctly,
  // but don't reach for `dark:` classes expecting them to compose with
  // the token system above — they won't.
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          // rgb(var(...) / <alpha-value>) form so opacity modifiers
          // (`bg-accent/30` etc.) work — Tailwind v3 cannot derive an
          // alpha channel from an opaque `var(--accent)` hex reference.
          // `--accent-rgb` must be kept in sync with `--accent` (see
          // globals.css comment) whenever a tenant override swaps it.
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          ink: 'var(--accent-ink)',
          tint: 'var(--accent-tint)',
          'tint-strong': 'var(--accent-tint-strong)',
        },
        status: {
          // Same rgb(var(...) / <alpha-value>) pattern as `accent` above —
          // these are the only status colors any component applies an
          // opacity modifier to (see components/ui/badge.tsx).
          ok: 'rgb(var(--status-ok-rgb) / <alpha-value>)',
          warn: 'rgb(var(--status-warn-rgb) / <alpha-value>)',
          // Darkened ink for warn text on the soft chip tint (light/dark
          // handled in globals.css). Opaque — no alpha modifier needed.
          'warn-ink': 'var(--status-warn-ink)',
          danger: 'rgb(var(--status-danger-rgb) / <alpha-value>)',
          info: 'rgb(var(--status-info-rgb) / <alpha-value>)',
          'pay-onsite': 'rgb(var(--status-pay-onsite-rgb) / <alpha-value>)',
          line: 'rgb(var(--status-line-rgb) / <alpha-value>)',
        },
        ink: {
          900: 'var(--ink-900)',
          700: 'var(--ink-700)',
          500: 'var(--ink-500)',
          300: 'var(--ink-300)',
        },
        line: {
          100: 'var(--line-100)',
          300: 'var(--line-300)',
        },
        bg: 'var(--bg)',
        // `paper` = page/app-shell background; `surface` = card floating on it.
        // Keep them distinct — never collapse page bg onto card surface.
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
      },
      fontFamily: {
        sans: ['var(--sans)'],
        disp: ['var(--disp)'],
        mono: ['var(--mono)'],
      },
      borderRadius: {
        // Mockup radius scale (globals.css --r-*). `sm/md/lg` were unused by
        // any component, so mapping them onto the mockup ramp (7/10/14px) is
        // regression-free; `card` and Tailwind's `full`/`DEFAULT` are kept.
        card: '0.75rem',
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        pill: 'var(--pill)',
      },
    },
  },
  plugins: [],
};

export default config;
