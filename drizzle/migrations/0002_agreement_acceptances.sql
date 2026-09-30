CREATE TABLE public.agreement_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  agreement_version text NOT NULL,
  terms_snapshot jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agreement_acceptances_business_idx ON public.agreement_acceptances(business_id, accepted_at DESC);
GRANT SELECT, INSERT ON public.agreement_acceptances TO authenticated;
GRANT ALL ON public.agreement_acceptances TO service_role;
ALTER TABLE public.agreement_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members or staff read acceptances" ON public.agreement_acceptances
  FOR SELECT TO authenticated
  USING (private.is_member_of(business_id) OR public.is_platform_staff());
CREATE POLICY "managers record own acceptance" ON public.agreement_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.is_business_manager(business_id));