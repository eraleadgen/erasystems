CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.job_http_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.job_http_secrets FROM anon, authenticated;
GRANT ALL ON public.job_http_secrets TO service_role;
ALTER TABLE public.job_http_secrets ENABLE ROW LEVEL SECURITY;