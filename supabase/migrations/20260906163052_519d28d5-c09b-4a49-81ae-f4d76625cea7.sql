-- ============ customers ============
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  full_name text NOT NULL,
  email text,
  phone text,
  notes text,
  invite_token_hash text,
  invite_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers read business customers" ON public.customers
  FOR SELECT TO authenticated
  USING (private.is_business_manager(business_id) OR private.is_platform_staff());
CREATE POLICY "customer reads own record" ON public.customers
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "managers insert business customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (private.is_business_manager(business_id));
CREATE POLICY "managers update business customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (private.is_business_manager(business_id))
  WITH CHECK (private.is_business_manager(business_id));
CREATE POLICY "managers delete business customers" ON public.customers
  FOR DELETE TO authenticated USING (private.is_business_manager(business_id));

CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_customer()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
begin
  new.full_name = btrim(new.full_name);
  if new.full_name = '' then
    raise exception 'full_name is required';
  end if;
  new.email = nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.phone = nullif(btrim(coalesce(new.phone, '')), '');
  if new.email is not null and new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email: %', new.email;
  end if;
  return new;
end;
$$;

CREATE TRIGGER customers_normalize BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.normalize_customer();

-- One record per email inside a business. Phone is deliberately NOT unique:
-- two people can legitimately share a phone number.
CREATE UNIQUE INDEX customers_business_email_key
  ON public.customers (business_id, email) WHERE email IS NOT NULL;
CREATE INDEX customers_business_phone_idx ON public.customers (business_id, phone);
CREATE INDEX customers_user_idx ON public.customers (user_id);
CREATE UNIQUE INDEX customers_invite_token_key
  ON public.customers (invite_token_hash) WHERE invite_token_hash IS NOT NULL;
-- A login account maps to at most one customer record per business.
CREATE UNIQUE INDEX customers_business_user_key
  ON public.customers (business_id, user_id) WHERE user_id IS NOT NULL;

-- ============ specialists ============
CREATE TABLE public.specialist_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text NOT NULL,
  title text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialist_profiles TO authenticated;
GRANT SELECT ON public.specialist_profiles TO anon;
GRANT ALL ON public.specialist_profiles TO service_role;

ALTER TABLE public.specialist_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read business specialists" ON public.specialist_profiles
  FOR SELECT TO authenticated
  USING (private.is_member_of(business_id) OR private.is_platform_staff());
CREATE POLICY "public reads active specialists" ON public.specialist_profiles
  FOR SELECT TO anon USING (is_active);
CREATE POLICY "managers insert specialists" ON public.specialist_profiles
  FOR INSERT TO authenticated WITH CHECK (private.is_business_manager(business_id));
CREATE POLICY "managers update specialists" ON public.specialist_profiles
  FOR UPDATE TO authenticated
  USING (private.is_business_manager(business_id))
  WITH CHECK (private.is_business_manager(business_id));
CREATE POLICY "managers delete specialists" ON public.specialist_profiles
  FOR DELETE TO authenticated USING (private.is_business_manager(business_id));

