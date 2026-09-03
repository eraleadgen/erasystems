CREATE TABLE IF NOT EXISTS public.client_provisioning (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_domain text,
  domain_status text NOT NULL DEFAULT 'not_started',
  a2p_required boolean NOT NULL DEFAULT false,
  a2p_status text NOT NULL DEFAULT 'not_started',
  a2p_notes text,
  website_url text,
  website_status text NOT NULL DEFAULT 'not_started',
  overview_notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_provisioning TO authenticated;
GRANT ALL ON public.client_provisioning TO service_role;

ALTER TABLE public.client_provisioning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform staff read provisioning" ON public.client_provisioning
  FOR SELECT TO authenticated USING (private.is_platform_staff());
CREATE POLICY "platform staff insert provisioning" ON public.client_provisioning
  FOR INSERT TO authenticated WITH CHECK (private.is_platform_staff());
CREATE POLICY "platform staff update provisioning" ON public.client_provisioning
  FOR UPDATE TO authenticated USING (private.is_platform_staff()) WITH CHECK (private.is_platform_staff());

CREATE TRIGGER client_provisioning_updated_at BEFORE UPDATE ON public.client_provisioning
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ERA's own account: enterprise, live, downloadable apps included at no charge.
UPDATE public.businesses
   SET plan_tier = 'enterprise', lifecycle = 'active', is_active = true,
       slug_reserved_until = null, name = 'ERA Systems'
 WHERE slug = 'era';

INSERT INTO public.business_addons (business_id, addon, price_cents, billing_interval, is_active, notes)
SELECT id, 'white_label_branding', 0, 'one_time', true, 'Internal ERA account, no charge.'
  FROM public.businesses WHERE slug = 'era'
ON CONFLICT (business_id, addon) DO UPDATE
  SET price_cents = 0, is_active = true, deactivated_at = null, billing_interval = 'one_time';

-- VDS: the founder's detailing business, run on ERA as the working proof.
INSERT INTO public.businesses (slug, name, legal_name, timezone, plan_tier, lifecycle, is_active)
VALUES ('vds', 'VDS', 'Vinny''s Detailing Services LLC', 'America/New_York', 'enterprise', 'active', true)
ON CONFLICT (slug) DO UPDATE
  SET plan_tier = 'enterprise', lifecycle = 'active', is_active = true, slug_reserved_until = null;

INSERT INTO public.business_members (business_id, user_id, role)
SELECT b.id, 'cf0462b3-a6e1-4300-902f-6c53641964e5'::uuid, 'owner'
  FROM public.businesses b WHERE b.slug = 'vds'
ON CONFLICT DO NOTHING;

INSERT INTO public.business_addons (business_id, addon, price_cents, billing_interval, is_active, notes)
SELECT id, 'white_label_branding', 0, 'one_time', true, 'Founder-owned proof account, no charge.'
  FROM public.businesses WHERE slug = 'vds'
ON CONFLICT (business_id, addon) DO UPDATE
  SET price_cents = 0, is_active = true, deactivated_at = null, billing_interval = 'one_time';