import { Global, Module, type Provider } from '@nestjs/common';
import { OTP_SENDER } from './ports/otp-sender.port';
import { LINE_CLIENT } from './ports/line-client.port';
import { OBJECT_STORAGE } from './ports/object-storage.port';
import { PROMPTPAY_QR } from './ports/promptpay-qr.port';
import { StubSmsAdapter } from './adapters/stub-sms.adapter';
import { StubLineAdapter } from './adapters/stub-line.adapter';
import { LocalObjectStorageAdapter } from './adapters/local-object-storage.adapter';
import { PromptPayAdapter } from './adapters/promptpay.adapter';

/**
 * Binds each integration port to a concrete adapter chosen by env
 * (`OTP_PROVIDER`, `LINE_PROVIDER`, both default `stub` — ARCHITECTURE §4).
 * Only the stub adapters exist today; adding a real provider is one new
 * `case` in the matching factory below plus the adapter class itself — no
 * change anywhere the tokens are consumed (`AuthMemberService`).
 *
 * `@Global()` so every feature module can `@Inject(OTP_SENDER)` /
 * `@Inject(LINE_CLIENT)` without re-importing this module everywhere.
 */
const otpSenderProvider: Provider = {
  provide: OTP_SENDER,
  useFactory: () => {
    const provider = process.env.OTP_PROVIDER ?? 'stub';
    switch (provider) {
      case 'stub':
      default:
        return new StubSmsAdapter();
    }
  },
};

const lineClientProvider: Provider = {
  provide: LINE_CLIENT,
  useFactory: () => {
    const provider = process.env.LINE_PROVIDER ?? 'stub';
    switch (provider) {
      case 'stub':
      default:
        return new StubLineAdapter();
    }
  },
};

/** `ObjectStorage` (ARCHITECTURE §4.4) — `local` (MVP stub, no real bucket
 * needed) is the only implementation today; a real S3/R2 adapter is a new
 * `case` here plus the adapter class. */
const objectStorageProvider: Provider = {
  provide: OBJECT_STORAGE,
  useFactory: () => {
    const provider = process.env.OBJECT_STORAGE_PROVIDER ?? 'local';
    switch (provider) {
      case 'local':
      default:
        return new LocalObjectStorageAdapter();
    }
  },
};

/** `PromptPayQrService` (ARCHITECTURE §4.3) — real (no gateway) end-to-end;
 * there is only ever one implementation, but it's still bound via a token
 * (not `new`'d directly by consumers) for the same testability reasons as
 * every other integration. */
const promptPayQrProvider: Provider = {
  provide: PROMPTPAY_QR,
  useFactory: () => new PromptPayAdapter(),
};

@Global()
@Module({
  providers: [otpSenderProvider, lineClientProvider, objectStorageProvider, promptPayQrProvider],
  exports: [OTP_SENDER, LINE_CLIENT, OBJECT_STORAGE, PROMPTPAY_QR],
})
export class IntegrationsModule {}
