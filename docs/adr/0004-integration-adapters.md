# ADR-0004: Integration adapters — ports & adapters for LINE, SMS OTP, PromptPay

## Status
Accepted

## Context
HANDOFF resolved decision #1 fixes three different integration postures for MVP: LINE Login + LINE OA notifications are **real** (need actual channel/OA credentials + webhook), SMS OTP is **stubbed** (no provider account yet, but must be swappable without an application rewrite later), and PromptPay QR generation is **real but gateway-free** (a deterministic, local computation — not a call to any payment provider). These three need to coexist cleanly without the "stubbed" one blocking development of everything that depends on it, and without the "real" ones being hard-wired in a way that makes local/CI testing require live LINE credentials.

## Decision
Ports-and-adapters (hexagonal) at the integration boundary, all under `apps/api/src/integrations/`:
- **Ports** (`ports/`): `OtpSender`, `LineClient`, `Notifier`, `PromptPayQrService`, `ObjectStorage` — interfaces only, no implementation detail leaks into consuming services (`AuthMemberService`, `BookingService`, `PaymentService`, `NotificationService` depend only on these interfaces).
- **Adapters** (`adapters/`): `StubSmsAdapter` (logs the code; returns it in the response DTO outside production for local testing — bound by default via `OTP_PROVIDER=stub`), `LineOaAdapter` (real OAuth2 code exchange + Messaging API push, real webhook handler for OA account-linking and future SMS-provider swap-in), `PromptPayAdapter` (wraps the pure EMVCo payload builder in `packages/domain` + QR image rendering), `S3Adapter`.
- Binding is via NestJS DI provider tokens, selected by env var (`OTP_PROVIDER`) — swapping the SMS stub for a real gateway later is a new adapter class + one provider-binding line, zero changes to any consuming service.
- PromptPay generation is deliberately **not** behind a swappable-provider abstraction the way OTP is — there's no "provider" to swap; the payload construction is a fixed, published EMVCo spec computed locally in `packages/domain` (pure function, unit-testable against Thai PromptPay test vectors), wrapped by a thin adapter only for image rendering.
- OTP codes are stored hashed (`OtpChallenge.codeHash`) regardless of which `OtpSender` adapter is bound — the stub only affects *delivery*, never storage/verification security.

## Consequences
- Every service that needs OTP, LINE, QR generation, or file storage is testable with fakes implementing the same interfaces — no live LINE/SMS account needed to run the test suite.
- Building the booking/payment lifecycle does not block on LINE credentials or an SMS provider account — both can be supplied later, and per HANDOFF, LINE credentials specifically need to be collected before the LINE module can be exercised end-to-end (flagged in ARCHITECTURE.md §9), while nothing else in the system depends on that timeline.
- The LINE webhook endpoint (`POST /webhooks/line`) is necessarily unauthenticated by the normal session/tenant guard stack (LINE calls it directly) — it is the one deliberately public endpoint, verified instead by LINE's HMAC signature header; called out explicitly so it isn't accidentally wrapped in a guard that would break it, or left unverified.
- A future real SMS provider swap is isolated to one adapter class and one env var — no risk of it touching booking/payment logic, which only ever calls `OtpSender.send()`.
