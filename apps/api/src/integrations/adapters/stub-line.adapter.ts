import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { LineClient } from '../ports/line-client.port';

/**
 * StubLineAdapter (ARCHITECTURE §4.2, §9 item 3) — dev/MVP `LineClient`.
 * Real LINE channel ID/secret + a reachable webhook are required before the
 * real OAuth2 flow can be exercised end-to-end; until then this stub makes
 * the LINE login flow (`AuthMemberService.lineLoginUrl`/`lineCallback`)
 * fully exercisable locally without any LINE credentials:
 *
 *  - `buildAuthorizationUrl` returns a deterministic, LINE-shaped URL (the web
 *    app never needs to actually reach it in dev — it's only inspected/logged).
 *  - `exchangeCode` deterministically derives a stable `lineUserId` from the
 *    supplied `code` (sha256, first 32 hex chars) so the SAME `code` always
 *    resolves to the SAME Member — enough to test "returning LINE user" flows
 *    without a real LINE account.
 *
 * A real `LineOaAdapter` (OAuth2 authorization-code exchange against LINE's
 * token endpoint, channel id/secret from env, `id_token` signature
 * verification) replaces this when credentials land — bound by the same
 * `LINE_CLIENT` DI token in `IntegrationsModule`, so no consumer
 * (`AuthMemberService`) ever changes.
 */
@Injectable()
export class StubLineAdapter implements LineClient {
  buildAuthorizationUrl(state: string): string {
    const base = process.env.LINE_LOGIN_AUTH_URL ?? 'https://access.line.me/oauth2/v2.1/authorize';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINE_CHANNEL_ID ?? 'stub-channel-id',
      redirect_uri: process.env.LINE_REDIRECT_URI ?? 'http://localhost:3000/line/callback',
      scope: 'profile openid',
      state,
    });
    return `${base}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ lineUserId: string; displayName?: string }> {
    const hash = createHash('sha256').update(code).digest('hex').slice(0, 32);
    return { lineUserId: `linestub_${hash}` };
  }
}
