# court2go — Design Index

Demo tenant: **Baseline Club** (court/venue booking SaaS, mobile-first client + desktop admin).
All screens live in **Claude Design** — this is the source of truth for UI. Build the frontend against these.

**Project:** https://claude.ai/design/p/a0e0fbcc-c7d3-4f23-bee6-46a8e73de7ac

| Page | Surface | Link |
|---|---|---|
| `client-mobile.html` | Client (mobile-first) booking flow | [open](https://claude.ai/design/p/a0e0fbcc-c7d3-4f23-bee6-46a8e73de7ac?file=client-mobile.html) |
| `admin-console.html` | Admin console (desktop) | [open](https://claude.ai/design/p/a0e0fbcc-c7d3-4f23-bee6-46a8e73de7ac?file=admin-console.html) |
| `coverage-whitelabel.html` | Remaining admin screens + white-label proof | [open](https://claude.ai/design/p/a0e0fbcc-c7d3-4f23-bee6-46a8e73de7ac?file=coverage-whitelabel.html) |

## Screen inventory (IDs map to PRD stories)

**Client (M-series):** M1 news feed · M3 branch · M4 sport · M5 court/date/per-court grid/slot-count · M6 review+promo+price · M7a normal login (LINE + phone) · M7b booking-gate login (SMS-OTP only) · M8 OTP + error · M10 PromptPay QR + slip · M11 pending · M12 confirmed (QR) · M13 confirmed (onsite) · M14 my-bookings · M15/M16 detail+cancel · M17 profile edit · M18 recovery/empty · M19 profile.

**Admin (D-series):** D1 calendar (courts × per-court grid) · D2 booking list + filters · D4 slip review · D5 cancellation queue · D6 walk-in booking · D7 court editor (schedule/grid-interval + max-slots/pricing) · D9 branch editor (payment method + PromptPay) · D11 promotions · D12 members · D13 news editor · D14 config · D15 branding · D16 roles matrix.

## Design system (extract into frontend tokens)

- **Primary/accent:** `--accent: #0C8C6A` (court teal). Every tint derives via `color-mix(in oklab, var(--accent), …)`. White-label = swap this one variable per tenant. Contrast-checked at save; `--accent-ink` flips text to ink on pale colors.
- **Semantic status (never re-skinned):** ok `#1F9D57` · warn `#C98A0E` · danger `#D24236` · info `#2F6FEB` · pay-onsite `#5B5BD6` · LINE `#06C755`.
- **Ink scale:** 900 `#15181B` · 700 `#3A3F45` · 500 `#6B7178` · 300 `#A9AEB4`. Lines `#E4E6E3`/`#CDD0CC`.
- **Type:** `--sans` system-ui stack (Noto Sans Thai for Thai) · `--disp` display · `--mono` "scoreboard" numerals for times/prices/codes.
- **Dark mode:** every page ships `@media (prefers-color-scheme:dark)` + `:root[data-theme=…]` overrides.
- **Live tweaker:** each page has a bottom-right panel — primary-color picker (live `--accent` re-skin) + font dropdown (System/Inter/Poppins/IBM Plex Sans/Sarabun). Google Fonts via `<link>`; falls back to system-ui if CSP-blocked. This is a demo aid — do NOT ship it into production frontend.

## Notes for frontend build
- Copy is bilingual (Thai + English). Preserve Thai strings verbatim.
- The per-court **grid interval** ({30,60,90,120} min, sets start-time spacing) + **max slots** (booking spans 1..maxSlots contiguous grid units) drive the whole booking flow — model it as the core primitive. Booking UI picks a start time then a slot count (not a duration list).
- Admin chrome stays neutral (never tenant-tinted); accent only on primary actions + branding preview.
