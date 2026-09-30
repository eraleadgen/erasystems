DROP POLICY IF EXISTS "public reads specialist services" ON public.specialist_services;
CREATE POLICY "public reads live active specialist services" ON public.specialist_services
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.specialist_profiles sp
    WHERE sp.id = specialist_services.specialist_id
      AND sp.is_active
      AND public.tenant_site_is_live(sp.business_id)
  ));