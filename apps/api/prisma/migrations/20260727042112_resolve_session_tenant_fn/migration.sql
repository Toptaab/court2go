-- ----------------------------------------------------------------------------
-- resolve_session_tenant(p_kind, p_session_id) — SECURITY DEFINER bootstrap
-- lookup so `TenantContextMiddleware` can resolve a request's tenant FROM an
-- authenticated session cookie BEFORE any RLS-scoped query runs.
--
-- Why this exists: `client_session` and `admin_session` are both under the
-- `tenant_isolation` RLS policy (see the initial migration's "Row-Level
-- Security" section, ARCHITECTURE §2.1), and the runtime role (`app_user`)
-- is never the table owner, so it can never bypass RLS. That's correct for
-- every OTHER query — but it creates a chicken-and-egg problem for the very
-- first lookup of a request: we cannot read the session row to learn
-- `tenant_id` because reading it already requires `app.tenant_id` to be set,
-- and ARCHITECTURE §2.2 requires the session's own `tenantId` to win over
-- any client-supplied `x-tenant-id` header. This function is the one
-- deliberate, narrow escape hatch: SECURITY DEFINER makes it run as the
-- function's owner (the migration/owner role, which already bypasses RLS by
-- table ownership — same trust boundary as every other owner-role statement
-- in the initial migration), but it exposes NOTHING beyond a single tenant
-- uuid, and only for a session whose exact opaque, unguessable id the caller
-- already holds (i.e. the session secret itself is the authorization).
--
-- Contract:
--   * p_kind = 'member' -> looks up `client_session`.
--   * p_kind = 'admin'  -> looks up `admin_session`.
--   * any other p_kind, a p_session_id that isn't a valid uuid, or no
--     matching row -> NULL (fail closed; the caller then falls back to
--     rejecting the request rather than trusting a client-supplied header).
--   * "valid session" = not revoked and not expired, matching the guard's
--     later normal-RLS re-check. `last_seen_at` is intentionally NOT
--     touched here — the auth guard updates that later, under normal RLS,
--     once tenant context is pinned.
--
-- EXECUTE is granted to `app_user` — the literal, hardcoded runtime role
-- created by the initial migration (see its "Least-privilege runtime role"
-- section) — rather than PUBLIC. `app_user` is a real, grantable role name
-- in this repo's convention (not env-provisioned), and it is exactly the
-- role `TenantContextMiddleware` connects as at request time, so granting to
-- PUBLIC would be strictly broader than necessary.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_session_tenant(p_kind text, p_session_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_tenant_id uuid;
BEGIN
  -- p_session_id is caller-supplied (e.g. straight off a cookie) and must
  -- never be trusted to already be a well-formed uuid — an invalid cast
  -- raises `invalid_text_representation`, which we treat as "no match"
  -- rather than letting it propagate as a 500.
  BEGIN
    v_session_id := p_session_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;

  IF p_kind = 'member' THEN
    SELECT tenant_id INTO v_tenant_id
    FROM client_session
    WHERE id = v_session_id
      AND revoked_at IS NULL
      AND expires_at > now();
  ELSIF p_kind = 'admin' THEN
    SELECT tenant_id INTO v_tenant_id
    FROM admin_session
    WHERE id = v_session_id
      AND revoked_at IS NULL
      AND expires_at > now();
  ELSE
    RETURN NULL;
  END IF;

  RETURN v_tenant_id;
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on function creation; revoke
-- that immediately so `app_user` is the ONLY runtime grantee (the migration
-- owner role retains implicit EXECUTE regardless, same as it bypasses RLS).
REVOKE EXECUTE ON FUNCTION resolve_session_tenant(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_session_tenant(text, text) TO "app_user";
