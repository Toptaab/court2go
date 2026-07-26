import { Global, Module, type Provider } from '@nestjs/common';
import { OTP_SENDER } from './ports/otp-sender.port';
import { LINE_CLIENT } from './ports/line-client.port';
import { StubSmsAdapter } from './adapters/stub-sms.adapter';
import { StubLineAdapter } from './adapters/stub-line.adapter';

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

@Global()
@Module({
  providers: [otpSenderProvider, lineClientProvider],
  exports: [OTP_SENDER, LINE_CLIENT],
})
export class IntegrationsModule {}
