-- Environment default privileges had granted `anon` full DML on every public
-- table. RLS blocked it, but permissions should not depend on a single layer.
revoke all on public.businesses from anon;
revoke all on public.business_domains from anon;
revoke all on public.business_members from anon;
revoke all on public.platform_staff from anon;
revoke all on public.services from anon;
revoke all on public.bookings from anon;

-- Re-grant exactly the public read surface the client websites need.
grant select on public.businesses to anon;
grant select on public.business_domains to anon;
grant select on public.services to anon;

-- Signed-in users keep DML, but never on the internal staff roster.
revoke insert, update, delete on public.platform_staff from authenticated;
