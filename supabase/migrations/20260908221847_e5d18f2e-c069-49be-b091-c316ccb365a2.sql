alter table public.bookings
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists review_request_sent_at timestamptz;

alter table public.businesses
  add column if not exists welcome_email_sent_at timestamptz;

create index if not exists bookings_reminder_due_idx
  on public.bookings (starts_at)
  where reminder_sent_at is null;

create index if not exists bookings_review_due_idx
  on public.bookings (ends_at)
  where review_request_sent_at is null;

drop function if exists public.request_tenant_booking(uuid, uuid[], numeric, text, text, text, text, text, text, timestamptz, uuid, text);

CREATE OR REPLACE FUNCTION public.request_tenant_booking(_business_id uuid, _service_ids uuid[], _multiplier numeric, _customer_name text, _customer_phone text, _customer_email text, _address text, _subject text, _notes text, _starts_at timestamp with time zone, _specialist_id uuid DEFAULT NULL::uuid, _referral_code text DEFAULT NULL::text)
 RETURNS TABLE(total_cents integer, minutes integer, booking_id uuid)
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
  _booking_id uuid;
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
  )
  returning id into _booking_id;

  return query select _total, _minutes, _booking_id;
end;
$function$;