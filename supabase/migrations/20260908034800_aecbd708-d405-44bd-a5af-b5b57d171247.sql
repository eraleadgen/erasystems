CREATE TABLE public.scheduled_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  succeeded boolean,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scheduled_job_runs TO authenticated;
GRANT ALL ON public.scheduled_job_runs TO service_role;

ALTER TABLE public.scheduled_job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff can view job runs"
  ON public.scheduled_job_runs FOR SELECT
  TO authenticated
  USING (public.is_platform_staff());

CREATE INDEX scheduled_job_runs_job_started_idx
  ON public.scheduled_job_runs (job_name, started_at DESC);