insert into public.business_domains (hostname, business_id, is_primary, verified_at)
values
  ('vdsmobile.com', '67300538-c50b-4f7a-9bfe-374cdfbe966c', true, now()),
  ('www.vdsmobile.com', '67300538-c50b-4f7a-9bfe-374cdfbe966c', false, now())
on conflict (hostname) do update
  set business_id = excluded.business_id,
      is_primary = excluded.is_primary,
      verified_at = excluded.verified_at;