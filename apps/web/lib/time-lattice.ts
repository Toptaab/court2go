/**
 * The fixed 30-min lock lattice (CLAUDE.md invariant, `packages/types`
 * `latticeAlignedTimeSchema`) constrains a Court's per-day `openTime`/
 * `closeTime` to the `:00`/`:30` minute grid (`24:00` also allowed, as
 * end-of-day close). This file is the ONE place `apps/web` generates the
 * option list a `<select>` offers for those two fields — never let a user
 * type/pick an off-lattice value (e.g. `:15`) for a Court schedule.
 *
 * Branch business hours (`timeOfDaySchema`, unconstrained) and peak-range
 * boundaries do NOT use this — those accept any `HH:MM` and should use a
 * plain `<input type="time">` instead (see `components/admin/branch-form.tsx`
 * / `court-form.tsx`).
 */

/** Every `:00`/`:30` time from `00:00` through `24:00` inclusive — 49 options. */
export const LATTICE_TIME_OPTIONS: string[] = (() => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    options.push(`${String(h).padStart(2, '0')}:00`);
    options.push(`${String(h).padStart(2, '0')}:30`);
  }
  options.push('24:00');
  return options;
})();
