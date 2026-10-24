-- 10. Platform roles: admin keeps full write access, support becomes read-only.
CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.platform_staff where user_id = auth.uid() and role = 'platform_admin');
$$;
REVOKE ALL ON FUNCTION private.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = private, public AS $$ SELECT private.is_platform_admin() $$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_lifecycle_change()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
begin
  if new.lifecycle is distinct from old.lifecycle
     and auth.uid() is not null
     and not public.is_platform_admin() then
    raise exception 'lifecycle can only be changed by platform staff';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_plan_tier_change()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
begin
  if new.plan_tier is distinct from old.plan_tier
     and auth.uid() is not null
     and not public.is_platform_admin() then
    raise exception 'plan_tier can only be changed by platform staff';
  end if;
  return new;
end;
$function$;

-- Every staff write policy now requires the admin role; staff reads are unchanged.
DO $$
DECLARE r record; q text; c text;
BEGIN
  FOR r IN
    SELECT * FROM pg_policies
    WHERE schemaname = 'public' AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
      AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%is_platform_staff()%'
  LOOP
    IF r.cmd = 'ALL' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO %s USING (%s)',
        left(r.policyname, 50) || ' (read)', r.tablename, array_to_string(r.roles, ','), r.qual);
    END IF;
    q := replace(r.qual, 'is_platform_staff()', 'is_platform_admin()');
    c := replace(r.with_check, 'is_platform_staff()', 'is_platform_admin()');
    EXECUTE format('ALTER POLICY %I ON public.%I %s %s', r.policyname, r.tablename,
      CASE WHEN q IS NOT NULL THEN 'USING (' || q || ')' ELSE '' END,
      CASE WHEN c IS NOT NULL THEN 'WITH CHECK (' || c || ')' ELSE '' END);
  END LOOP;
END $$;

-- 5. Staff-only business fields.
CREATE OR REPLACE FUNCTION public.guard_business_staff_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
begin
  if auth.uid() is not null and not public.is_platform_admin() and (
       new.is_active is distinct from old.is_active
    or new.slug_reserved_until is distinct from old.slug_reserved_until
    or new.origin_invite_id is distinct from old.origin_invite_id
    or new.welcome_email_sent_at is distinct from old.welcome_email_sent_at) then
    raise exception 'is_active, slug_reserved_until, origin_invite_id and welcome_email_sent_at can only be changed by platform staff';
  end if;
  return new;
end;
$function$;
CREATE TRIGGER businesses_guard_staff_fields BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_staff_fields();

-- 6. Only staff or the server may set or change domain verification.
CREATE OR REPLACE FUNCTION public.guard_domain_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    if tg_op = 'INSERT' and new.verified_at is not null then
      raise exception 'verified_at can only be set by platform staff';
    end if;
    if tg_op = 'UPDATE' and new.verified_at is distinct from old.verified_at then
      raise exception 'verified_at can only be changed by platform staff';
    end if;
  end if;
  return new;
end;
$function$;
CREATE TRIGGER business_domains_guard_verification BEFORE INSERT OR UPDATE ON public.business_domains
  FOR EACH ROW EXECUTE FUNCTION public.guard_domain_verification();

-- 7. Plan change requests constrained to valid, end-of-period changes.
CREATE OR REPLACE FUNCTION private.current_paid_period_end(_business_id uuid)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare
  _end timestamptz; _anchor timestamptz; _interval text; _step int; _n int := 0;
begin
  select current_period_end into _end from public.business_billing where business_id = _business_id;
  if _end is not null then return _end; end if;
  select min(activated_at) into _anchor from public.payments
   where business_id = _business_id and activated_at is not null;
  if _anchor is null then return null; end if;
  select i.billing_interval into _interval
    from public.businesses b join public.invites i on i.id = b.origin_invite_id
   where b.id = _business_id;
  _step := case coalesce(_interval, 'monthly')
             when 'monthly' then 1 when 'quarterly' then 3 when 'annual' then 12 else null end;
  if _step is null then return null; end if;
  _end := _anchor;
  while _end <= now() and _n < 1200 loop
    _n := _n + _step;
    _end := _anchor + make_interval(months => _n);
  end loop;
  return _end;