CREATE TRIGGER specialist_profiles_set_updated_at BEFORE UPDATE ON public.specialist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX specialist_profiles_business_user_key
  ON public.specialist_profiles (business_id, user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.is_specialist_of(_specialist_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (
    select 1 from public.specialist_profiles
    where id = _specialist_id and user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.specialist_business(_specialist_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select business_id from public.specialist_profiles where id = _specialist_id;
$$;

CREATE TABLE public.specialist_services (
  specialist_id uuid NOT NULL REFERENCES public.specialist_profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (specialist_id, service_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialist_services TO authenticated;
GRANT SELECT ON public.specialist_services TO anon;
GRANT ALL ON public.specialist_services TO service_role;

ALTER TABLE public.specialist_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read specialist services" ON public.specialist_services
  FOR SELECT TO authenticated
  USING (private.is_member_of(private.specialist_business(specialist_id))
      OR private.is_platform_staff());
CREATE POLICY "public reads specialist services" ON public.specialist_services
  FOR SELECT TO anon USING (true);
CREATE POLICY "managers write specialist services" ON public.specialist_services
  FOR ALL TO authenticated
  USING (private.is_business_manager(private.specialist_business(specialist_id)))
  WITH CHECK (private.is_business_manager(private.specialist_business(specialist_id)));

CREATE TABLE public.specialist_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES public.specialist_profiles(id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_minute integer NOT NULL,
  end_minute integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialist_hours TO authenticated;
GRANT SELECT ON public.specialist_hours TO anon;
GRANT ALL ON public.specialist_hours TO service_role;

ALTER TABLE public.specialist_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read specialist hours" ON public.specialist_hours
  FOR SELECT TO authenticated
  USING (private.is_member_of(private.specialist_business(specialist_id))
      OR private.is_platform_staff());
CREATE POLICY "public reads specialist hours" ON public.specialist_hours
  FOR SELECT TO anon USING (true);
CREATE POLICY "managers write specialist hours" ON public.specialist_hours
  FOR ALL TO authenticated
  USING (private.is_business_manager(private.specialist_business(specialist_id)))
  WITH CHECK (private.is_business_manager(private.specialist_business(specialist_id)));

CREATE OR REPLACE FUNCTION public.validate_specialist_hours()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
begin
  if new.weekday < 0 or new.weekday > 6 then
    raise exception 'weekday must be 0-6';
  end if;
  if new.start_minute < 0 or new.end_minute > 1440 or new.start_minute >= new.end_minute then
    raise exception 'invalid hours range';
  end if;
  return new;
end;
$$;

CREATE TRIGGER specialist_hours_validate BEFORE INSERT OR UPDATE ON public.specialist_hours
  FOR EACH ROW EXECUTE FUNCTION public.validate_specialist_hours();

-- ============ bookings: real links, tighter reads ============
-- Both columns exist and were never written to, so they can be given real
-- meaning now: customer_id -> customers.id, specialist_id -> specialist_profiles.id.
DROP POLICY IF EXISTS "customer reads own bookings" ON public.bookings;
DROP POLICY IF EXISTS "customer updates own booking" ON public.bookings;
DROP POLICY IF EXISTS "staff read business bookings" ON public.bookings;
DROP POLICY IF EXISTS "staff update business bookings" ON public.bookings;
DROP POLICY IF EXISTS "staff insert business bookings" ON public.bookings;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_customer_fk FOREIGN KEY (customer_id)
    REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD CONSTRAINT bookings_specialist_fk FOREIGN KEY (specialist_id)
    REFERENCES public.specialist_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_customer_idx ON public.bookings (customer_id);
CREATE INDEX IF NOT EXISTS bookings_specialist_idx ON public.bookings (specialist_id);

CREATE OR REPLACE FUNCTION private.is_booking_customer(_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (
    select 1 from public.customers
    where id = _customer_id and user_id = auth.uid()
  );
$$;

-- Managers see the whole business; a specialist sees only jobs assigned to
-- them; a customer sees only their own bookings. Plain membership is no longer
-- enough, so a customer-role or specialist-role login cannot read everything.
CREATE POLICY "managers read business bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (private.is_business_manager(business_id) OR private.is_platform_staff());
CREATE POLICY "specialist reads assigned bookings" ON public.bookings
  FOR SELECT TO authenticated USING (private.is_specialist_of(specialist_id));
CREATE POLICY "customer reads own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (private.is_booking_customer(customer_id));

CREATE POLICY "managers insert business bookings" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (private.is_business_manager(business_id));
CREATE POLICY "managers update business bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (private.is_business_manager(business_id))
  WITH CHECK (private.is_business_manager(business_id));
CREATE POLICY "specialist updates assigned bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (private.is_specialist_of(specialist_id))
  WITH CHECK (private.is_specialist_of(specialist_id));

-- ============ public booking through one guarded step ============
-- Anon no longer inserts bookings directly; this function prices the job from
-- the tenant's own catalog and attaches the right customer record.
DROP POLICY IF EXISTS "public may request a booking on an active tenant" ON public.bookings;

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
  _starts_at timestamptz,
  _specialist_id uuid DEFAULT NULL
)
RETURNS TABLE(total_cents integer, minutes integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

  -- Customer matching, deliberately conservative:
  --  1. exact match on normalized email inside this business;
  --  2. otherwise a phone match ONLY when exactly one record has that phone and
  --     that record has no email of its own (so a different person who shares a
  --     phone but has their own email is never merged into).
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
    customer_phone, starts_at, ends_at, status, total_cents, notes
  ) values (
    _business_id, _customer_id, _specialist_id, _name, _email, _phone,
    _starts_at, _starts_at + make_interval(mins => _minutes), 'pending', _total, _summary
  );

  return query select _total, _minutes;
end;
$$;

REVOKE ALL ON FUNCTION public.request_tenant_booking(uuid, uuid[], numeric, text, text, text, text, text, text, timestamptz, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.request_tenant_booking(uuid, uuid[], numeric, text, text, text, text, text, text, timestamptz, uuid) TO anon, authenticated, service_role;

-- ============ customer portal claim ============
CREATE OR REPLACE FUNCTION public.claim_customer_account(_token_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare
  _business_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  update public.customers c
     set user_id = auth.uid(),
         invite_token_hash = null,
         invite_expires_at = null
   where c.invite_token_hash = _token_hash
     and c.invite_expires_at > now()
     and c.user_id is null
  returning c.business_id into _business_id;

  return _business_id;
end;
$$;

REVOKE ALL ON FUNCTION public.claim_customer_account(text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_customer_account(text) TO authenticated, service_role;