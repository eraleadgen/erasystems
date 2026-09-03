CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER FUNCTION public.is_platform_staff() SET SCHEMA private;
ALTER FUNCTION public.is_member_of(uuid) SET SCHEMA private;
ALTER FUNCTION public.has_business_role(uuid, public.business_role) SET SCHEMA private;
ALTER FUNCTION public.is_business_manager(uuid) SET SCHEMA private;
ALTER FUNCTION public.business_has_feature(uuid, public.platform_feature) SET SCHEMA private;
ALTER FUNCTION public.business_has_addon(uuid, public.addon_kind) SET SCHEMA private;
ALTER FUNCTION public.consume_invite(text) SET SCHEMA private;
ALTER FUNCTION public.release_invite(uuid) SET SCHEMA private;
ALTER FUNCTION public.invite_throttle_check(text) SET SCHEMA private;
ALTER FUNCTION public.invite_throttle_record(text) SET SCHEMA private;
ALTER FUNCTION public.activate_paid_business(uuid) SET SCHEMA private;

GRANT EXECUTE ON FUNCTION private.is_platform_staff() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_member_of(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_business_role(uuid, public.business_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_business_manager(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.business_has_feature(uuid, public.platform_feature) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.business_has_addon(uuid, public.addon_kind) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION private.consume_invite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.release_invite(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.invite_throttle_check(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.invite_throttle_record(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.activate_paid_business(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.consume_invite(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.release_invite(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.invite_throttle_check(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.invite_throttle_record(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.activate_paid_business(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_platform_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private, public
AS $$ SELECT private.is_platform_staff() $$;
REVOKE ALL ON FUNCTION public.is_platform_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_staff() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_invite(_token_hash text)
RETURNS TABLE(id uuid, email text, full_name text)
LANGUAGE sql SECURITY INVOKER SET search_path = private, public
AS $$ SELECT c.id, c.email, c.full_name FROM private.consume_invite(_token_hash) c $$;
REVOKE ALL ON FUNCTION public.consume_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite(text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_invite(_invite_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = private, public
AS $$ SELECT private.release_invite(_invite_id) $$;
REVOKE ALL ON FUNCTION public.release_invite(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_invite(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.invite_throttle_check(_ip text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = private, public
AS $$ SELECT private.invite_throttle_check(_ip) $$;
REVOKE ALL ON FUNCTION public.invite_throttle_check(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_throttle_check(text) TO service_role;

CREATE OR REPLACE FUNCTION public.invite_throttle_record(_ip text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = private, public
AS $$ SELECT private.invite_throttle_record(_ip) $$;
REVOKE ALL ON FUNCTION public.invite_throttle_record(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_throttle_record(text) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_paid_business(_business_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = private, public
AS $$ SELECT private.activate_paid_business(_business_id) $$;
REVOKE ALL ON FUNCTION public.activate_paid_business(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_business(uuid) TO service_role;