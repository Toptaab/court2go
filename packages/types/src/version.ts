/**
 * Contract version. Bump the MAJOR on any breaking change to a schema shape —
 * both build agents (nestjs-backend, nextjs-frontend) then fail to compile until
 * they react, which is the point (compile-time safety, ARCHITECTURE §3.1/§7).
 *
 * The wire also carries this: every API response includes header `X-Contract-Version`,
 * and the OpenAPI `info.version` mirrors CONTRACT_VERSION.
 */
export const CONTRACT_VERSION = '1.0.0' as const;

/** URL path prefix every endpoint lives under. */
export const API_BASE_PATH = '/v1' as const;
