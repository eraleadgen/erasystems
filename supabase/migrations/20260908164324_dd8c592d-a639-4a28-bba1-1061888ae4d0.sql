-- App identity for installable apps. Returns branding ONLY when the business is
-- live and the white_label_branding add-on is active. No other columns leak.
CREATE OR REPLACE FUNCTION public.app_identity(_business_id uuid)
RETURNS TABLE (
  business_id uuid,
  name text,
  slug text,
  logo_url text,
  brand_primary text,
  brand_accent text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.slug, b.logo_url, b.brand_primary, b.brand_accent
  FROM public.businesses b
  WHERE b.id = _business_id
    AND b.is_active
    AND b.lifecycle = 'active'
    AND EXISTS (
      SELECT 1 FROM public.business_addons a
      WHERE a.business_id = b.id
        AND a.addon = 'white_label_branding'
        AND a.is_active
    )
$$;

REVOKE ALL ON FUNCTION public.app_identity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_identity(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.app_identity_for_host(_hostname text)
RETURNS TABLE (
  business_id uuid,
  name text,
  slug text,
  logo_url text,
  brand_primary text,
  brand_accent text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.*
  FROM public.business_domains d
  CROSS JOIN LATERAL public.app_identity(d.business_id) i
  WHERE d.hostname = lower(trim(_hostname))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.app_identity_for_host(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_identity_for_host(text) TO anon, authenticated, service_role;