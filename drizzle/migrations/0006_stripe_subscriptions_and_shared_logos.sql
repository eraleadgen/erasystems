CREATE TABLE public.business_billing (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  subscription_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  last_payment_failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_billing TO authenticated;
GRANT ALL ON public.business_billing TO service_role;
ALTER TABLE public.business_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members and staff read billing" ON public.business_billing
  FOR SELECT TO authenticated
  USING (public.is_platform_staff() OR EXISTS (
    SELECT 1 FROM public.business_members m
    WHERE m.business_id = business_billing.business_id AND m.user_id = auth.uid()));
CREATE TRIGGER business_billing_set_updated_at BEFORE UPDATE ON public.business_billing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "members and staff read business logo" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'onboarding-logos' AND (
    public.is_platform_staff() OR EXISTS (
      SELECT 1 FROM public.businesses b
      JOIN public.business_members m ON m.business_id = b.id AND m.user_id = auth.uid()
      WHERE b.logo_url = storage.objects.name)));