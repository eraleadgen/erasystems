ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS portal_theme text NOT NULL DEFAULT 'dark';
ALTER TABLE public.businesses ADD CONSTRAINT businesses_portal_theme_check CHECK (portal_theme IN ('light','dark'));

ALTER TABLE public.onboarding_drafts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE POLICY "platform staff update drafts" ON public.onboarding_drafts
  FOR UPDATE TO authenticated USING (private.is_platform_staff()) WITH CHECK (private.is_platform_staff());

CREATE POLICY "platform staff update business sites" ON public.business_site
  FOR UPDATE TO authenticated USING (private.is_platform_staff()) WITH CHECK (private.is_platform_staff());

CREATE TABLE public.login_codes (
  user_id uuid PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.login_codes TO service_role;
ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;