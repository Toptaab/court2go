/**
 * @repo/domain — pure, deterministic business-rule functions (PRD A5.1, §5/§7/§9.1
 * of ARCHITECTURE). No I/O, no NestJS, no `Date.now()`/randomness inside logic —
 * every "now" instant is a parameter supplied by the caller.
 *
 *   grid.ts       start-time grid alignment, slot bounds, 30-min lock lattice expansion
 *   pricing.ts    peak/base per-grid-unit pricing + full PriceBreakdown assembly
 *   hold.ts       Tenant Hold TTL (5/10 min) expiry arithmetic
 *   promptpay.ts  EMVCo Merchant Presented Mode dynamic PromptPay QR payload + CRC16
 */
export * from './grid';
export * from './pricing';
export * from './hold';
export * from './promptpay';
