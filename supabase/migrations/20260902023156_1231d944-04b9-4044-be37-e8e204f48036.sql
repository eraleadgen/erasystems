CREATE TYPE public.business_lifecycle AS ENUM ('pending_payment', 'active', 'suspended', 'expired');

ALTER TABLE public.businesses
  ADD COLUMN lifecycle public.business_lifecycle NOT NULL DEFAULT 'pending_payment',
  ADD COLUMN slug_reserved_until timestamp with time zone;

UPDATE public.businesses SET lifecycle = 'active' WHERE is_active;

CREATE INDEX businesses_lifecycle_idx ON public.businesses (lifecycle, created_at);

CREATE OR REPLACE FUNCTION public.guard_lifecycle_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  -- auth.uid() is null for the trusted server-side provisioning/payment path
  -- (service role, no end-user JWT). Every end-user session must be staff.
  if new.lifecycle is distinct from old.lifecycle
     and auth.uid() is not null
     and not public.is_platform_staff() then
    raise exception 'lifecycle can only be changed by platform staff';
  end if;
  return new;
end;
$$;

CREATE TRIGGER businesses_guard_lifecycle
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_lifecycle_change();