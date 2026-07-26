/**
 * LineClient port (ARCHITECTURE §4.2). Covers LINE Login's OAuth2
 * authorization-code flow: `buildAuthorizationUrl` sends the client to LINE,
 * `exchangeCode` trades the returned `code` for the LINE user's identity.
 *
 * Bound to a stub adapter in dev/MVP (`StubLineAdapter`) until real LINE
 * channel credentials land (ARCHITECTURE §9 item 3); a real `LineOaAdapter`
 * (OAuth2 token endpoint + `id_token` verification) replaces the stub via one
 * `IntegrationsModule` provider-factory line — no consumer code changes.
 */
export interface LineClient {
  buildAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<{ lineUserId: string; displayName?: string }>;
}

export const LINE_CLIENT = Symbol('LineClient');
