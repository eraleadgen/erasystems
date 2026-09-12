CREATE OR REPLACE FUNCTION public.tenant_site_is_live(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_provisioning p
    WHERE p.business_id = _business_id
      AND p.website_status = 'live'
  );
$$;

REVOKE ALL ON FUNCTION public.tenant_site_is_live(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_site_is_live(uuid) TO anon, authenticated, service_role;