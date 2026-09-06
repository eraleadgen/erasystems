CREATE TABLE public.tenant_chat_usage (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  usage_day date NOT NULL,
  visitor_key text NOT NULL DEFAULT '',
  messages integer NOT NULL DEFAULT 0,
  cap_notified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, usage_day, visitor_key)
);

GRANT SELECT ON public.tenant_chat_usage TO authenticated;
GRANT ALL ON public.tenant_chat_usage TO service_role;

ALTER TABLE public.tenant_chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff and managers read chat usage"
  ON public.tenant_chat_usage FOR SELECT TO authenticated
  USING (
    public.is_platform_staff()
    OR EXISTS (
      SELECT 1 FROM public.business_members m
      WHERE m.business_id = tenant_chat_usage.business_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );

CREATE OR REPLACE FUNCTION public.tenant_chat_consume(
  _business_id uuid,
  _visitor_key text,
  _business_daily_cap integer DEFAULT 300,
  _visitor_daily_cap integer DEFAULT 30
)
RETURNS TABLE(allowed boolean, reason text, just_capped boolean, business_messages integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
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

  -- Reaching the cap is announced exactly once per business per day.
  if _business_total >= _business_daily_cap and _notified is null then
    update public.tenant_chat_usage u
       set cap_notified_at = now()
     where u.business_id = _business_id and u.usage_day = _day and u.visitor_key = ''
       and u.cap_notified_at is null;
    _fresh_cap := found;
  end if;

  return query select true, 'ok'::text, _fresh_cap, _business_total;
end;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_chat_consume(uuid, text, integer, integer) TO anon, authenticated, service_role;