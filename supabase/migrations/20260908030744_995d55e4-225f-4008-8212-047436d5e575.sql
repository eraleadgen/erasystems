CREATE TYPE public.ai_agent_track AS ENUM ('ai_sms', 'ai_voice');

CREATE TABLE public.business_ai_agent_tracks (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  track public.ai_agent_track NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, track)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_ai_agent_tracks TO authenticated;
GRANT ALL ON public.business_ai_agent_tracks TO service_role;

ALTER TABLE public.business_ai_agent_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and staff read agent tracks"
  ON public.business_ai_agent_tracks FOR SELECT TO authenticated
  USING (
    public.is_platform_staff()
    OR EXISTS (
      SELECT 1 FROM public.business_members m
      WHERE m.business_id = business_ai_agent_tracks.business_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage agent tracks"
  ON public.business_ai_agent_tracks FOR ALL TO authenticated
  USING (public.is_platform_staff())
  WITH CHECK (public.is_platform_staff());

CREATE TRIGGER business_ai_agent_tracks_updated_at
  BEFORE UPDATE ON public.business_ai_agent_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.business_ai_agent_steps (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  track public.ai_agent_track NOT NULL,
  step_key text NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, track, step_key),
  CONSTRAINT business_ai_agent_steps_status_check
    CHECK (status IN ('not_started', 'in_progress', 'blocked', 'done'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_ai_agent_steps TO authenticated;
GRANT ALL ON public.business_ai_agent_steps TO service_role;

ALTER TABLE public.business_ai_agent_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and staff read agent steps"
  ON public.business_ai_agent_steps FOR SELECT TO authenticated
  USING (
    public.is_platform_staff()
    OR EXISTS (
      SELECT 1 FROM public.business_members m
      WHERE m.business_id = business_ai_agent_steps.business_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage agent steps"
  ON public.business_ai_agent_steps FOR ALL TO authenticated
  USING (public.is_platform_staff())
  WITH CHECK (public.is_platform_staff());

CREATE TRIGGER business_ai_agent_steps_updated_at
  BEFORE UPDATE ON public.business_ai_agent_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();