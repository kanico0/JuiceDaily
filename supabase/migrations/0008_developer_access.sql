-- ─────────────────────────────────────────────────────────────
-- 0008_developer_access.sql — Server-managed developer authorization
--
-- Creates a developer_access table with RLS and a SECURITY DEFINER
-- function that allows an authenticated user to check ONLY their
-- own authorization status. No listing, no cross-user reads.
-- ─────────────────────────────────────────────────────────────

-- ── Table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.developer_access (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  role       TEXT NOT NULL DEFAULT 'developer',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes      TEXT
);

-- ── Row Level Security ───────────────────────────────────────
-- No direct access for anon or authenticated roles.

ALTER TABLE public.developer_access ENABLE ROW LEVEL SECURITY;

-- Deny all direct access from anon and authenticated users.
-- Administrative changes require service-role or controlled SQL access.
REVOKE ALL ON public.developer_access FROM anon, authenticated;

-- ── Authorization function ───────────────────────────────────
-- SECURITY DEFINER: runs with the function owner's privileges
-- (postgres / service-role) so it can read the table despite RLS.
-- Uses auth.uid() — never accepts a user_id argument from the client.
-- Returns only the caller's authorization state.

CREATE OR REPLACE FUNCTION public.check_developer_access()
RETURNS TABLE (authorized BOOLEAN, role TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.developer_access%ROWTYPE;
BEGIN
  -- Anonymous or unauthenticated users are never authorized.
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT * INTO v_row FROM public.developer_access WHERE user_id = v_uid;

  -- No entry, inactive, or expired → unauthorized.
  IF NOT FOUND OR NOT v_row.is_active THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Authorized — return minimal result.
  RETURN QUERY SELECT true, v_row.role, v_row.expires_at;
END;
$$;

-- ── Permissions ──────────────────────────────────────────────
-- Only authenticated users may call the function.
-- Revoke public execution; grant only to authenticated.

REVOKE ALL ON FUNCTION public.check_developer_access() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_developer_access() TO authenticated;

-- ── Updated_at trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS developer_access_set_updated_at ON public.developer_access;
CREATE TRIGGER developer_access_set_updated_at
  BEFORE UPDATE ON public.developer_access
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
