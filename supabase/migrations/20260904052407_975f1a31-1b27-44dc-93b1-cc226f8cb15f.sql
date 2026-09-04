DROP POLICY IF EXISTS "authenticated reads domain mapping" ON public.business_domains;

CREATE POLICY "authenticated reads permitted domain mapping"
ON public.business_domains
FOR SELECT
TO authenticated
USING (
  private.is_business_manager(business_id)
  OR private.is_platform_staff()
  OR (
    verified_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_domains.business_id
        AND b.is_active
        AND b.lifecycle = 'active'::business_lifecycle
    )
  )
);