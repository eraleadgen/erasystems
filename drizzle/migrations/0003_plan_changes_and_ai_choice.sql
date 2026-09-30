CREATE TABLE public.plan_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  kind text NOT NULL,
  from_tier public.plan_tier NOT NULL,
  to_tier public.plan_tier,
  effective_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_change_kind CHECK (kind IN ('change','cancel')),
  CONSTRAINT plan_change_status CHECK (status IN ('scheduled','applied','withdrawn')),
  CONSTRAINT plan_change_target CHECK ((kind = 'change' AND to_tier IS NOT NULL) OR (kind = 'cancel' AND to_tier IS NULL))
);
CREATE UNIQUE INDEX plan_change_one_scheduled ON public.plan_change_requests(business_id) WHERE status = 'scheduled';

GRANT SELECT, INSERT, UPDATE ON public.plan_change_requests TO authenticated;
GRANT ALL ON public.plan_change_requests TO service_role;
ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members or staff read plan changes" ON public.plan_change_requests
  FOR SELECT TO authenticated
  USING (private.is_member_of(business_id) OR public.is_platform_staff());
CREATE POLICY "managers schedule plan changes" ON public.plan_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (private.is_business_manager(business_id) AND requested_by = auth.uid() AND status = 'scheduled' AND applied_at IS NULL);
CREATE POLICY "managers withdraw plan changes" ON public.plan_change_requests
  FOR UPDATE TO authenticated
  USING ((private.is_business_manager(business_id) OR public.is_platform_staff()) AND status = 'scheduled')
  WITH CHECK ((private.is_business_manager(business_id) OR public.is_platform_staff()) AND status = 'withdrawn' AND applied_at IS NULL);

CREATE TRIGGER plan_change_requests_updated_at BEFORE UPDATE ON public.plan_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_ai_agent_choice(_business_id uuid, _track public.ai_agent_track, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if not private.is_business_manager(_business_id) then
    raise exception 'not allowed';
  end if;
  if not private.business_has_feature(_business_id, 'voice_sms_agent') then
    raise exception 'AI agents are part of the Enterprise plan';
  end if;
  insert into public.business_ai_agent_tracks (business_id, track, is_enabled)
  values (_business_id, _track, _enabled)
  on conflict (business_id, track) do update set is_enabled = excluded.is_enabled, updated_at = now();
  return _enabled;
end;
$$;
REVOKE EXECUTE ON FUNCTION public.set_ai_agent_choice(uuid, public.ai_agent_track, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_ai_agent_choice(uuid, public.ai_agent_track, boolean) TO authenticated;