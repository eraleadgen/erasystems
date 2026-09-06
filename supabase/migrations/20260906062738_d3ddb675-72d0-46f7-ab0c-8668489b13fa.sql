CREATE TABLE public.business_site (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  tagline text,
  about text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  service_area text,
  hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  booking_enabled boolean NOT NULL DEFAULT true,
  service_location text NOT NULL DEFAULT 'at_business',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_site_service_location_check CHECK (service_location IN ('at_business','at_customer'))
);

GRANT SELECT ON public.business_site TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_site TO authenticated;
GRANT ALL ON public.business_site TO service_role;

ALTER TABLE public.business_site ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads active business sites" ON public.business_site
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.is_active));

CREATE POLICY "members read their business site" ON public.business_site
  FOR SELECT TO authenticated
  USING (
    private.is_member_of(business_id)
    OR private.is_platform_staff()
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.is_active)
  );

CREATE POLICY "managers insert their business site" ON public.business_site
  FOR INSERT TO authenticated
  WITH CHECK (private.is_business_manager(business_id));

CREATE POLICY "managers update their business site" ON public.business_site
  FOR UPDATE TO authenticated
  USING (private.is_business_manager(business_id))
  WITH CHECK (private.is_business_manager(business_id));

CREATE POLICY "managers delete their business site" ON public.business_site
  FOR DELETE TO authenticated
  USING (private.is_business_manager(business_id));

CREATE TRIGGER business_site_set_updated_at
  BEFORE UPDATE ON public.business_site
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();