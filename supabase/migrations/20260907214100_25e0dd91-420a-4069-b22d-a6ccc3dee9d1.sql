ALTER TABLE public.business_site
  ADD COLUMN IF NOT EXISTS statement_email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS statement_email_to text;