end;
$$;
REVOKE ALL ON FUNCTION private.current_paid_period_end(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_paid_period_end(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.plan_change_insert_ok(
  _business_id uuid, _kind text, _from public.plan_tier, _to public.plan_tier, _effective timestamptz)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare _tier public.plan_tier; _pe timestamptz;
begin
  select plan_tier into _tier from public.businesses where id = _business_id;
  if _tier is null or _from is distinct from _tier then return false; end if;
  if _kind = 'change' then
    if _to is null or _to = _tier then return false; end if;
  elsif _kind = 'cancel' then
    if _to is not null then return false; end if;
  else
    return false;
  end if;
  if _effective is null or _effective <= now() then return false; end if;
  _pe := private.current_paid_period_end(_business_id);
  if _pe is null or _effective < _pe then return false; end if;
  return true;
end;
$$;
REVOKE ALL ON FUNCTION private.plan_change_insert_ok(uuid, text, public.plan_tier, public.plan_tier, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.plan_change_insert_ok(uuid, text, public.plan_tier, public.plan_tier, timestamptz) TO authenticated, service_role;

DROP POLICY IF EXISTS "managers schedule plan changes" ON public.plan_change_requests;
CREATE POLICY "managers schedule plan changes" ON public.plan_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_business_manager(business_id)
    AND requested_by = auth.uid()
    AND status = 'scheduled'
    AND applied_at IS NULL
    AND private.plan_change_insert_ok(business_id, kind, from_tier, to_tier, effective_at)
  );

-- 4. No anonymous writes anywhere except the contact form; authenticated loses
--    TRUNCATE everywhere and DELETE where the app never deletes through the client.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon', t.tablename);
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t.tablename);
    IF t.tablename NOT IN ('agency_documents','customers','business_domains','services',
                           'specialist_services','specialist_hours','specialist_profiles') THEN
      EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated', t.tablename);
    END IF;
  END LOOP;
END $$;
GRANT INSERT ON public.discovery_requests TO anon;

-- 1. Statement email settings readable only by managers and staff.
REVOKE SELECT ON public.business_site FROM anon, authenticated;
GRANT SELECT (business_id, tagline, about, address_line1, address_line2, city, region, postal_code,
  country, service_area, hours, booking_enabled, service_location, created_at, updated_at)
  ON public.business_site TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_statement_email_settings(_business_id uuid)
RETURNS TABLE(enabled boolean, recipient text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select s.statement_email_enabled, s.statement_email_to
    from public.business_site s
   where s.business_id = _business_id
     and (private.is_business_manager(_business_id) or private.is_platform_staff());
$$;
REVOKE ALL ON FUNCTION public.get_statement_email_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_statement_email_settings(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_statement_email_enabled(_business_id uuid, _enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not private.is_business_manager(_business_id) then
    raise exception 'Only the business owner or an admin can change this';
  end if;
  insert into public.business_site (business_id, statement_email_enabled)
  values (_business_id, _enabled)
  on conflict (business_id) do update set statement_email_enabled = excluded.statement_email_enabled;
  return true;
end;
$$;
REVOKE ALL ON FUNCTION public.set_statement_email_enabled(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_statement_email_enabled(uuid, boolean) TO authenticated, service_role;

-- 2. Specialist login ids hidden from anonymous visitors.
REVOKE SELECT ON public.specialist_profiles FROM anon;
GRANT SELECT (id, business_id, display_name, title, is_active, created_at, updated_at)
  ON public.specialist_profiles TO anon;

-- 3. Anonymous visitors see only the business columns the public site uses.
REVOKE SELECT ON public.businesses FROM anon;
GRANT SELECT (id, slug, name, timezone, logo_url, brand_primary, brand_accent,
  support_email, support_phone, is_active, lifecycle)
  ON public.businesses TO anon;

-- 8. One booking routine only.
DROP FUNCTION IF EXISTS public.request_tenant_booking(uuid, uuid[], numeric, text, text, text, text, text, text, timestamptz, uuid);
REVOKE ALL ON FUNCTION public.request_tenant_booking(uuid, uuid[], numeric, text, text, text, text, text, text, timestamptz, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_tenant_booking(uuid, uuid[], numeric, text, text, text, text, text, text, timestamptz, uuid, text) TO anon, authenticated, service_role;

-- 9. Chat allowance caps are fixed server-side.
DROP FUNCTION IF EXISTS public.tenant_chat_consume(uuid, text, integer, integer);
CREATE FUNCTION public.tenant_chat_consume(_business_id uuid, _visitor_key text)
RETURNS TABLE(allowed boolean, reason text, just_capped boolean, business_messages integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  _business_daily_cap constant integer := 300;
  _visitor_daily_cap constant integer := 30;
  _day date := (now() at time zone 'utc')::date;
  _key text := left(coalesce(nullif(btrim(_visitor_key), ''), 'anon'), 80);
  _business_total integer;
  _visitor_total integer;
  _notified timestamptz;
  _fresh_cap boolean := false;
begin
  if not exists (
    select 1 from public.businesses b
    where b.id = _business_id and b.is_active and b.lifecycle = 'active'
  ) then
    return query select false, 'inactive'::text, false, 0;
    return;
  end if;

  select u.messages, u.cap_notified_at into _business_total, _notified
    from public.tenant_chat_usage u
   where u.business_id = _business_id and u.usage_day = _day and u.visitor_key = '';
  _business_total := coalesce(_business_total, 0);

  select u.messages into _visitor_total
    from public.tenant_chat_usage u
   where u.business_id = _business_id and u.usage_day = _day and u.visitor_key = _key;
  _visitor_total := coalesce(_visitor_total, 0);

  if _business_total >= _business_daily_cap then
    return query select false, 'business_cap'::text, false, _business_total;
    return;
  end if;

  if _visitor_total >= _visitor_daily_cap then
    return query select false, 'visitor_cap'::text, false, _business_total;
    return;
  end if;

  insert into public.tenant_chat_usage (business_id, usage_day, visitor_key, messages)
  values (_business_id, _day, '', 1)
  on conflict (business_id, usage_day, visitor_key)
  do update set messages = public.tenant_chat_usage.messages + 1, updated_at = now()
  returning public.tenant_chat_usage.messages, public.tenant_chat_usage.cap_notified_at
  into _business_total, _notified;

  insert into public.tenant_chat_usage (business_id, usage_day, visitor_key, messages)
  values (_business_id, _day, _key, 1)
  on conflict (business_id, usage_day, visitor_key)
  do update set messages = public.tenant_chat_usage.messages + 1, updated_at = now();

  if _business_total >= _business_daily_cap and _notified is null then
    update public.tenant_chat_usage u
       set cap_notified_at = now()
     where u.business_id = _business_id and u.usage_day = _day and u.visitor_key = ''
       and u.cap_notified_at is null;
    _fresh_cap := found;
  end if;

  return query select true, 'ok'::text, _fresh_cap, _business_total;
end;
$function$;
REVOKE ALL ON FUNCTION public.tenant_chat_consume(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_chat_consume(uuid, text) TO anon, authenticated, service_role;