CREATE TABLE public.business_launch_status (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, item_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_launch_status TO authenticated;
GRANT ALL ON public.business_launch_status TO service_role;

ALTER TABLE public.business_launch_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read launch status"
  ON public.business_launch_status FOR SELECT TO authenticated
  USING (private.is_member_of(business_id) OR private.is_platform_staff());

CREATE POLICY "staff insert launch status"
  ON public.business_launch_status FOR INSERT TO authenticated
  WITH CHECK (private.is_platform_staff());

CREATE POLICY "staff update launch status"
  ON public.business_launch_status FOR UPDATE TO authenticated
  USING (private.is_platform_staff()) WITH CHECK (private.is_platform_staff());

CREATE POLICY "staff delete launch status"
  ON public.business_launch_status FOR DELETE TO authenticated
  USING (private.is_platform_staff());

CREATE OR REPLACE FUNCTION public.validate_launch_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
begin
  if new.status not in ('pending','in_progress','live') then
    raise exception 'invalid status: %', new.status;
  end if;
  new.item_key = btrim(new.item_key);
  if new.item_key = '' then
    raise exception 'item_key is required';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

CREATE TRIGGER business_launch_status_validate
  BEFORE INSERT OR UPDATE ON public.business_launch_status
  FOR EACH ROW EXECUTE FUNCTION public.validate_launch_status();

CREATE POLICY "staff add domains"
  ON public.business_domains FOR INSERT TO authenticated
  WITH CHECK (private.is_platform_staff());

CREATE POLICY "staff update domains"
  ON public.business_domains FOR UPDATE TO authenticated
  USING (private.is_platform_staff()) WITH CHECK (private.is_platform_staff());