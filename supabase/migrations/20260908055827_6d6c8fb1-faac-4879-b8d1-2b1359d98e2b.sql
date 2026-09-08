
CREATE TABLE public.business_referral_codes (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.business_referral_codes TO authenticated;
GRANT ALL ON public.business_referral_codes TO service_role;

ALTER TABLE public.business_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own referral code"
  ON public.business_referral_codes FOR SELECT TO authenticated
  USING (private.is_member_of(business_id) OR private.is_platform_staff());

CREATE POLICY "managers create own referral code"
  ON public.business_referral_codes FOR INSERT TO authenticated
  WITH CHECK (private.is_business_manager(business_id) OR private.is_platform_staff());

CREATE POLICY "managers update own referral code"
  ON public.business_referral_codes FOR UPDATE TO authenticated
  USING (private.is_business_manager(business_id) OR private.is_platform_staff())
  WITH CHECK (private.is_business_manager(business_id) OR private.is_platform_staff());

CREATE TRIGGER business_referral_codes_set_updated_at
  BEFORE UPDATE ON public.business_referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_referral_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  new.code = upper(btrim(new.code));
  if new.code !~ '^[A-Z0-9-]{4,24}$' then
    raise exception 'invalid referral code: %', new.code;
  end if;
  return new;
end;
$$;

CREATE TRIGGER business_referral_codes_normalize
  BEFORE INSERT OR UPDATE ON public.business_referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.normalize_referral_code();

ALTER TABLE public.bookings
  ADD COLUMN referred_by_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX bookings_referred_by_idx
  ON public.bookings (referred_by_business_id, starts_at DESC)
  WHERE referred_by_business_id IS NOT NULL;

-- Attribution is written once, at creation, and is never editable afterwards.
CREATE OR REPLACE FUNCTION public.guard_booking_referrer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  if new.referred_by_business_id is distinct from old.referred_by_business_id then
    raise exception 'referral attribution cannot be changed after the booking is created';
  end if;
  return new;
end;
$$;

CREATE TRIGGER bookings_guard_referrer
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_referrer();

-- Booking creation, extended with optional referral attribution resolved server-side.
CREATE OR REPLACE FUNCTION public.request_tenant_booking(
  _business_id uuid,
  _service_ids uuid[],
  _multiplier numeric,
  _customer_name text,
  _customer_phone text,
  _customer_email text,
  _address text,
  _subject text,
  _notes text,
  _starts_at timestamp with time zone,
  _specialist_id uuid DEFAULT NULL::uuid,
  _referral_code text DEFAULT NULL::text
)
RETURNS TABLE(total_cents integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _email text := nullif(lower(btrim(coalesce(_customer_email, ''))), '');
  _phone text := nullif(btrim(coalesce(_customer_phone, '')), '');
  _name text := btrim(coalesce(_customer_name, ''));
  _mult numeric := least(greatest(coalesce(_multiplier, 1), 1), 2);
  _subtotal integer;
  _minutes integer;
  _total integer;
  _names text;
  _customer_id uuid;
  _summary text;
  _code text := nullif(upper(btrim(coalesce(_referral_code, ''))), '');
  _referrer uuid;
begin
  if _name = '' then raise exception 'A name is required'; end if;
  if _phone is null then raise exception 'A phone number is required'; end if;
  if _starts_at is null or _starts_at <= now() then
    raise exception 'Choose a date in the future';
  end if;
  if not exists (
    select 1 from public.businesses b
    where b.id = _business_id and b.is_active and b.lifecycle = 'active'
  ) then
    raise exception 'This business is not accepting bookings';
  end if;

  select coalesce(sum(s.base_price_cents), 0),
         coalesce(sum(s.duration_minutes), 0),
         string_agg(s.name, ', ' order by s.sort_order)
    into _subtotal, _minutes, _names
    from public.services s
   where s.business_id = _business_id and s.is_active and s.id = any(_service_ids);

  if _names is null then raise exception 'Select at least one service'; end if;

  _total := round(_subtotal * _mult);

  if _specialist_id is not null and not exists (
    select 1 from public.specialist_profiles sp
    where sp.id = _specialist_id and sp.business_id = _business_id and sp.is_active
  ) then
    raise exception 'That specialist is not available';
  end if;

  -- Referral attribution. A bad, inactive, non-Enterprise or self-referring code
  -- never blocks the booking; it is simply not attributed.
  if _code is not null then
    select rc.business_id into _referrer
      from public.business_referral_codes rc
      join public.businesses rb on rb.id = rc.business_id
     where rc.code = _code
       and rc.is_active
       and rb.is_active
       and rb.lifecycle = 'active'
       and rb.plan_tier = 'enterprise'
       and rb.id <> _business_id
     limit 1;
  end if;

  -- Customer matching, deliberately conservative:
  --  1. exact match on normalized email inside this business;
  --  2. otherwise a phone match ONLY when exactly one record has that phone and
  --     that record has no email of its own.
  if _email is not null then
    select c.id into _customer_id
      from public.customers c
     where c.business_id = _business_id and c.email = _email
     limit 1;
  end if;

  if _customer_id is null then
    select c.id into _customer_id
      from public.customers c
     where c.business_id = _business_id
       and c.phone = _phone
       and c.email is null
     limit 2;
    if (select count(*) from public.customers c
         where c.business_id = _business_id and c.phone = _phone and c.email is null) <> 1 then
      _customer_id := null;
    end if;
  end if;

  if _customer_id is null then
    insert into public.customers (business_id, full_name, email, phone)
    values (_business_id, _name, _email, _phone)
    returning id into _customer_id;
  else
    update public.customers c
       set email = coalesce(c.email, _email),
           phone = coalesce(c.phone, _phone),
           full_name = case when btrim(c.full_name) = '' then _name else c.full_name end
     where c.id = _customer_id;
  end if;

  _summary := concat_ws(E'\n',
    'Services: ' || _names,
    nullif(btrim(coalesce(_subject, '')), ''),
    case when btrim(coalesce(_address, '')) <> '' then 'Address: ' || btrim(_address) end,
    case when btrim(coalesce(_notes, '')) <> '' then 'Notes: ' || btrim(_notes) end
  );

  insert into public.bookings (
    business_id, customer_id, specialist_id, customer_name, customer_email,
    customer_phone, starts_at, ends_at, status, total_cents, notes,
    referred_by_business_id
  ) values (
    _business_id, _customer_id, _specialist_id, _name, _email, _phone,
    _starts_at, _starts_at + make_interval(mins => _minutes), 'pending', _total, _summary,
    _referrer
  );

  return query select _total, _minutes;
end;
$function$;

-- Referrals a business SENT. Deliberately excludes every customer detail.
CREATE OR REPLACE FUNCTION public.referrals_sent(_business_id uuid)
RETURNS TABLE(
  booking_id uuid,
  received_by_business_id uuid,
  received_by_name text,
  starts_at timestamptz,
  status booking_status,
  total_cents integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'private', 'public'
AS $$
  select b.id, b.business_id, rb.name, b.starts_at, b.status, b.total_cents, b.created_at
    from public.bookings b
    join public.businesses rb on rb.id = b.business_id
   where b.referred_by_business_id = _business_id
     and (private.is_member_of(_business_id) or private.is_platform_staff())
   order by b.created_at desc
   limit 500
$$;

REVOKE EXECUTE ON FUNCTION public.referrals_sent(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.referrals_sent(uuid) TO authenticated;
