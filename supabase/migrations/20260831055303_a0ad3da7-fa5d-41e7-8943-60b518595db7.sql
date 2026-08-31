-- These helpers are evaluated inside RLS policies, which run as the querying
-- role, so `authenticated` must retain EXECUTE. Nothing in an anon-facing
-- policy uses them, so anon/PUBLIC lose access entirely.
revoke execute on function public.is_member_of(uuid) from public, anon;
revoke execute on function public.has_business_role(uuid, public.business_role) from public, anon;
revoke execute on function public.is_business_manager(uuid) from public, anon;
revoke execute on function public.is_platform_staff() from public, anon;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.normalize_hostname() from public, anon, authenticated;

grant execute on function public.is_member_of(uuid) to authenticated;
grant execute on function public.has_business_role(uuid, public.business_role) to authenticated;
grant execute on function public.is_business_manager(uuid) to authenticated;
grant execute on function public.is_platform_staff() to authenticated;
